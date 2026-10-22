/**
 * SpeekBetter — 发音对比引擎 (Pronunciation Compare Engine)
 * ---------------------------------------------------------------------------
 * 纯前端实现，不依赖任何后端或第三方库：
 *
 *   1. Web Audio 解码示范音频 (.wav) 与用户录音 (webm/opus)
 *   2. 重采样到 16 kHz 单声道
 *   3. MFCC 特征提取 (26 mel -> DCT -> 13 维) + 逐句 CMVN 归一化
 *   4. 在示范音频上估计每个单词的时间边界 (能量谷值吸附)
 *   5. DTW 对齐用户录音与示范音频 (带状约束)
 *   6. 逐词打分 + 与浏览器转写结果交叉验证 -> 发音错误单词
 *
 * 重要说明：这不是专业的音素级发音评测。分数来自声学相似度 + 转写一致性的
 * 启发式估计，界面上必须如实标注这一点。
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Pronunciation = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* ------------------------------------------------------------------ *
   * 常量
   * ------------------------------------------------------------------ */
  const SR = 16000;        // 分析采样率
  const FRAME = 400;       // 25 ms
  const HOP = 160;         // 10 ms
  const N_FFT = 512;
  const N_MEL = 26;
  const N_MFCC = 13;       // c0..c12
  const MFCC_USE = 12;     // 比较时使用 c1..c12（去掉 c0 能量项）

  /* ------------------------------------------------------------------ *
   * 基础数学
   * ------------------------------------------------------------------ */
  function sincPi(x) {
    if (Math.abs(x) < 1e-8) return 1;
    const p = Math.PI * x;
    return Math.sin(p) / p;
  }

  function hann(n) {
    const w = new Float32Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    return w;
  }

  /** 带限重采样（多普勒避免的 sinc 插值），22050 -> 16000 也用它 */
  function resample(input, fromRate, toRate) {
    if (!input.length || fromRate === toRate) return input;
    const ratio = toRate / fromRate;
    const outLen = Math.max(1, Math.floor(input.length * ratio));
    const out = new Float32Array(outLen);
    const cutoff = Math.min(1, ratio) * 0.9;
    const TAPS = 20;
    for (let i = 0; i < outLen; i++) {
      const center = i / ratio;
      const base = Math.floor(center);
      let acc = 0;
      let norm = 0;
      for (let k = base - TAPS; k <= base + TAPS; k++) {
        const x = center - k;
        if (Math.abs(x) > TAPS) continue;
        const t = (x + TAPS) / (2 * TAPS);
        const w = 0.42 - 0.5 * Math.cos(Math.PI * t); // Hamming
        const s = cutoff * sincPi(cutoff * x) * w;
        const idx = k < 0 ? 0 : k >= input.length ? input.length - 1 : k;
        acc += input[idx] * s;
        norm += s;
      }
      out[i] = norm !== 0 ? acc / norm : 0;
    }
    return out;
  }

  /** 多声道 -> 单声道 */
  function toMono(channels) {
    if (!channels.length) return new Float32Array(0);
    if (channels.length === 1) return channels[0];
    const len = channels[0].length;
    const out = new Float32Array(len);
    for (const ch of channels) for (let i = 0; i < len; i++) out[i] += ch[i];
    const inv = 1 / channels.length;
    for (let i = 0; i < len; i++) out[i] *= inv;
    return out;
  }

  function preEmphasis(x, a) {
    const out = new Float32Array(x.length);
    out[0] = x[0];
    for (let i = 1; i < x.length; i++) out[i] = x[i] - a * x[i - 1];
    return out;
  }

  /** 原地迭代式 radix-2 FFT */
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (-2 * Math.PI) / len;
      const wr = Math.cos(ang);
      const wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1;
        let ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const ur = re[i + k];
          const ui = im[i + k];
          const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
          const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
          re[i + k] = ur + vr;
          im[i + k] = ui + vi;
          re[i + k + len / 2] = ur - vr;
          im[i + k + len / 2] = ui - vi;
          const ncr = cr * wr - ci * wi;
          ci = cr * wi + ci * wr;
          cr = ncr;
        }
      }
    }
  }

  function hzToMel(f) {
    return 2595 * Math.log10(1 + f / 700);
  }
  function melToHz(m) {
    return 700 * (Math.pow(10, m / 2595) - 1);
  }

  /** HTK 风格三角 mel 滤波器组 */
  function melFilterbank(sampleRate, nFilters, nFft) {
    const nBins = nFft / 2 + 1;
    const fMin = 40;
    const fMax = Math.min(8000, sampleRate / 2);
    const melMin = hzToMel(fMin);
    const melMax = hzToMel(fMax);
    const points = new Float32Array(nFilters + 2);
    for (let i = 0; i < points.length; i++) {
      const mel = melMin + ((melMax - melMin) * i) / (nFilters + 1);
      points[i] = ((nFft + 1) * melToHz(mel)) / sampleRate;
    }
    const bank = [];
    for (let m = 1; m <= nFilters; m++) {
      const left = points[m - 1];
      const center = points[m];
      const right = points[m + 1];
      const weights = new Float32Array(nBins);
      for (let k = 0; k < nBins; k++) {
        if (k < left || k > right) continue;
        if (k <= center) weights[k] = center === left ? 1 : (k - left) / (center - left);
        else weights[k] = right === center ? 1 : (right - k) / (right - center);
      }
      bank.push(weights);
    }
    return bank;
  }

  function dct2(input, nOut) {
    const n = input.length;
    const out = new Float32Array(nOut);
    for (let k = 0; k < nOut; k++) {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += input[i] * Math.cos((Math.PI * k * (i + 0.5)) / n);
      out[k] = sum * (k === 0 ? Math.sqrt(1 / n) : Math.sqrt(2 / n));
    }
    return out;
  }

  /* ------------------------------------------------------------------ *
   * MFCC 特征
   * ------------------------------------------------------------------ */
  function mfcc(samples, sampleRate) {
    if (samples.length < FRAME) return { frames: [], energy: [], hopSeconds: HOP / sampleRate };
    const emphasized = preEmphasis(samples, 0.97);
    const win = hann(FRAME);
    const bank = melFilterbank(sampleRate, N_MEL, N_FFT);
    const nBins = N_FFT / 2 + 1;
    const count = 1 + Math.floor((emphasized.length - FRAME) / HOP);
    const frames = new Array(count);
    const energy = new Float32Array(count);
    const re = new Float64Array(N_FFT);
    const im = new Float64Array(N_FFT);
    const mel = new Float32Array(N_MEL);

    for (let f = 0; f < count; f++) {
      const off = f * HOP;
      let sumSq = 0;
      for (let i = 0; i < FRAME; i++) {
        const s = emphasized[off + i] * win[i];
        re[i] = s;
        im[i] = 0;
        sumSq += s * s;
      }
      energy[f] = 10 * Math.log10(Math.max(1e-10, sumSq / FRAME));
      for (let i = FRAME; i < N_FFT; i++) { re[i] = 0; im[i] = 0; }
      fft(re, im);
      for (let m = 0; m < N_MEL; m++) {
        const w = bank[m];
        let acc = 0;
        for (let k = 0; k < nBins; k++) {
          if (!w[k]) continue;
          acc += (re[k] * re[k] + im[k] * im[k]) * w[k];
        }
        mel[m] = Math.log(Math.max(1e-10, acc));
      }
      frames[f] = dct2(mel, N_MFCC);
    }
    return { frames, energy, hopSeconds: HOP / sampleRate };
  }

  /** 逐句均值方差归一化，削弱音色/信道差异 */
  function cmvn(frames) {
    if (!frames.length) return [];
    const dim = frames[0].length;
    const mean = new Float64Array(dim);
    for (const f of frames) for (let d = 0; d < dim; d++) mean[d] += f[d];
    for (let d = 0; d < dim; d++) mean[d] /= frames.length;
    const std = new Float64Array(dim);
    for (const f of frames) for (let d = 0; d < dim; d++) std[d] += (f[d] - mean[d]) ** 2;
    for (let d = 0; d < dim; d++) std[d] = Math.sqrt(std[d] / frames.length) || 1;
    return frames.map((f) => {
      const out = new Float32Array(dim);
      for (let d = 0; d < dim; d++) out[d] = (f[d] - mean[d]) / std[d];
      return out;
    });
  }

  /* ------------------------------------------------------------------ *
   * 语音活动检测 + 单词边界
   * ------------------------------------------------------------------ */
  function smooth(values, radius) {
    const out = new Float32Array(values.length);
    for (let i = 0; i < values.length; i++) {
      let sum = 0;
      let n = 0;
      for (let k = i - radius; k <= i + radius; k++) {
        if (k < 0 || k >= values.length) continue;
        sum += values[k];
        n++;
      }
      out[i] = sum / n;
    }
    return out;
  }

  /** 返回语音区间 [start, end]（帧号），找不到时返回整段 */
  function speechRange(energy) {
    if (!energy.length) return [0, 0];
    const sorted = Array.from(energy).sort((a, b) => a - b);
    const noiseFloor = sorted[Math.floor(sorted.length * 0.1)];
    const peak = sorted[Math.floor(sorted.length * 0.98)];
    const threshold = Math.max(noiseFloor + 8, peak - 32);
    let start = 0;
    let end = energy.length - 1;
    while (start < energy.length && energy[start] < threshold) start++;
    while (end > start && energy[end] < threshold) end--;
    if (end <= start) return [0, energy.length - 1];
    return [start, end];
  }

  /** 英语音节数启发式 */
  function countSyllables(word) {
    const w = String(word || "").toLowerCase().replace(/[^a-z]/g, "");
    if (!w) return 1;
    if (w.length <= 3) return 1;
    let body = w.replace(/(?:[^laeiouy]es|[^laeiouy]e)$/, "");
    body = body.replace(/^y/, "");
    const groups = body.match(/[aeiouy]{1,2}/g);
    let n = groups ? groups.length : 1;
    if (/(?:[^aeiouy]ed|[^aeiouy]es)$/.test(w) && n > 1) n -= 1;
    if (/[aeiouy]le$/.test(w)) n += 1;
    return Math.max(1, n);
  }

  /**
   * 在示范音频上估计每个单词的起止帧。
   *
   * 做法：先检测语音段内的能量谷值（词间隙候选），再用动态规划挑选一组
   * 单调递增的切分点，使各词时长尽量贴合音节权重，同时尽量落在真实的词间隙上。
   * （早期版本用贪心吸附会导致后面的词被挤成 0 宽，必须用 DP 保证单调性。）
   */
  function estimateWordBoundaries(energy, words, hopSeconds) {
    const frames = energy.length;
    if (!words.length || !frames) return [];
    const [s0, s1] = speechRange(energy);
    const smoothed = smooth(energy, 4);
    const span = Math.max(1, s1 - s0);

    // --- 候选谷值：语音段内的局部极小且明显低于邻域 ---
    const valleyDepth = [];
    for (let i = s0 + 3; i < s1 - 2; i++) {
      const v = smoothed[i];
      let isMin = true;
      for (let k = i - 3; k <= i + 3; k++) {
        if (k === i) continue;
        if (smoothed[k] < v) { isMin = false; break; }
      }
      if (!isMin) continue;
      let localSum = 0;
      let localN = 0;
      for (let k = i - 8; k <= i + 8; k++) {
        if (k < 0 || k >= frames) continue;
        localSum += smoothed[k];
        localN++;
      }
      if (!localN) continue;
      const depth = localSum / localN - v;
      if (depth > 1.0) valleyDepth.push({ frame: i, depth });
    }
    // 合并相邻谷值，保留更深的那个
    valleyDepth.sort((a, b) => a.frame - b.frame);
    const merged = [];
    for (const v of valleyDepth) {
      if (merged.length && v.frame - merged[merged.length - 1].frame <= 4) {
        if (v.depth > merged[merged.length - 1].depth) merged[merged.length - 1] = v;
      } else merged.push(v);
    }

    const weights = words.map((w) => {
      const c = countSyllables(w);
      return c === 1 ? 1 : c * 0.82 + 0.18;
    });
    const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
    const expectedW = weights.map((w) => Math.max(1, (w / totalWeight) * span));

    const count = words.length;
    const need = count - 1; // 内部切分点数量

    if (need <= 0) {
      return [{ word: words[0], start: s0, end: s1, startTime: s0 * hopSeconds, endTime: s1 * hopSeconds }];
    }

    // --- 候选切分点：谷值 + 均匀网格兜底 ---
    let candidates = merged.map((v) => v.frame).filter((f) => f > s0 && f < s1);
    if (candidates.length < need) {
      for (let i = 1; i <= need; i++) {
        candidates.push(Math.round(s0 + (span * i) / (need + 1)));
      }
    }
    candidates = Array.from(new Set(candidates)).sort((a, b) => a - b).filter((f) => f > s0 && f < s1);
    // 候选过多时保留最深的若干个，避免 DP 复杂度爆炸
    if (candidates.length > 160) {
      const keep = new Set();
      const byDepth = [...merged].sort((a, b) => b.depth - a.depth).slice(0, 140);
      for (const v of byDepth) if (v.frame > s0 && v.frame < s1) keep.add(v.frame);
      for (let i = 1; i <= need && keep.size < 160; i++) keep.add(Math.round(s0 + (span * i) / (need + 1)));
      candidates = [...keep].sort((a, b) => a - b);
    }

    const V = candidates.length;
    if (!V) {
      // 完全没有候选：按比例硬切
      const out = [];
      let cursor = s0;
      for (let i = 0; i < count; i++) {
        const end = i === count - 1 ? s1 : Math.round(s0 + (span * (i + 1)) / count);
        out.push({ word: words[i], start: cursor, end, startTime: cursor * hopSeconds, endTime: end * hopSeconds });
        cursor = end;
      }
      return out;
    }

    // --- DP：dp[i][k] = 前 i 个切分点、且第 i 个落在候选 k 的最小代价 ---
    const INF = Infinity;
    const back = [];
    for (let i = 0; i < need; i++) back.push(new Int32Array(V).fill(-1));

    let prev = new Float64Array(V).fill(INF);
    for (let k = 0; k < V; k++) {
      const width = candidates[k] - s0;
      prev[k] = Math.abs(width - expectedW[0]) / expectedW[0];
    }
    for (let i = 1; i < need; i++) {
      const cur = new Float64Array(V).fill(INF);
      for (let k = 0; k < V; k++) {
        let best = INF;
        let bestK = -1;
        for (let k2 = 0; k2 < k; k2++) {
          if (prev[k2] < best) { best = prev[k2]; bestK = k2; }
        }
        if (bestK < 0) continue;
        const width = candidates[k] - candidates[bestK];
        const cost = best + Math.abs(width - expectedW[i]) / expectedW[i];
        cur[k] = cost;
        back[i][k] = bestK;
      }
      prev = cur;
    }

    // 最后一个切分点之后到语音结束是最后一个词
    let endK = -1;
    let endVal = INF;
    for (let k = 0; k < V; k++) {
      if (prev[k] < endVal) { endVal = prev[k]; endK = k; }
    }
    if (endK < 0) {
      const out = [];
      let cursor = s0;
      for (let i = 0; i < count; i++) {
        const end = i === count - 1 ? s1 : Math.round(s0 + (span * (i + 1)) / count);
        out.push({ word: words[i], start: cursor, end, startTime: cursor * hopSeconds, endTime: end * hopSeconds });
        cursor = end;
      }
      return out;
    }

    const cuts = new Array(need);
    let k = endK;
    for (let i = need - 1; i >= 0; i--) {
      cuts[i] = candidates[k];
      k = back[i][k];
      if (k < 0) break;
    }

    const out = [];
    let cursor = s0;
    for (let i = 0; i < count; i++) {
      const end = i === count - 1 ? s1 : Math.max(cursor + 1, cuts[i]);
      out.push({ word: words[i], start: cursor, end, startTime: cursor * hopSeconds, endTime: end * hopSeconds });
      cursor = end;
    }
    return out;
  }

  /* ------------------------------------------------------------------ *
   * 音色归一化 (VTLN)
   *
   * 用户和示范音频是不同的人，基频和声道长度都不同，直接比 MFCC 会整体偏低。
   * 先估计双方基频，再把用户的音频按比例缩放到示范的基频上——
   * 这同时修正了音高和共振峰（声道长度），让逐词比较真正反映"发得准不准"。
   * ------------------------------------------------------------------ */
  /**
   * 估计基频。用归一化自相关，并对"倍频误判"做修正：
   * 自相关在 2T、3T 处同样会出现峰值，如果最大值落在 2T 上就会把基频估成一半。
   * 因此在最大值之前寻找"接近最大值"的更短周期，若存在则改用它。
   */
  function estimateF0(samples, sampleRate) {
    if (!samples || samples.length < sampleRate * 0.15) return null;
    const win = 1024;
    const hop = 256;
    const minLag = Math.max(2, Math.floor(sampleRate / 330)); // 上限 330 Hz
    const maxLag = Math.min(Math.floor(sampleRate / 90), win - 1); // 下限 90 Hz
    if (maxLag <= minLag) return null;
    const estimates = [];
    let prevEnergy = 0;
    const corr = new Float64Array(maxLag + 1);
    for (let off = 0; off + win <= samples.length; off += hop) {
      let energy = 0;
      for (let i = 0; i < win; i++) energy += samples[off + i] * samples[off + i];
      energy = Math.sqrt(energy / win);
      if (energy < 0.012 || energy < prevEnergy * 0.25) { prevEnergy = energy; continue; }
      prevEnergy = energy;
      let bestLag = -1;
      let bestVal = 0;
      for (let lag = minLag; lag <= maxLag; lag++) {
        let num = 0;
        let den = 0;
        for (let i = 0; i < win - lag; i++) {
          num += samples[off + i] * samples[off + i + lag];
          den += samples[off + i] * samples[off + i];
        }
        const r = den > 0 ? num / den : 0;
        corr[lag] = r;
        if (r > bestVal) { bestVal = r; bestLag = lag; }
      }
      if (bestLag < 0 || bestVal < 0.34) continue;
      // 倍频修正：如果存在更短且同样接近最大值的周期，用它（基频更高才是对的）
      let chosen = bestLag;
      for (let lag = minLag; lag < bestLag; lag++) {
        if (corr[lag] >= 0.82 * bestVal) { chosen = lag; break; }
      }
      estimates.push(sampleRate / chosen);
    }
    if (estimates.length < 4) return null;
    estimates.sort((a, b) => a - b);
    return estimates[Math.floor(estimates.length / 2)];
  }

  /**
   * 把用户音频归一化到示范音频的基频上。
   *
   * 注意方向：resample(x, R, R/k) 之后再按 R 解读，等价于 z[n] = x[n/k]，
   * 也就是基频乘以 k、时长除以 k。要把 f0u 变成 f0m，需要 k = f0m / f0u，
   * 因此实际采样率要乘以 f0u / f0m。
   */
  function normalizeSpeaker(userSamples, userRate, modelSamples, modelRate) {
    const f0u = estimateF0(userSamples, userRate);
    const f0m = estimateF0(modelSamples, modelRate);
    if (!f0u || !f0m) return { samples: userSamples, applied: false, f0User: f0u, f0Model: f0m };
    const factor = f0u / f0m; // 采样率乘数
    if (!Number.isFinite(factor) || factor < 0.68 || factor > 1.48) {
      return { samples: userSamples, applied: false, f0User: f0u, f0Model: f0m };
    }
    const scaled = resample(userSamples, userRate, userRate * factor);
    return { samples: scaled, applied: true, f0User: f0u, f0Model: f0m, factor };
  }

  /* ------------------------------------------------------------------ *
   * DTW
   * ------------------------------------------------------------------ */
  function cosineDistance(a, b) {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 1; i <= MFCC_USE; i++) {
      const x = a[i];
      const y = b[i];
      dot += x * y;
      na += x * x;
      nb += y * y;
    }
    if (na === 0 || nb === 0) return 1;
    return 1 - dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  /**
   * 斜率约束的带状 DTW。
   * 带中心沿对角线按 n/m 缩放，因此用户说得比示范慢或快时也能对齐。
   * 返回 { path, distance }，path 为 [refIndex, userIndex] 序列。
   */
  function dtw(ref, usr) {
    const n = ref.length;
    const m = usr.length;
    if (!n || !m) return { path: [], distance: Infinity };

    const scale = m / n;                       // 每个参考帧对应的用户帧数
    const band = Math.max(30, Math.round(Math.max(n, m) * 0.28));
    const rows = [];
    for (let i = 0; i < n; i++) {
      const center = i * scale;
      const j0 = Math.max(0, Math.floor(center - band));
      const j1 = Math.min(m - 1, Math.ceil(center + band));
      rows.push({ j0, j1, cost: new Float64Array(Math.max(1, j1 - j0 + 1)).fill(Infinity) });
    }

    const at = (i, j) => {
      if (i < 0 || j < 0 || j >= m || i >= n) return Infinity;
      const r = rows[i];
      if (j < r.j0 || j > r.j1) return Infinity;
      return r.cost[j - r.j0];
    };

    for (let i = 0; i < n; i++) {
      const r = rows[i];
      for (let j = r.j0; j <= r.j1; j++) {
        const d = cosineDistance(ref[i], usr[j]);
        let best;
        if (i === 0 && j === 0) {
          best = 0;
        } else {
          best = Math.min(
            at(i - 1, j - 1),
            at(i - 1, j),
            at(i, j - 1)
          );
          if (!Number.isFinite(best)) continue;
        }
        r.cost[j - r.j0] = d + best;
      }
    }

    // 终点：最后一行的最低代价格（通常就是 (n-1, m-1)）
    let endJ = -1;
    let endVal = Infinity;
    const last = rows[n - 1];
    for (let j = last.j0; j <= last.j1; j++) {
      const v = last.cost[j - last.j0];
      if (v < endVal) { endVal = v; endJ = j; }
    }
    if (endJ < 0) return { path: [], distance: Infinity };

    const path = [];
    let i = n - 1;
    let j = endJ;
    path.push([i, j]);
    while (i > 0 || j > 0) {
      const options = [];
      if (i > 0 && j > 0) options.push([i - 1, j - 1]);
      if (i > 0) options.push([i - 1, j]);
      if (j > 0) options.push([i, j - 1]);
      let best = null;
      let bestVal = Infinity;
      for (const o of options) {
        const v = at(o[0], o[1]);
        if (v < bestVal) { bestVal = v; best = o; }
      }
      if (!best || !Number.isFinite(bestVal)) break;
      i = best[0];
      j = best[1];
      path.push([i, j]);
    }
    path.reverse();
    return { path, distance: endVal / Math.max(1, path.length) };
  }

  /* ------------------------------------------------------------------ *
   * 文本工具
   * ------------------------------------------------------------------ */
  function normalizeWords(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9'\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  }

  /* 缩读词与展开形式：说话人念 "I will"、示范写 "I'll" 时，两者应算同一个词 */
  const CONTRACTIONS = {
    "i'll": ["i", "will"],
    "i'm": ["i", "am"],
    "you're": ["you", "are"],
    "we're": ["we", "are"],
    "they're": ["they", "are"],
    "he's": ["he", "is"],
    "she's": ["she", "is"],
    "it's": ["it", "is"],
    "that's": ["that", "is"],
    "there's": ["there", "is"],
    "what's": ["what", "is"],
    "here's": ["here", "is"],
    "let's": ["let", "us"],
    "don't": ["do", "not"],
    "doesn't": ["does", "not"],
    "didn't": ["did", "not"],
    "can't": ["can", "not"],
    "won't": ["will", "not"],
    "wouldn't": ["would", "not"],
    "shouldn't": ["should", "not"],
    "couldn't": ["could", "not"],
    "isn't": ["is", "not"],
    "aren't": ["are", "not"],
    "wasn't": ["was", "not"]
  };

  /** 词形近似度（用于把转写结果对齐到示范文本） */
  function wordSimilarity(a, b) {
    if (a === b) return 3;
    if (!a || !b) return 0;
    // 缩读 vs 展开：示范写 "i'll"、学生念 "I will" 时，不该被判成"没说这个词"
    const ca = CONTRACTIONS[a];
    const cb = CONTRACTIONS[b];
    if (ca && ca.includes(b)) return 2;
    if (cb && cb.includes(a)) return 2;
    if (a.length > 3 && b.length > 3 && (a.startsWith(b) || b.startsWith(a))) return 2;
    const lev = levenshtein(a, b);
    const ratio = 1 - lev / Math.max(a.length, b.length);
    return ratio >= 0.72 ? 1 : 0;
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = new Array(b.length + 1);
    let cur = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
      cur[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      }
      const t = prev; prev = cur; cur = t;
    }
    return prev[b.length];
  }

  /**
   * Needleman-Wunsch：把用户的转写词序列对齐到示范词序列。
   * 返回 map: demoIndex -> { heard: string|null, heardIndex: number|null, score }
   */
  function alignWords(demoWords, heardWords) {
    const n = demoWords.length;
    const m = heardWords.length;
    const map = new Array(n).fill(null).map(() => ({ heard: null, heardIndex: null, score: 0 }));
    if (!n || !m) return map;
    const GAP = -1;
    const dp = new Float64Array((n + 1) * (m + 1));
    const w = m + 1;
    for (let i = 1; i <= n; i++) dp[i * w] = dp[(i - 1) * w] + GAP;
    for (let j = 1; j <= m; j++) dp[j] = dp[j - 1] + GAP;
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        const sim = wordSimilarity(demoWords[i - 1], heardWords[j - 1]);
        const diag = dp[(i - 1) * w + (j - 1)] + (sim > 0 ? sim : GAP);
        const up = dp[(i - 1) * w + j] + GAP;
        const left = dp[i * w + (j - 1)] + GAP;
        dp[i * w + j] = Math.max(diag, Math.max(up, left));
      }
    }
    // 回溯
    let i = n;
    let j = m;
    while (i > 0 && j > 0) {
      const sim = wordSimilarity(demoWords[i - 1], heardWords[j - 1]);
      const diag = dp[(i - 1) * w + (j - 1)] + (sim > 0 ? sim : GAP);
      if (Math.abs(diag - dp[i * w + j]) < 1e-9 && sim > 0) {
        map[i - 1] = { heard: heardWords[j - 1], heardIndex: j - 1, score: sim };
        i--;
        j--;
      } else if (dp[(i - 1) * w + j] >= dp[i * w + (j - 1)]) {
        i--;
      } else {
        j--;
      }
    }
    // 一个缩读词可能同时对应示范里的两个词：heard 的 "i'll" 覆盖 "i" 和 "will"。
    // Needleman-Wunsch 只能一对一，这里把落在缩读展开范围里的那个词也补上。
    for (let k = 0; k < n; k++) {
      if (map[k].score > 0) continue;
      for (const nb of [k - 1, k + 1]) {
        if (nb < 0 || nb >= n) continue;
        const heard = map[nb].heard;
        if (!heard) continue;
        const expansion = CONTRACTIONS[heard];
        if (expansion && expansion.includes(demoWords[k])) {
          map[k] = { heard, heardIndex: map[nb].heardIndex, score: 2 };
          break;
        }
      }
    }
    return map;
  }

  /* ------------------------------------------------------------------ *
   * 发音难点提示（针对中文母语者的常见问题）
   * ------------------------------------------------------------------ */
  const PHONEME_HINTS = [
    { re: /th/i, label: "θ / ð", zh: "舌尖轻触上齿送气，别读成 s 或 z", level: 3 },
    { re: /([bcdfglmnprst])\1/i, label: "双写辅音", zh: "两个相同的辅音轻轻爆破一次就好，不要读成两拍", level: 3 },
    { re: /tion|sion/i, label: "-tion / -sion", zh: "读作 /ʃən/，注意不要多出一个元音", level: 2 },
    { re: /ing\b/i, label: "-ing", zh: "鼻音收尾 /ŋ/，舌尖不要碰上颚", level: 2 },
    { re: /ed\b/i, label: "-ed", zh: "-ed 有 /t/ /d/ /ɪd/ 三种读法，注意别多加一个音节", level: 3 },
    { re: /s\b/i, label: "词尾 -s", zh: "词尾 /s/ /z/ /ɪz/ 要区分，清辅音后读 /s/", level: 2 },
    { re: /v(?![aeiou])/i, label: "v", zh: "上齿轻咬下唇送气，别读成 w", level: 3 },
    { re: /ch|sh/i, label: "ch / sh", zh: "双唇略收圆，舌位比 s 更靠前", level: 2 },
    { re: /j\b|ge\b/i, label: "j", zh: "美音中 j 多读作 /dʒ/", level: 2 },
    { re: /ow\b|ou\b/i, label: "ow / ou", zh: "双元音滑动要饱满，不要读成单元音", level: 2 },
    { re: /air|ear/i, label: "air / ear", zh: "双元音尾音带明显的 /r/", level: 2 },
    { re: /[aeiou]r\b/i, label: "元音 + r", zh: "卷舌元音，舌尖要卷起来", level: 2 },
    { re: /^i(?![a-z])|ship|live/i, label: "i / ɪ", zh: "注意长短元音区别：ship 与 sheep", level: 2 },
    { re: /cat|bad|hat/i, label: "æ / ɛ", zh: "前元音要张口更开：cat 与 cut", level: 2 }
  ];

  /**
   * 给一个词挑一条最相关的发音提示。
   * /l/ 和 /r/ 的难点位置不同（词首 vs 词尾），分开给更准。
   */
  function phonemeHint(word) {
    const w = String(word || "");
    const lower = w.toLowerCase();
    if (!w) return null;

    // 词尾辅音簇
    const cluster = /[^aeiou]{3,}$/i.test(lower.replace(/e$/i, "")) && lower.length > 4;

    // l / r 按位置区分
    if (/ll$/.test(lower)) {
      return { label: "双 l", zh: "两个 l 要分开清，不要合并成一个", level: 2 };
    }
    if (/l$/.test(lower)) {
      return { label: "词尾 l", zh: "舌尖顶住上齿龈，别卷舌", level: 3 };
    }
    if (/^l/.test(lower)) {
      return { label: "词首 l", zh: "舌尖抵住上齿龈，靠舌侧出气", level: 2 };
    }
    if (/rr/.test(lower)) {
      return { label: "双 r", zh: "两个 r 都要卷舌", level: 2 };
    }
    if (/r$/.test(lower)) {
      return { label: "词尾 r", zh: "舌尖卷起但不碰上颚，保持卷舌", level: 3 };
    }
    if (/^r/.test(lower)) {
      return { label: "词首 r", zh: "舌尖卷起，嘴唇略收圆", level: 2 };
    }

    let best = null;
    // 词尾 -se 多读 /z/（please、rise），但有一批例外词仍是 /s/
    const SE_EXCEPT = new Set(["house", "mouse", "base", "case", "face", "race", "chase", "close", "use", "whose", "phase", "lace", "nose", "curse", "parse", "raise", "praise", "raise"]);
    if (/[^s]se$/.test(lower) && !SE_EXCEPT.has(lower)) {
      return { label: "词尾 -se", zh: "结尾的 s 要读成 /z/，别读成 /s/", level: 2 };
    }
    for (const rule of PHONEME_HINTS) {
      if (!rule.re.test(w)) continue;
      if (!best || rule.level > best.level) best = rule;
    }
    if (cluster) {
      return { label: "词尾辅音簇", zh: "结尾连着几个辅音，不要多加元音，逐个发清楚", level: 3 };
    }
    if (!best) return null;
    return { label: best.label, zh: best.zh, level: best.level };
  }

  /* ------------------------------------------------------------------ *
   * 自评模式：只用用户自己的录音 + 转写
   * ------------------------------------------------------------------ */
  function spectralFlatness(samples) {
    if (samples.length < 16) return 0;
    let logSum = 0;
    let sum = 0;
    const N = 64;
    for (let block = 0; block + N <= samples.length; block += N) {
      let acc = 0;
      for (let i = 0; i < N; i++) acc += samples[block + i] * samples[block + i];
      acc = acc / N + 1e-12;
      logSum += Math.log(acc);
      sum += acc;
    }
    const geo = Math.exp(logSum / Math.floor(samples.length / N));
    const arith = sum / Math.floor(samples.length / N);
    return geo / arith;
  }

  function rms(samples, from, to) {
    let acc = 0;
    let n = 0;
    for (let i = from; i < to; i++) {
      if (i < 0 || i >= samples.length) continue;
      acc += samples[i] * samples[i];
      n++;
    }
    return n ? Math.sqrt(acc / n) : 0;
  }

  /**
   * 依据拼写判断单词是否应该以可听见的辅音结尾（用于检测"吞音"）
   */
  function expectsFinalConsonant(word) {
    const w = String(word || "").toLowerCase().replace(/[^a-z]/g, "");
    if (!w) return null;
    if (/[^aeiou]e$/.test(w) && w.length > 3) return false; // 静音 e
    if (/e$/.test(w) && w.length > 2 && !/[aeiou]le$/.test(w)) {
      // 例如 "have" 结尾不发音
      if (["have", "give", "live", "love", "move", "come", "some", "like", "make", "take"].includes(w)) return false;
    }
    if (/[aeiouy]$/.test(w)) return false;
    return true;
  }

  /**
   * 自评分析：把转写结果按时间戳切分到用户音频上，
   * 检查每个词是否"说得清楚"（是否吞掉词尾辅音、信噪比、识别置信度）。
   */
  function analyzeSelf(samples, sampleRate, chunks, heardWords) {
    const hopSeconds = HOP / sampleRate;
    const { energy } = mfcc(samples, sampleRate);
    const frameCount = energy.length;
    const totalSeconds = samples.length / sampleRate;
    const [s0, s1] = speechRange(energy);
    const noiseFloor = (() => {
      const sorted = Array.from(energy).sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length * 0.1)];
    })();
    const peak = (() => {
      const sorted = Array.from(energy).sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length * 0.98)];
    })();

    // 由转写分块推算每个词的大致时间
    const timed = [];
    let cursor = s0 * hopSeconds;
    chunks.forEach((chunk, ci) => {
      const chunkWords = normalizeWords(chunk.text);
      if (!chunkWords.length) return;
      const chunkEnd = ci === chunks.length - 1
        ? totalSeconds
        : Math.min(totalSeconds, chunks[ci + 1].at / 1000);
      const start = Math.max(cursor, Math.min(chunkEnd, chunk.at / 1000 - chunkWords.length * 0.35));
      const span = Math.max(0.25, chunkEnd - start);
      const weights = chunkWords.map((w) => countSyllables(w));
      const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
      let c = start;
      chunkWords.forEach((w, wi) => {
        const dur = (weights[wi] / totalWeight) * span;
        timed.push({ word: w, start: c, end: c + dur, confidence: chunk.confidence ?? null });
        c += dur;
      });
      cursor = chunkEnd;
    });

    // 若没有分块信息，则平均分配
    if (!timed.length && heardWords.length) {
      const span = Math.max(0.5, totalSeconds - s0 * hopSeconds);
      const per = span / heardWords.length;
      heardWords.forEach((w, i) => {
        timed.push({ word: w, start: s0 * hopSeconds + i * per, end: s0 * hopSeconds + (i + 1) * per, confidence: null });
      });
    }

    const words = timed.map((item) => {
      const from = Math.max(0, Math.floor(item.start * sampleRate));
      const to = Math.min(samples.length, Math.ceil(item.end * sampleRate));
      if (to <= from) {
        return { word: item.word, score: null, status: "unknown", hint: null, userStart: item.start, userEnd: item.end, confidence: item.confidence, heard: item.word };
      }
      const seg = samples.subarray(from, to);
      const segEnergy = mfcc(seg, sampleRate).energy;
      if (!segEnergy.length) {
        return { word: item.word, score: null, status: "unknown", hint: null, userStart: item.start, userEnd: item.end, confidence: item.confidence, heard: item.word };
      }
      let peakE = -Infinity;
      let tailE = -Infinity;
      const tailFrom = Math.floor(segEnergy.length * 0.82);
      for (let i = 0; i < segEnergy.length; i++) {
        if (segEnergy[i] > peakE) peakE = segEnergy[i];
        if (i >= tailFrom && segEnergy[i] > tailE) tailE = segEnergy[i];
      }
      const tailRel = peakE > -Infinity ? tailE - peakE : 0;
      const snr = peakE - noiseFloor;
      const flat = spectralFlatness(seg);
      const wantFinal = expectsFinalConsonant(item.word);

      let score = 88;
      const issues = [];
      if (snr < 14) { score -= 14; issues.push("这一段录音偏小声或环境噪音较大"); }
      if (wantFinal && tailRel < -26) {
        score -= 30;
        issues.push("词尾辅音几乎没有声音，可能是吞音了");
      } else if (wantFinal && tailRel < -18) {
        score -= 14;
        issues.push("词尾辅音偏弱，注意把结尾发完整");
      }
      if (flat > 0.28 && wantFinal) { score -= 8; issues.push("词尾偏摩擦噪音，辅音位置可能不准"); }
      if (item.confidence !== null && item.confidence < 0.62) {
        score -= 16;
        issues.push("浏览器识别对这个词的把握不大");
      }
      score = Math.max(20, Math.min(100, score));
      return {
        word: item.word,
        score,
        status: score >= 75 ? "good" : score >= 55 ? "weak" : "error",
        hint: issues.length ? { label: "清晰度", zh: issues.join("；"), level: 2 } : null,
        userStart: item.start,
        userEnd: item.end,
        confidence: item.confidence,
        heard: item.word
      };
    });

    const scored = words.filter((w) => typeof w.score === "number");
    const similarity = scored.length
      ? Math.round(scored.reduce((a, w) => a + w.score, 0) / scored.length)
      : null;

    return {
      mode: "self",
      available: true,
      reason: null,
      similarity,
      coverage: null,
      durationRatio: null,
      words,
      errors: words.filter((w) => w.status === "error" || w.status === "weak"),
      note: "自评模式：基于你录音本身的声学线索（词尾是否发完整、清晰度、识别把握）判断，不是与示范音频的逐词对比。"
    };
  }

  /* ------------------------------------------------------------------ *
   * 对比模式：用户录音 vs 示范音频
   * ------------------------------------------------------------------ */
  function compareWithModel(model, user, modelText, heardWords) {
    const modelWords = normalizeWords(modelText);
    // 浏览器转写拿不到结果时（heardWords 为空），"你说的词"这一路信息就没有了。
    // 但声学对齐本身是有效的：仍然可以逐词给出相似度，于是照样能标红/标绿。
    // 唯一例外是录音里根本没有语音——那时不该把每个词都判成"错"。
    const acousticOnly = !heardWords || !heardWords.length;
    // 先做音色归一化，抵消用户与示范音频之间的音高/声道差异
    const norm = normalizeSpeaker(user.samples, user.sampleRate, model.samples, model.sampleRate);
    const mFeat = mfcc(model.samples, model.sampleRate);
    const uFeat = mfcc(norm.samples, user.sampleRate);
    if (!mFeat.frames.length || !uFeat.frames.length) {
      return { ok: false, reason: "音频太短，无法分析。" };
    }
    // 判断录音里到底有没有人在说话。
    // 实测：纯噪声的帧能量几乎是平的（p95-p10 只有 1~2 dB），
    // 而真人说话时这个动态范围在 60 dB 以上。所以用动态范围 + 高能量帧占比双判据，
    // 否则"只录到环境噪声"会被判成每个词都错。
    const uEnergy = uFeat.energy;
    const uSorted = Array.from(uEnergy).sort((a, b) => a - b);
    const uNoise = uSorted[Math.floor(uSorted.length * 0.1)] || 0;
    const uLoud = uSorted[Math.floor(uSorted.length * 0.95)] || 0;
    const dynamicRange = uLoud - uNoise;
    let loudFrames = 0;
    for (let i = 0; i < uEnergy.length; i++) if (uEnergy[i] > uNoise + 12) loudFrames++;
    const loudRatio = uEnergy.length ? loudFrames / uEnergy.length : 0;
    const hasSpeech = uEnergy.length >= 20 && dynamicRange >= 25 && loudRatio >= 0.08;
    const scoreAll = acousticOnly && hasSpeech;
    const modelNorm = cmvn(mFeat.frames);
    const userNorm = cmvn(uFeat.frames);

    const bounds = estimateWordBoundaries(mFeat.energy, modelWords, mFeat.hopSeconds);
    if (!bounds.length) return { ok: false, reason: "示范音频解析失败。" };

    const align = dtw(modelNorm, userNorm);
    if (!align.path.length) return { ok: false, reason: "音频对齐失败。" };

    // 建立 ref frame -> user frame 映射
    const refToUser = new Int32Array(modelNorm.length).fill(-1);
    for (const [i, j] of align.path) refToUser[i] = j;

    const alignMap = alignWords(modelWords, heardWords);
    const hopM = mFeat.hopSeconds;
    const hopU = uFeat.hopSeconds;

    const words = bounds.map((b, idx) => {
      const startFrame = Math.max(0, b.start);
      const endFrame = Math.min(modelNorm.length, Math.max(b.end, b.start + 1));
      const dists = [];
      let userStart = Infinity;
      let userEnd = -Infinity;
      for (let i = startFrame; i < endFrame; i++) {
        const j = refToUser[i];
        if (j < 0) continue;
        dists.push(cosineDistance(modelNorm[i], userNorm[j]));
        if (j * hopU < userStart) userStart = j * hopU;
        if ((j + 1) * hopU > userEnd) userEnd = (j + 1) * hopU;
      }
      const meanDist = dists.length ? dists.reduce((a, b) => a + b, 0) / dists.length : null;
      // 余弦距离 0 -> 完美, >=1.2 -> 明显不同
      let score = null;
      if (meanDist !== null) {
        score = Math.round(Math.max(0, Math.min(100, 100 - 88 * meanDist)));
      }
      const matched = alignMap[idx];
      const heard = matched ? matched.heard : null;
      const heardIdx = matched ? matched.heardIndex : null;
      return {
        word: b.word,
        score,
        status: "unknown",
        hint: null,
        modelStart: b.startTime,
        modelEnd: b.endTime,
        userStart: userStart === Infinity ? null : userStart,
        userEnd: userEnd === -Infinity ? null : userEnd,
        heard,
        heardIndex: heardIdx,
        matched: scoreAll ? true : Boolean(matched && matched.score >= 2),
        similarity: matched ? matched.score : 0
      };
    });

    // 用用户自己的分布做相对归一化（消除音色差异带来的整体偏移）
    const scored = words.filter((w) => typeof w.score === "number" && w.matched);
    const baseline = scored.length
      ? scored.map((w) => w.score).sort((a, b) => a - b)[Math.floor(scored.length / 2)]
      : null;

    for (const w of words) {
      if (!w.matched) {
        w.status = "missing";
        w.score = null;
        w.hint = null;
        continue;
      }
      let score = w.score;
      const reasons = [];
      if (w.similarity < 3 && w.heard) {
        // 识别到的词和示范词不一致 -> 强烈提示
        score = Math.min(score, 48);
        reasons.push(`浏览器把这里听成了 “${w.heard}”`);
      }
      if (baseline !== null && score < baseline - 12) score -= 6;
      w.score = Math.max(0, Math.min(100, score));

      if (w.score < 52) {
        w.status = "error";
      } else if (w.score < 72 || (baseline !== null && w.score < baseline - 8)) {
        w.status = "weak";
      } else {
        w.status = "good";
      }

      const phon = phonemeHint(w.word);
      if (w.status !== "good") {
        if (phon) {
          w.hint = { label: phon.label, zh: phon.zh, level: phon.level };
        } else if (reasons.length) {
          w.hint = { label: "识别差异", zh: reasons.join("；"), level: 2 };
        }
      } else if (reasons.length) {
        w.hint = { label: "识别差异", zh: reasons.join("；"), level: 2 };
      }
    }

    const attempted = words.filter((w) => w.matched);
    const similarity = attempted.length
      ? Math.round(attempted.reduce((a, w) => a + w.score, 0) / attempted.length)
      : null;
    // 没有转写就不知道用户实际说了几个词，宣称"覆盖 100%"是不诚实的
    const coverage = acousticOnly ? null : (words.length ? Math.round((attempted.length / words.length) * 100) : 0);
    const modelDuration = model.samples.length / model.sampleRate;
    const userDuration = norm.samples.length / user.sampleRate;

    return {
      ok: true,
      mode: "compare",
      similarity,
      coverage,
      durationRatio: modelDuration ? userDuration / modelDuration : null,
      speakerNormalized: norm.applied,
      f0User: norm.f0User ? Math.round(norm.f0User) : null,
      f0Model: norm.f0Model ? Math.round(norm.f0Model) : null,
      words,
      errors: words.filter((w) => w.status === "error" || w.status === "weak"),
      note: acousticOnly
        ? "对比模式：这次没有拿到浏览器转写，所以只用声学对齐逐词打分——红色表示这一处和示范差别较大，绿色表示接近示范。分数不是专业音素级评测。"
        : "对比模式：把你的录音与示范音频做了声学对齐，逐词给出相似度估计，并结合浏览器转写结果交叉判断。分数不是专业音素级评测。"
    };
  }

  /* ------------------------------------------------------------------ *
   * 解码（浏览器 / Node 通用）
   * ------------------------------------------------------------------ */
  function decodeWavBuffer(buffer) {
    const view = new DataView(buffer);
    const tag = (o) => String.fromCharCode(view.getUint8(o), view.getUint8(o + 1), view.getUint8(o + 2), view.getUint8(o + 3));
    if (tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new Error("不是 WAV 文件");
    let offset = 12;
    let fmt = null;
    let dataOffset = -1;
    let dataSize = 0;
    while (offset + 8 <= view.byteLength) {
      const id = tag(offset);
      const size = view.getUint32(offset + 4, true);
      if (id === "fmt ") {
        fmt = {
          format: view.getUint16(offset + 8, true),
          channels: view.getUint16(offset + 10, true),
          sampleRate: view.getUint32(offset + 12, true),
          bits: view.getUint16(offset + 22, true)
        };
      } else if (id === "data") {
        dataOffset = offset + 8;
        dataSize = size;
      }
      offset += 8 + size + (size & 1);
    }
    if (!fmt || dataOffset < 0) throw new Error("WAV 结构异常");
    const bytes = fmt.bits / 8;
    const frames = Math.floor(dataSize / (bytes * fmt.channels));
    const mono = new Float32Array(frames);
    for (let i = 0; i < frames; i++) {
      let acc = 0;
      for (let c = 0; c < fmt.channels; c++) {
        const p = dataOffset + (i * fmt.channels + c) * bytes;
        let v = 0;
        if (fmt.bits === 16) v = view.getInt16(p, true) / 32768;
        else if (fmt.bits === 8) v = (view.getUint8(p) - 128) / 128;
        else if (fmt.bits === 32) v = view.getInt32(p, true) / 2147483648;
        acc += v;
      }
      mono[i] = acc / fmt.channels;
    }
    return { samples: mono, sampleRate: fmt.sampleRate };
  }

  /** 浏览器：AudioContext 解码 */
  async function decodeInBrowser(arrayBuffer) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) throw new Error("浏览器不支持 Web Audio");
    const ctx = new Ctx();
    try {
      const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
      const channels = [];
      for (let c = 0; c < decoded.numberOfChannels; c++) channels.push(decoded.getChannelData(c));
      const mono = toMono(channels);
      return { samples: resample(mono, decoded.sampleRate, SR), sampleRate: SR };
    } finally {
      ctx.close().catch(() => {});
    }
  }

  /* ------------------------------------------------------------------ *
   * 顶层 API
   * ------------------------------------------------------------------ */
  /**
   * @param {Object} options
   * @param {string} options.modelUrl        示范音频地址
   * @param {string} options.modelText       示范音频对应的文本
   * @param {Blob}   options.userBlob        用户录音
   * @param {string} options.transcript      浏览器转写全文
   * @param {Array}  options.chunks          [{text, at, confidence}]
   * @param {Array}  [options.keywords]      题目关键词
   */
  async function compare(options) {
    const {
      modelUrl,
      modelText,
      userBlob,
      transcript = "",
      chunks = [],
      keywords = []
    } = options || {};

    const heardWords = normalizeWords(transcript);
    const result = {
      mode: "self",
      available: false,
      reason: null,
      similarity: null,
      coverage: null,
      durationRatio: null,
      words: [],
      selfWords: [],
      errors: [],
      keywordHits: [],
      speakerNormalized: false,
      f0User: null,
      f0Model: null,
      note: ""
    };

    if (!userBlob) {
      result.reason = "没有可分析的录音。";
      return result;
    }

    // 1) 解码用户录音
    let userAudio = null;
    try {
      const buf = await userBlob.arrayBuffer();
      userAudio = await decodeInBrowser(buf);
    } catch (err) {
      result.reason = `录音解码失败：${err && err.message ? err.message : err}`;
      return result;
    }

    // 2) 自评：只用用户自己的录音，任何情况下都能给出"说得清不清楚"的判断
    const self = analyzeSelf(userAudio.samples, userAudio.sampleRate, chunks, heardWords);
    result.selfWords = self.words.map((w) => ({ ...w, source: "self" }));

    // 3) 对比：读取示范音频并做声学对齐（file:// 直接打开时浏览器会拦截本地文件读取）
    let modelAudio = null;
    let modelError = null;
    if (modelUrl) {
      try {
        const res = await fetch(modelUrl, { cache: "force-cache" });
        if (!res.ok) {
          const err = new Error(`HTTP ${res.status}`);
          err.status = res.status;
          throw err;
        }
        const buf = await res.arrayBuffer();
        modelAudio = await decodeInBrowser(buf);
      } catch (err) {
        modelError = err;
      }
    }

    if (modelAudio) {
      const cmp = compareWithModel(modelAudio, userAudio, modelText, heardWords);
      if (cmp.ok) {
        result.mode = "compare";
        result.available = true;
        result.similarity = cmp.similarity;
        result.coverage = cmp.coverage;
        result.durationRatio = cmp.durationRatio;
        result.words = cmp.words.map((w) => ({ ...w, source: "compare" }));
        result.speakerNormalized = cmp.speakerNormalized;
        result.f0User = cmp.f0User;
        result.f0Model = cmp.f0Model;
        result.note = cmp.note;
        result.keywordHits = markKeywords(result.words, keywords);
        result.errors = mergeErrors(
          result.words.filter((w) => w.status === "error" || w.status === "weak"),
          result.selfWords.filter((w) => w.status === "error" || w.status === "weak")
        );
        return result;
      }
      result.reason = cmp.reason;
    } else if (modelError) {
      // 404 = 这道题还没录示范音频；其它错误多半是 file:// 被浏览器拦了。
      result.reason = modelError.status === 404
        ? "本题还没有示范音频，已改用自评模式。"
        : "示范音频读取失败（用 file:// 直接打开时浏览器会拦截本地文件读取）。";
    }

    // 4) 降级到自评模式
    result.mode = "self";
    result.available = result.selfWords.length > 0;
    result.reason = result.reason || (result.available ? null : "录音太短，没有足够的语音内容可分析。");
    result.similarity = self.similarity;
    result.words = result.selfWords;
    result.errors = result.selfWords.filter((w) => w.status === "error" || w.status === "weak");
    result.keywordHits = markKeywords(result.words, keywords);
    result.note = self.note + (modelError ? "（当前无法读取示范音频，因此退回到自评模式）" : "");
    return result;
  }

  /** 合并两路错误词，保留更严重的一条 */
  function mergeErrors(compareErrors, selfErrors) {
    const rank = (w) => (w.status === "error" ? 2 : 1);
    const out = [];
    const index = new Map();
    for (const w of [...compareErrors, ...selfErrors]) {
      const key = w.word.toLowerCase();
      if (!index.has(key)) {
        index.set(key, out.length);
        out.push(w);
      } else {
        const at = index.get(key);
        if (rank(w) > rank(out[at])) out[at] = w;
      }
    }
    return out.sort((a, b) => (a.score ?? 100) - (b.score ?? 100));
  }

  /** 在逐词结果里标记题目关键词 */
  function markKeywords(words, keywords) {
    if (!keywords || !keywords.length) return [];
    const out = [];
    for (const kw of keywords) {
      const key = String(kw).toLowerCase();
      const hit = words.find((w) => w.word.toLowerCase() === key)
        || words.find((w) => w.word.toLowerCase().includes(key) || key.includes(w.word.toLowerCase()));
      out.push({ keyword: kw, hit: Boolean(hit), score: hit && typeof hit.score === "number" ? hit.score : null, status: hit ? hit.status : "missing" });
    }
    return out;
  }

  return {
    compare,
    // 供离线测试使用
    _internals: {
      mfcc, cmvn, dtw, estimateWordBoundaries, compareWithModel, analyzeSelf,
      decodeWavBuffer, resample, toMono, normalizeWords, alignWords, countSyllables,
      phonemeHint, speechRange, estimateF0, normalizeSpeaker, cosineDistance
    }
  };
});

