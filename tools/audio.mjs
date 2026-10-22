/**
 * SpeekBetter 示范音频工具
 * ------------------------------------------------------------------
 *   node tools/audio.mjs              体检：哪些句子有音频、格式对不对
 *   node tools/audio.mjs --checklist  生成 RECORDING.md 录音清单
 *
 * 数据源：data/modules.js（模块是唯一数据源，体检按模块分组）
 *
 * 规范（引擎的硬要求，convert-audio.html 会自动转成这个格式）：
 *   PCM / 单声道 / 22050 Hz / 16 bit，文件名 = 句子 id.wav
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, '')), '..');
const AUDIO_DIR = path.join(ROOT, 'assets', 'audio');
const MODULES_FILE = path.join(ROOT, 'data', 'modules.js');

const sandbox = { window: {} };
new Function('window', fs.readFileSync(MODULES_FILE, 'utf8'))(sandbox.window);
const MODULES = sandbox.window.SPEEKBETTER_MODULES || [];

// 把模块摊平成句子清单，并记住每句属于哪个模块
const SENTENCES = [];
for (const module of MODULES) {
  for (const sentence of module.sentences || []) {
    SENTENCES.push({
      id: sentence.id,
      title: sentence.title || sentence.prompt,
      text: sentence.model || sentence.prompt,
      track: module.track,
      moduleId: module.id,
      moduleTitle: module.title,
    });
  }
}

const TRACK_NAMES = { life: '生活对话', work: '职场英语', travel: '旅行英语', cet: '四六级', ielts: '雅思', toefl: '托福' };

const EXPECT = { sampleRate: 22050, bits: 16, channels: 1 };

function readWavHeader(file) {
  const buf = fs.readFileSync(file);
  if (buf.length < 44) return { error: '文件太小，不像是 WAV' };
  const tag = (o) => buf.toString('ascii', o, o + 4);
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return { error: '不是 WAV 文件（RIFF/WAVE 头不对）' };
  let offset = 12;
  let fmt = null;
  let dataSize = 0;
  let dataOffset = -1;
  while (offset + 8 <= buf.length) {
    const id = tag(offset);
    const size = buf.readUInt32LE(offset + 4);
    if (id === 'fmt ') {
      fmt = {
        audioFormat: buf.readUInt16LE(offset + 8),
        channels: buf.readUInt16LE(offset + 10),
        sampleRate: buf.readUInt32LE(offset + 12),
        bits: buf.readUInt16LE(offset + 22),
      };
    } else if (id === 'data') {
      dataSize = size;
      dataOffset = offset + 8;
    }
    offset += 8 + size + (size % 2);
  }
  if (!fmt) return { error: '缺少 fmt 段' };
  if (dataOffset < 0) return { error: '缺少 data 段' };
  const bytesPerSample = fmt.bits / 8;
  const frames = fmt.channels ? Math.floor(dataSize / (bytesPerSample * fmt.channels)) : 0;
  return { ...fmt, frames, seconds: frames / fmt.sampleRate, dataSize };
}

function estimateSeconds(text) {
  // 英文按每分钟 130 词粗估，只用来给录音长度一个参考区间
  const words = String(text).trim().split(/\s+/).filter(Boolean).length;
  return (words / 130) * 60;
}

const files = fs.existsSync(AUDIO_DIR) ? fs.readdirSync(AUDIO_DIR).filter((f) => f.toLowerCase().endsWith('.wav')) : [];
// 非 wav 的源文件（手机录音、mp3 等）：浏览器能直接播，但体检和 Node 离线测试只认 wav
const others = fs.existsSync(AUDIO_DIR) ? fs.readdirSync(AUDIO_DIR).filter((f) => !f.toLowerCase().endsWith('.wav')) : [];

const rows = SENTENCES.map((sentence) => {
  const file = path.join(AUDIO_DIR, `${sentence.id}.wav`);
  const exists = fs.existsSync(file);
  let info = null;
  if (exists) info = readWavHeader(file);
  return { ...sentence, exists, info, expected: estimateSeconds(sentence.text) };
});

const extra = files.filter((f) => !SENTENCES.some((s) => `${s.id}.wav` === f));

function isFormatOk(row) {
  if (!row.exists || !row.info || row.info.error) return false;
  return row.info.sampleRate === EXPECT.sampleRate && row.info.bits === EXPECT.bits && row.info.channels === EXPECT.channels;
}

function report() {
  const ok = rows.filter(isFormatOk);
  const bad = rows.filter((r) => r.exists && !isFormatOk(r));
  const missing = rows.filter((r) => !r.exists);

  console.log(`\n示范音频体检：${MODULES.length} 个模块 · ${SENTENCES.length} 句\n`);
  console.log(`  正常      ${ok.length}`);
  console.log(`  格式不对  ${bad.length}`);
  console.log(`  还没录    ${missing.length}`);
  if (extra.length) console.log(`  多余文件  ${extra.length}：${extra.join(', ')}`);
  if (others.length) {
    console.log(`  其它格式  ${others.length}：${others.join(', ')}`);
    console.log('    （浏览器能直接播 mp3，但库内统一用 wav；转格式：tools/convert-audio.html 或 ffmpeg）');
  }

  console.log('\n按模块：');
  for (const module of MODULES) {
    const list = rows.filter((r) => r.moduleId === module.id);
    const done = list.filter(isFormatOk).length;
    const pending = list.length - done;
    const mark = pending === 0 ? '✅' : '⬜';
    console.log(`  ${mark} ${module.title}（${TRACK_NAMES[module.track] || module.track}）  ${done}/${list.length} 句已录${pending ? `，还差 ${pending} 句` : ''}`);
  }

  if (bad.length) {
    console.log('\n格式不对的：');
    for (const r of bad) {
      const i = r.info;
      const why = i.error
        ? i.error
        : `${i.sampleRate}Hz/${i.bits}bit/${i.channels}ch（需要 ${EXPECT.sampleRate}Hz/${EXPECT.bits}bit/${EXPECT.channels}ch）`;
      console.log(`  ${r.id}.wav  ${why}`);
    }
    console.log('\n  用 tools/convert-audio.html 把文件拖进去就能自动转格式。');
  }

  if (missing.length) {
    console.log('\n还没录的（node tools/audio.mjs --checklist 可以生成带文本的清单）：');
    console.log('  ' + missing.map((r) => r.id).join(', '));
  }

  const tooShort = ok.filter((r) => r.info.seconds < Math.max(1.2, r.expected * 0.55));
  if (tooShort.length) {
    console.log('\n偏短的（可能念漏了）：');
    for (const r of tooShort) console.log(`  ${r.id}.wav  ${r.info.seconds.toFixed(1)}s，按 ${r.expected.toFixed(1)}s 估算可能念少了`);
  }
  console.log('');
  return { ok: ok.length, bad: bad.length, missing: missing.length };
}

function checklist() {
  const lines = [];
  lines.push('# 示范音频录音清单');
  lines.push('');
  lines.push('按模块录。每一句念一遍，导出成 WAV，命名成 `<句子 id>.wav`，放进 `assets/audio/`。');
  lines.push('');
  lines.push('**格式要求**：PCM / 单声道 / 22050 Hz / 16 bit');
  lines.push('');
  lines.push('> 不用自己转格式：把手机录的原始文件拖进 `tools/convert-audio.html`，');
  lines.push('> 浏览器会直接转好并按句子 id 命名下载。');
  lines.push('');
  lines.push('> 生活/职场/旅行句念屏幕上那一句；雅思/托福/四六级句念「示范回答」那一段。');
  lines.push('');

  let recorded = 0;
  for (const module of MODULES) {
    const list = rows.filter((r) => r.moduleId === module.id);
    const done = list.filter(isFormatOk).length;
    recorded += list.filter((r) => r.exists).length;
    lines.push(`## ${module.title}　\`${TRACK_NAMES[module.track] || module.track}\`　（${done}/${list.length} 已录）`);
    lines.push('');
    lines.push(`> ${module.context}`);
    lines.push('');
    for (const row of list) {
      const state = row.exists ? (row.info.error ? '⚠️ 格式不对' : '✅ 已有') : '⬜ 待录';
      lines.push(`### ${row.id} — ${row.title}　\`${state}\``);
      lines.push('');
      lines.push(`> ${row.text}`);
      lines.push('');
      lines.push(`- 建议长度：约 ${row.expected.toFixed(1)} 秒（念太快会偏短）`);
      lines.push(`- 文件名：\`assets/audio/${row.id}.wav\``);
      lines.push('');
    }
  }
  lines.push('---');
  lines.push('');
  lines.push(`共 ${MODULES.length} 个模块 / ${SENTENCES.length} 句，已录 ${recorded} 句。`);
  lines.push('');
  lines.push('录完跑一次 `node tools/audio.mjs` 体检。');
  lines.push('');

  const out = path.join(ROOT, 'RECORDING.md');
  fs.writeFileSync(out, lines.join('\n'), 'utf8');
  console.log(`已生成 ${out}`);
}

if (process.argv.includes('--checklist')) checklist();
else report();
