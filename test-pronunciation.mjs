/**
 * 离线验证发音引擎（不进入最终交付，仅供开发校验）
 * 用法: node test-pronunciation.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const P = require("./pronunciation.js");
const I = P._internals;

const DIR = path.resolve("assets/audio");
const SR = 16000;

function load(id) {
  const buf = fs.readFileSync(path.join(DIR, `${id}.wav`));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const { samples, sampleRate } = I.decodeWavBuffer(ab);
  return { samples: I.resample(samples, sampleRate, SR), sampleRate: SR };
}

const MODELS = {
  "life-be-right-there": "I'll be right there.",
  "life-cafe": "Hi, could I get a large oat latte with an extra shot, please?",
  "life-directions": "Excuse me, could you tell me how to get to the train station from here?",
  "life-hotel": "Hi, I have a reservation under Chen. I’d like a quiet room away from the street, if possible.",
  "life-meeting": "Something has come up this afternoon. Could we move our meeting to Thursday?",
  "life-return": "I bought this yesterday, but it isn’t working. Could I exchange it for another one?",
  "ielts-free-time": "I usually spend my free time reading or going for a long walk. Reading helps me slow down after work, and walking gives me a chance to clear my head.",
  "ielts-hometown": "My hometown is a medium-sized city near the coast. What I like most is that it feels busy without being overwhelming, and the waterfront is easy to reach.",
  "ielts-relax": "A place I often visit to relax is a small riverside park near my apartment. I go there two or three times a week, usually in the evening. I like it because the path is quiet, and I can listen to the water while I walk.",
  "ielts-travel": "I think people value the sense of discovery that travel creates. A new place interrupts familiar routines and makes ordinary details feel interesting again. Cost matters, but many people see it as an investment in perspective rather than simple entertainment.",
  "ielts-skill": "A skill I learned outside school was basic photography. I learned it by watching short tutorials and taking the same photograph every day for a month. The turning point was learning to notice light, which made even ordinary scenes look more interesting.",
  "toefl-study": "I prefer studying alone, mainly because I can control the pace. When I study by myself, I can spend extra time on difficult material instead of moving on with a group. I also find it easier to concentrate without changing my routine for other people.",
  "toefl-campus": "I think first-year students should live on campus because it helps them adapt to university life. Students can meet classmates more easily, and the short distance to classes reduces stress during the first semester.",
  "toefl-dorm": "The student is concerned that converting the dorm lounge would remove an important quiet study space. She explains that many residents use the lounge in the evening because their rooms are often crowded and noisy.",
  "toefl-choice": "The study illustrates choice overload by showing that more options can make a choice more difficult. One group had many possible essay topics and delayed deciding, while the group with fewer options selected one more quickly.",
  "toefl-technology": "I agree that technology can make it harder to focus, especially when people keep several kinds of notifications open. A single message can pull someone away from a task, and it may take several minutes to return to the same level of concentration."
};

let failures = 0;
function check(label, ok, detail = "") {
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${label}${detail ? "  " + detail : ""}`);
  if (!ok) failures++;
}

/* ---------- 1. 单词边界估计 ---------- */
console.log("\n[1] 单词边界估计 (life-cafe)");
{
  const a = load("life-cafe");
  const feat = I.mfcc(a.samples, a.sampleRate);
  const words = I.normalizeWords(MODELS["life-cafe"]);
  const bounds = I.estimateWordBoundaries(feat.energy, words, feat.hopSeconds);
  console.log(`  音频 ${(a.samples.length / SR).toFixed(2)}s, ${words.length} 词, ${feat.frames.length} 帧`);
  for (const b of bounds) {
    console.log(`    ${b.word.padEnd(9)} ${b.startTime.toFixed(2)}s -> ${b.endTime.toFixed(2)}s  (${(b.endTime - b.startTime).toFixed(2)}s)`);
  }
  const covered = bounds[bounds.length - 1].endTime;
  check("边界覆盖整段语音", covered > 2.5 && covered < 6.0, `end=${covered.toFixed(2)}s`);
  const widths = bounds.map((b) => b.endTime - b.startTime);
  check("无零宽/负宽片段", widths.every((w) => w > 0.02), `min=${Math.min(...widths).toFixed(3)}`);
  check("各词时长合理(0.08~1.6s)", widths.every((w) => w > 0.08 && w < 1.6), `max=${Math.max(...widths).toFixed(2)}`);
}

/* ---------- 2. 自身对比 ---------- */
console.log("\n[2] 自身对比 (基准应很高)");
{
  for (const id of ["life-be-right-there", "life-cafe", "ielts-free-time", "toefl-choice"]) {
    const a = load(id);
    const words = I.normalizeWords(MODELS[id]);
    const r = I.compareWithModel(a, a, MODELS[id], words);
    console.log(`  ${id.padEnd(18)} similarity=${r.similarity} coverage=${r.coverage}% errors=${r.errors.length}`);
    check(`${id} 自身相似度 >= 85`, r.similarity >= 85, `got ${r.similarity}`);
    check(`${id} 自身无错误词`, r.errors.length === 0, `got ${r.errors.length}: ${r.errors.map((e) => e.word).join(",")}`);
  }
}

/* ---------- 3. 交叉对比 ---------- */
console.log("\n[3] 交叉对比 (不同句子应明显更低)");
{
  const a = load("life-cafe");
  const b = load("life-directions");
  const words = I.normalizeWords(MODELS["life-cafe"]);
  const r = I.compareWithModel(a, b, MODELS["life-cafe"], words);
  console.log(`  life-cafe vs life-directions similarity=${r.similarity} coverage=${r.coverage}%`);
  check("交叉对比明显低于自身", r.similarity < 70, `got ${r.similarity}`);
}

/* ---------- 4. 注入错误：把某个词替换成噪声 ---------- */
console.log("\n[4] 注入错误检测 (把指定词的音频替换为噪声/其它片段)");
{
  const id = "life-cafe";
  const model = MODELS[id];
  const a = load(id);
  const words = I.normalizeWords(model);
  const feat = I.mfcc(a.samples, a.sampleRate);
  const bounds = I.estimateWordBoundaries(feat.energy, words, feat.hopSeconds);

  const target = "latte";
  const ti = words.indexOf(target);
  const bnd = bounds[ti];
  console.log(`  目标词 "${target}" 位于 ${bnd.startTime.toFixed(2)}s - ${bnd.endTime.toFixed(2)}s`);

  // 破坏：把该词替换成 "please" 的音频片段（真实的发音错误场景）
  const pi = words.indexOf("please");
  const pb = bounds[pi];
  const corrupted = Float32Array.from(a.samples);
  const srcStart = Math.floor(pb.startTime * SR);
  const srcEnd = Math.floor(pb.endTime * SR);
  const dstStart = Math.floor(bnd.startTime * SR);
  const dstEnd = Math.floor(bnd.endTime * SR);
  const segLen = Math.min(srcEnd - srcStart, dstEnd - dstStart);
  for (let i = 0; i < segLen; i++) corrupted[dstStart + i] = a.samples[srcStart + i];

  const r = I.compareWithModel(a, { samples: corrupted, sampleRate: SR }, model, words);
  console.log(`  similarity=${r.similarity} coverage=${r.coverage}%`);
  for (const w of r.words) {
    const mark = w.status === "error" ? " <== 错误" : w.status === "weak" ? " <== 偏弱" : "";
    console.log(`    ${w.word.padEnd(9)} score=${String(w.score).padStart(3)} status=${w.status.padEnd(8)}${mark}`);
  }
  const flagged = r.errors.map((e) => e.word);
  check("被破坏的词被标记为错误", flagged.includes(target), `flagged=[${flagged.join(",")}]`);
  check("错误词数量 <= 4 (未大面积误报)", r.errors.length <= 4, `got ${r.errors.length}`);
}

/* ---------- 5. 注入错误：把某个词替换成白噪声 ---------- */
console.log("\n[5] 注入错误检测 (替换为白噪声)");
{
  const id = "life-directions";
  const model = MODELS[id];
  const a = load(id);
  const words = I.normalizeWords(model);
  const feat = I.mfcc(a.samples, a.sampleRate);
  const bounds = I.estimateWordBoundaries(feat.energy, words, feat.hopSeconds);
  const target = "station";
  const ti = words.indexOf(target);
  const bnd = bounds[ti];
  const corrupted = Float32Array.from(a.samples);
  const dstStart = Math.floor(bnd.startTime * SR);
  const dstEnd = Math.floor(bnd.endTime * SR);
  let seed = 12345;
  for (let i = dstStart; i < dstEnd; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    corrupted[i] = ((seed / 0x7fffffff) * 2 - 1) * 0.25;
  }
  const r = I.compareWithModel(a, { samples: corrupted, sampleRate: SR }, model, words);
  console.log(`  similarity=${r.similarity}`);
  for (const w of r.words) {
    const mark = w.status === "error" ? " <== 错误" : w.status === "weak" ? " <== 偏弱" : "";
    console.log(`    ${w.word.padEnd(9)} score=${String(w.score).padStart(3)} status=${w.status.padEnd(8)}${mark}`);
  }
  const flagged = r.errors.map((e) => e.word);
  check("被噪声替换的词被标记", flagged.includes(target), `flagged=[${flagged.join(",")}]`);
}

/**
 * 真正的"变速不变调"：重叠相加 (OLA)。
 * 重采样只能同时改变时长和音高，做不到只变时长，所以这里必须自己实现时间伸缩。
 */
function timeStretch(samples, factor, sampleRate) {
  const win = Math.round(0.04 * sampleRate);
  const hopIn = Math.round(0.02 * sampleRate);
  const hopOut = Math.round(hopIn * factor);
  const nFrames = Math.max(1, Math.floor((samples.length - win) / hopIn));
  const out = new Float32Array(win + nFrames * hopOut);
  const w = new Float32Array(win);
  for (let i = 0; i < win; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (win - 1));
  for (let f = 0; f < nFrames; f++) {
    const off = f * hopIn;
    const ooff = f * hopOut;
    for (let i = 0; i < win; i++) out[ooff + i] += samples[off + i] * w[i];
  }
  return out;
}

/* ---------- 6. 变速鲁棒性 (同音高、慢 25%) ---------- */
console.log("\n[6] 变速鲁棒性 (同音高、慢 25%)");
{
  const id = "life-cafe";
  const a = load(id);
  const words = I.normalizeWords(MODELS[id]);
  const slowed = timeStretch(a.samples, 1.25, SR);
  const r = I.compareWithModel(a, { samples: slowed, sampleRate: SR }, MODELS[id], words);
  console.log(`  时长 ${(slowed.length / SR).toFixed(2)}s (原始 ${(a.samples.length / SR).toFixed(2)}s)  similarity=${r.similarity} durationRatio=${r.durationRatio.toFixed(2)} errors=${r.errors.length} vtlN=${r.speakerNormalized} f0=${r.f0User}->${r.f0Model}`);
  check("变速后相似度仍然 >= 70", r.similarity >= 70, `got ${r.similarity}`);
  check("变速后错误词 <= 4", r.errors.length <= 4, `got ${r.errors.length}: ${r.errors.map((e) => e.word).join(",")}`);
}

/* ---------- 6b. 不同音色鲁棒性 (基频 +30%) ---------- */
console.log("\n[6b] 不同音色鲁棒性 (基频 +30%)");
{
  const id = "life-cafe";
  const a = load(id);
  const words = I.normalizeWords(MODELS[id]);
  const shifted = I.resample(a.samples, SR, Math.round(SR * 1.3));
  const r = I.compareWithModel(a, { samples: shifted, sampleRate: SR }, MODELS[id], words);
  console.log(`  similarity=${r.similarity} durationRatio=${r.durationRatio.toFixed(2)} errors=${r.errors.length} vtlN=${r.speakerNormalized} f0=${r.f0User}->${r.f0Model}`);
  check("变音色后相似度 >= 72 (归一化生效)", r.similarity >= 72, `got ${r.similarity}`);
  check("变音色后错误词 <= 4", r.errors.length <= 4, `got ${r.errors.length}: ${r.errors.map((e) => e.word).join(",")}`);
}

/* ---------- 6c. 基频估计 ---------- */
console.log("\n[6c] 基频估计");
{
  for (const id of ["life-be-right-there", "life-cafe", "ielts-free-time", "toefl-choice"]) {
    const a = load(id);
    const f0 = I.estimateF0(a.samples, a.sampleRate);
    console.log(`  ${id.padEnd(18)} f0=${f0 ? f0.toFixed(1) : "null"} Hz`);
    check(`${id} 基频在合理区间(70-320Hz)`, f0 && f0 > 70 && f0 < 320, `got ${f0}`);
  }
}

/* ---------- 7. 文本对齐 ---------- */
console.log("\n[7] 转写文本对齐");
{
  const demo = I.normalizeWords("Hi could I get a large oat latte with an extra shot please");
  const heard = I.normalizeWords("hi could i get a large oat latte with an extra shot please");
  const map = I.alignWords(demo, heard);
  check("完全一致时全部命中", map.every((m) => m.score >= 3), JSON.stringify(map.map((m) => m.score)));

  const heard2 = I.normalizeWords("hi could i get a large oat latte with extra shot please");
  const map2 = I.alignWords(demo, heard2);
  check("漏掉一个词时该词标记为未命中", map2.find((m, i) => demo[i] === "an")?.score === 0, `an -> ${JSON.stringify(map2.find((m, i) => demo[i] === "an"))}`);

  const heard3 = I.normalizeWords("hi could i get a large oat latte with an extra shop please");
  const map3 = I.alignWords(demo, heard3);
  const shot = map3.find((m, i) => demo[i] === "shot");
  check("拼错的词被低分标记", shot && shot.score < 3, JSON.stringify(shot));
}

/* ---------- 8. 音节数 ---------- */
console.log("\n[8] 音节数启发式");
{
  const cases = [["hello", 2], ["extra", 2], ["shot", 1], ["please", 1], ["reservation", 4], ["photography", 4], ["technology", 4], ["station", 2], ["quiet", 2], ["morning", 2]];
  for (const [w, want] of cases) {
    const got = I.countSyllables(w);
    check(`${w} -> ${want}`, got === want, `got ${got}`);
  }
}

/* ---------- 9. 没有浏览器转写时仍要能逐词打分 ---------- */
console.log("\n[9] 无转写时的声学逐词打分（浏览器识别不可用的常见情况）");
{
  const id = "life-cafe";
  const a = load(id);
  const words = I.normalizeWords(MODELS[id]);
  const bnd = I.estimateWordBoundaries(I.mfcc(a.samples, a.sampleRate).energy, words, I.mfcc(a.samples, a.sampleRate).hopSeconds)
    .find((b) => b.word === "latte");
  const corrupted = new Float32Array(a.samples);
  const srcStart = Math.floor(bnd.startTime * SR);
  const srcEnd = Math.floor(bnd.endTime * SR);
  const dstStart = srcStart;
  const dstEnd = srcEnd;
  let seed = 999;
  for (let i = dstStart; i < dstEnd; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    corrupted[i] = ((seed / 0x7fffffff) * 2 - 1) * 0.25;
  }
  // heardWords 传空数组 = 浏览器没有吐出任何转写
  const r = I.compareWithModel(a, { samples: corrupted, sampleRate: SR }, MODELS[id], []);
  const missing = r.words.filter((w) => w.status === "missing");
  const flagged = r.errors.map((e) => e.word);
  console.log(`  similarity=${r.similarity} coverage=${r.coverage} 未提及=${missing.length} 被标记=[${flagged.join(",")}]`);
  check("无转写时没有词被判为未提及", missing.length === 0, `got ${missing.length}`);
  check("无转写时仍能算出总相似度", typeof r.similarity === "number" && r.similarity > 0, `got ${r.similarity}`);
  check("无转写时被破坏的词仍被标记", flagged.includes("latte"), `got [${flagged.join(",")}]`);
  check("无转写时不说覆盖率（不诚实）", r.coverage === null, `got ${r.coverage}`);
}

/* ---------- 9b. 只录到环境噪声时不能给每个词判错 ---------- */
console.log("\n[9b] 纯噪声录音不能被判成「每个词都错」");
{
  const id = "life-cafe";
  const a = load(id);
  const words = I.normalizeWords(MODELS[id]);
  const noise = new Float32Array(Math.round(5 * SR));
  let seed = 31337;
  for (let i = 0; i < noise.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    noise[i] = ((seed / 0x7fffffff) * 2 - 1) * 0.05;
  }
  const r = I.compareWithModel(a, { samples: noise, sampleRate: SR }, MODELS[id], []);
  const missing = r.words.filter((w) => w.status === "missing");
  console.log(`  similarity=${r.similarity} 未提及=${missing.length}/${r.words.length} 错误词=${r.errors.length}`);
  check("纯噪声不会被判成逐词错误", r.errors.length === 0, `got ${r.errors.length}`);
  check("纯噪声时所有词都算「未提及」", missing.length === r.words.length, `got ${missing.length}/${r.words.length}`);
  check("纯噪声时不给出总相似度", r.similarity === null, `got ${r.similarity}`);
}

/* ---------- 10. 缩读与展开形式要能对上 ---------- */
console.log("\n[10] 缩读 vs 展开形式（I'll / I will）");
{
  const id = "life-be-right-there";
  const a = load(id);
  const model = MODELS[id];
  const modelWords = I.normalizeWords(model);
  console.log(`  示范文本: ${modelWords.join(" | ")}`);

  // 学生把缩读展开成 "I will be right there"
  const heardExpanded = I.normalizeWords("I will be right there");
  const map = I.alignWords(modelWords, heardExpanded);
  console.log(`  展开形式的转写对齐: ${map.map((m) => `${m.heard}:${m.score}`).join(" ")}`);
  check("缩读词在展开转写里仍能对上", map[0].score >= 2, `got ${map[0].score}`);

  const r = I.compareWithModel(a, a, model, heardExpanded);
  const missing = r.words.filter((w) => w.status === "missing");
  console.log(`  similarity=${r.similarity} 未提及=${missing.length}/${r.words.length}`);
  check("展开形式的转写不会被判成未提及", missing.length === 0, `got [${missing.map((m) => m.word).join(",")}]`);

  // 反向：示范写完整形式，学生念缩读
  const modelFull = I.normalizeWords("I will be right there.");
  const map2 = I.alignWords(modelFull, I.normalizeWords("I'll be right there"));
  console.log(`  完整示范 vs 缩读转写: ${map2.map((m) => `${m.heard}:${m.score}`).join(" ")}`);
  check("完整示范也能对上缩读转写", map2[0].score >= 2, `got ${map2[0].score}`);
}

console.log(`\n==== ${failures === 0 ? "全部通过" : failures + " 项未通过"} ====\n`);
process.exit(failures ? 1 : 0);

