# 英语口语纠音网站：详细网页布局与开发方案

根据你的需求，建议第一版定位为一个面向中国英语初学者、大学生和四六级学习者的美式英语发音训练网站。先使用原生 HTML、CSS 和 JavaScript，开发可以直接运行的网页原型，不急于引入复杂框架或付费 AI 服务。

第一版的重点是让用户完成完整的学习流程：

选择练习 → 听美式标准发音 → 自己录音 → 查看练习反馈 → 再次跟读 → 查看学习记录。

需要明确：第一版可以实现真实录音、音频回放、部分浏览器的语音识别和交互式练习；如果暂时没有接入专业发音评估服务，发音分数应明确标注为模拟数据，不能将其当作真实的 AI 纠音结果。

## 一、整体网站结构

建议使用六个主要页面，首页负责学习导航，纠音工作台负责核心训练，其他页面围绕它提供课程和复习支持。

## SpeakBetter

American English Pronunciation Coach

学习仪表盘 Dashboard

今日目标 · 学习进度 · 快速开始 · 最近练习

口语纠音

录音、跟读、反馈

音标训练

元音、辅音、易混音

四六级句子

高频词汇、长句跟读

学习报告

练习历史、薄弱项目

辅助页面：每日一句、个人设置、帮助与隐私政策。

建议第一版的导航名称统一使用中英文，既方便国内学生理解，也有利于用户在练习中熟悉英语界面词汇。

## 二、首页网页布局：Dashboard 仪表盘

桌面端建议采用经典的左侧固定导航栏 + 顶部工具栏 + 中央内容区的布局。这样后期增加课程、学习报告和 AI 功能时，不需要推翻原有设计。

SpeakBetter

Dashboard

Pronunciation

Phonics

CET Practice

Progress

## Good afternoon!

Ready to improve your pronunciation?

YOUR DAILY GOAL

# 5 minutes of speaking

Listen · Record · Improve

Start Practice →

Practice time

# 25 min

Sentences

# 18

### Recommended lessons

American vowel sounds

8 exercises · Beginner

CET-4 sentence practice

10 sentences · Intermediate

Responsive dashboard concept · Sample statistics only

### 首页内容的具体安排

| 区域   | 内容                | 设计要求           |
| ---- | ----------------- | -------------- |
| 侧边栏  | 首页、纠音、音标、四六级、报告   | 当前页面高亮         |
| 顶部栏  | 页面标题、用户设置         | 高度保持统一         |
| 欢迎区域 | 欢迎语、今日目标          | 直接展示主要操作       |
| 数据卡片 | 练习时长、完成句子数、连续学习天数 | 真实数据或清楚标记的示例数据 |
| 推荐课程 | 音标、单词、四六级句子       | 卡片可点击          |
| 最近练习 | 上次学习内容、继续练习       | 方便返回上次任务       |

移动端应将左侧导航收起，使用顶部菜单或底部导航，不要简单地把桌面版压缩到手机屏幕上。

## 三、核心页面的详细规划

### 1. 口语纠音页面 `/practice.html`

这是第一版最值得优先完成的页面。

## Pronunciation Studio

American English

PRACTICE SENTENCE · 01

# I usually get up at seven.

我通常七点起床。

Listen to American pronunciation

Listen

播放标准音频

Record

录制自己的发音

### Your practice

My recording

录音后显示音频播放控件

Feedback area

识别文本、目标句子差异、需加强的发音，以及再次练习入口。

Try again

Next sentence

页面功能分为四个模块：

- SentencePanel：显示英语原句、中文释义、音标和关键词。
- AudioPlayer：播放标准音频，后期支持慢速播放。
- Recorder：申请麦克风权限、录音、停止录音、回放。
- FeedbackPanel：展示识别结果、差异分析和复练建议。

### 2. 音标训练页面 `/sounds.html`

建议按照美国英语学习需求安排以下内容：

| 训练类别      | 练习示例                  |
| --------- | --------------------- |
| 短元音与长元音对比 | ship / sheep          |
| 前元音       | /ɪ/、/iː/              |
| 元音对比      | /æ/、/ɛ/               |
| 辅音        | /θ/、/ð/、/r/、/l/       |
| 单词重音      | `TAble`、`beGIN`       |
| 句子节奏      | 连读、弱读、重音和停顿           |
| 美式特色      | 卷舌音 /r/、部分口音中的 flap T |

以上例词用于教学设计；音标符号、示范音频和评分标准应由可靠的美式英语发音资料校验。

每个音标卡片应提供音标符号、发音部位提示、示范音频、例词和录音练习入口。

### 3. 四六级句子练习 `/cet-practice.html`

这是区别于普通发音网站的一个特色模块。

可以将课程分成：

- 四级高频词汇与短句。
- 四级长句和段落跟读。
- 六级学术词汇与复杂句。
- 听力材料跟读。
- 考前高频发音难点复习。

每个练习条目至少保存：英语原文、中文释义、目标词汇、音频路径、难度级别和所属课程。注意不要未经授权直接复制整套付费教材或考试材料。

### 4. 学习报告 `/progress.html`

第一版不需要复杂的数据可视化。展示每日练习次数、累计录音时长、已完成句子、近期练习列表和需要复习的音素即可。

初期可以用 `localStorage` 保存学习记录；它只适合当前浏览器中的原型数据，不等同于具有账号同步功能的数据库。

## 四、项目文件目录

建议采用以下结构，既适合初学者理解，也便于后续扩展。

```
speakbetter/
│
├── index.html
├── practice.html
├── sounds.html
├── cet-practice.html
├── progress.html
├── settings.html
│
├── assets/
│   ├── images/
│   │   └── logo.svg
│   └── audio/
│       ├── sentence-001.mp3
│       └── sentence-002.mp3
│
├── css/
│   ├── style.css
│   ├── layout.css
│   ├── components.css
│   └── responsive.css
│
├── js/
│   ├── main.js
│   ├── navigation.js
│   ├── recorder.js
│   ├── audio-player.js
│   ├── practice.js
│   ├── sounds.js
│   ├── progress.js
│   └── storage.js
│
├── data/
│   ├── sentences.js
│   ├── phonics.js
│   └── cet-lessons.js
│
└── README.md
```

### 各目录的作用

- `index.html`：首页仪表盘。
- `practice.html`：录音与纠音工作台。
- `sounds.html`：音标及发音专项训练。
- `cet-practice.html`：四六级练习。
- `progress.html`：学习记录。
- `css/`：分离全局样式、组件样式和响应式布局。
- `js/`：每个文件负责一类交互，避免把全部代码塞进一个文件。
- `data/`：存储课程和句子练习数据。
- `assets/audio/`：存放获得合法使用授权的标准美式英语示范音频。

第一版不需要构建工具、数据库或前端框架。多个页面共享的导航栏可以先通过统一 HTML 结构维护；如果后续页面增多，再考虑模板复用或组件化。

### 实际交付目录（当前形态）

上面是最初的"多页面"设想。实际交付时做成了**单页三视图**（练习室 / 题库 / 进度），
因为三个视图共用同一份练习状态，拆成三个页面反而要同步状态：

```
speekbetter/
├── index.html              单页三视图：练习室 / 题库 / 进度
├── app.js                  界面逻辑（含题库读取、学习者、导入导出）
├── styles.css              全部样式（含响应式断点）
├── pronunciation.js        发音对比引擎（零依赖）
├── data/
│   └── modules.js          题库唯一来源：6 个模块 / 36 句 / 3 难度
├── assets/
│   └── audio/              示范音频：<句子id>.wav，PCM 22.05kHz 16bit 单声道
├── tools/
│   ├── audio.mjs           音频体检 + 生成录音清单（按模块分组）
│   ├── convert-audio.html   浏览器内转格式（m4a/mp3 → 标准 WAV）
│   └── extract-sentences.html 从长音频切句并批量绑定句子 id
├── test-pronunciation.mjs  引擎离线回归（10 组 / 50 断言）
├── server.mjs              零依赖静态服务器（Node 标准库）
├── start-server.bat        Windows 一键启动
├── RECORDING.md            录音清单：每题原文、建议时长、目标文件名、当前状态
└── speekbetter.md          本文档
```

> 没有 `css/`、`js/` 子目录，没有 `package.json`，没有构建步骤——
> 改完刷新就是最新的。

## 五、组件设计与数据结构

### 1. 核心 JavaScript 组件

| 组件               | 职责     | 第一版要求        |
| ---------------- | ------ | ------------ |
| `Navigation`     | 页面导航   | 可切换页面        |
| `LessonCard`     | 课程卡片   | 显示标题、难度和练习入口 |
| `AudioPlayer`    | 标准音频播放 | 播放、暂停、进度     |
| `Recorder`       | 录制用户语音 | 开始、停止、回放     |
| `SentencePanel`  | 句子展示   | 原文、翻译、音标     |
| `FeedbackPanel`  | 练习反馈   | 区分模拟反馈和真实评测  |
| `ProgressCard`   | 学习统计   | 读取练习记录       |
| `StorageService` | 本地数据管理 | 保存和读取练习历史    |

推荐的调用关系是：

\#chatgpt-mermaid-\_r_17i\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(13, 13, 13);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_17i\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_17i\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_17i\_ .error-icon{fill:rgb(243, 243, 243);}#chatgpt-mermaid-\_r_17i\_ .error-text{fill:rgb(13, 13, 13);stroke:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_17i\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_17i\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_17i\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_17i\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_17i\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_17i\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_17i\_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_17i\_ .marker.cross{stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_17i\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_17i\_ p{margin:0;}#chatgpt-mermaid-\_r_17i\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_17i\_ .cluster-label text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_17i\_ .cluster-label span{color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_17i\_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-\_r_17i\_ .label text,#chatgpt-mermaid-\_r_17i\_ span{fill:rgb(13, 13, 13);color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_17i\_ .node rect,#chatgpt-mermaid-\_r_17i\_ .node circle,#chatgpt-mermaid-\_r_17i\_ .node ellipse,#chatgpt-mermaid-\_r_17i\_ .node polygon,#chatgpt-mermaid-\_r_17i\_ .node path{fill:rgb(222, 234, 251);stroke:rgb(83, 154, 248);stroke-width:1px;}#chatgpt-mermaid-\_r_17i\_ .rough-node .label text,#chatgpt-mermaid-\_r_17i\_ .node .label text,#chatgpt-mermaid-\_r_17i\_ .image-shape .label,#chatgpt-mermaid-\_r_17i\_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-\_r_17i\_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-\_r_17i\_ .rough-node .label,#chatgpt-mermaid-\_r_17i\_ .node .label,#chatgpt-mermaid-\_r_17i\_ .image-shape .label,#chatgpt-mermaid-\_r_17i\_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-\_r_17i\_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-\_r_17i\_ .root .anchor path{fill:rgb(143, 143, 143)!important;stroke-width:0;stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_17i\_ .arrowheadPath{fill:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_17i\_ .edgePath .path{stroke:rgb(143, 143, 143);stroke-width:1px;}#chatgpt-mermaid-\_r_17i\_ .flowchart-link{stroke:rgb(143, 143, 143);fill:none;}#chatgpt-mermaid-\_r_17i\_ .edgeLabel{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-\_r_17i\_ .edgeLabel p{background-color:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_17i\_ .edgeLabel rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_17i\_ .labelBkg{background-color:rgba(252, 252, 252, 0.5);}#chatgpt-mermaid-\_r_17i\_ .cluster rect{fill:rgb(243, 243, 243);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_17i\_ .cluster text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_17i\_ .cluster span{color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_17i\_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(243, 243, 243);border:1px solid rgba(0, 0, 0, 0.1);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-\_r_17i\_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_17i\_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-\_r_17i\_ .icon-shape,#chatgpt-mermaid-\_r_17i\_ .image-shape{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-\_r_17i\_ .icon-shape p,#chatgpt-mermaid-\_r_17i\_ .image-shape p{background-color:rgb(252, 252, 252);padding:2px;}#chatgpt-mermaid-\_r_17i\_ .icon-shape .label rect,#chatgpt-mermaid-\_r_17i\_ .image-shape .label rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_17i\_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-\_r_17i\_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-\_r_17i\_ .node .neo-node{stroke:rgb(83, 154, 248);}#chatgpt-mermaid-\_r_17i\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_17i\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_17i\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_17i\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_17i\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_17i\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_17i\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_17i\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_17i\_ [data-look="neo"].node .neo-line path{stroke:rgb(83, 154, 248);filter:none;}#chatgpt-mermaid-\_r_17i\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_17i\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_17i\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_17i\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_17i\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_17i\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_17i\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_17i\_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(0, 79, 153);}#chatgpt-mermaid-\_r_17i\_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(0, 79, 153);}#chatgpt-mermaid-\_r_17i\_ .node tspan[font-weight="normal"],#chatgpt-mermaid-\_r_17i\_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-\_r_17i\_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-width:1px;}#chatgpt-mermaid-\_r_17i\_ .node rect,#chatgpt-mermaid-\_r_17i\_ .node circle,#chatgpt-mermaid-\_r_17i\_ .node ellipse,#chatgpt-mermaid-\_r_17i\_ .node polygon,#chatgpt-mermaid-\_r_17i\_ .node path{fill:rgb(229, 243, 255);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_17i\_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-\_r_17i\_ .node.mermaid-decision .label-container{fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-dasharray:2,2;}#chatgpt-mermaid-\_r_17i\_ .edgePaths .flowchart-link{stroke:rgb(143, 143, 143);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-\_r_17i\_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_17i\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}DashboardPractice PagePhonics PageCET PracticeSentence PanelAudio PlayerRecorderSpeech Recognition(optional)Feedback PanelStorage ServiceProgress Page

### 2. 练习数据结构

每条练习数据可以统一使用如下字段：

```
const sentence = {
  id: "sentence-001",
  category: "daily-english",
  level: "beginner",
  accent: "en-US",
  text: "I usually get up at seven.",
  translation: "我通常七点起床。",
  phonetic: "/aɪ ˈjuːʒuəli ɡɛt ʌp æt ˈsɛvən/",
  audioUrl: "assets/audio/sentence-001.mp3",
  tags: ["vowels", "sentence-stress"]
};
```

音标只是示例，正式课程应核验其与所选美式发音模型的一致性。统一数据结构可以使同一句子同时用于首页推荐、纠音页面和学习报告。

## 六、录音和纠音功能的实现顺序

这是整个原型最需要注意的技术部分。

第一步：浏览器录音

使用 `navigator.mediaDevices.getUserMedia()` 获取麦克风权限，再通过 `MediaRecorder` 录音，生成音频 Blob 并创建本地回放地址。

需要处理权限拒绝、设备不存在、录音失败和资源释放等情况。

第二步：播放标准美式音频

第一版优先使用预先准备好的合法音频文件。也可以尝试浏览器 `speechSynthesis` 提供的美式英语语音，但用户设备中的语音和音质不一定一致。

目标是让听标准发音和用户录音形成完整的跟读流程。

第三步：语音识别

可选用支持英语的浏览器语音识别能力，将用户语音转换为文本。浏览器支持范围、网络要求和识别准确度均有限。

识别到正确句子，只能作为练习参考，不能直接证明每个音都发得准确。

第四步：练习反馈

先展示目标句子和识别文本之间的差异，例如漏词、替换词和识别失败；对尚未接入评测服务的音素评分，应标记为“待接入”或“演示数据”。

真正的发音评分需要具备相应能力的评测服务或模型。

### 录音模块的最小可运行示例

下面的代码可以放在 `practice.html` 中，先验证浏览器录音和回放是否正常。

```

<button id="start">开始录音</button>
<button id="stop" disabled>停止录音</button>
<p id="status">等待开始</p>
<audio id="playback" controls></audio>

<script>
let recorder;
let chunks = [];
let stream;

const startBtn = document.querySelector("#start");
const stopBtn = document.querySelector("#stop");
const status = document.querySelector("#status");
const playback = document.querySelector("#playback");

startBtn.onclick = async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: true
    });

    chunks = [];
    recorder = new MediaRecorder(stream);

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, {
        type: recorder.mimeType
      });

      const url = URL.createObjectURL(blob);
      playback.src = url;
      status.textContent = "录音完成，可以回放。";

      stream.getTracks().forEach(track => track.stop());
    };

    recorder.start();
    startBtn.disabled = true;
    stopBtn.disabled = false;
    status.textContent = "正在录音……";
  } catch (error) {
    status.textContent =
      "无法录音，请检查麦克风权限和浏览器支持。";
  }
};

stopBtn.onclick = () => {
  if (recorder?.state === "recording") {
    recorder.stop();
  }

  startBtn.disabled = false;
  stopBtn.disabled = true;
};
</script>

```

运行方法：将代码保存为 HTML 文件，通过 localhost 开发服务器打开，例如使用 VS Code 的 Live Server。部分浏览器不允许在普通 HTTP 网页中使用麦克风。

这段代码实现的是录音和回放，不包含发音评分；正式使用时还应增加录音时长限制、异常处理和旧音频资源清理。

## 七、内置的发音对比引擎（`pronunciation.js`）

第一版没有接入专业评测服务，但"把录音和原句示范逐词对比"这件事本身可以在浏览器里完成。
`pronunciation.js` 是一个零依赖的纯前端引擎，全部计算在本地完成，不上传任何音频。

### 处理流程

| 步骤 | 做法 |
| --- | --- |
| 解码 | `AudioContext.decodeAudioData` 解码示范 `.wav` 与录音 `webm/opus`，重采样到 16 kHz 单声道 |
| 特征 | 预加重 + 汉明窗 + FFT → 26 维 mel 滤波器组 → DCT → 13 维 MFCC，再做逐句 CMVN 归一化 |
| 音色归一化 | 用自相关估计双方基频，把用户音频按比例缩放到示范基频（VTLN），消除"不同人"带来的整体偏差 |
| 单词切分 | 在示范音频上检测能量谷值作为词间隙候选，再用动态规划挑选单调递增的切分点，使各词时长贴合音节权重 |
| 对齐 | 斜率约束的带状 DTW，把用户录音与示范音频逐帧对齐，用户说得慢或快都能跟上 |
| 打分 | 对齐帧上算 MFCC 余弦距离 → 逐词分数；再与浏览器转写结果做词级对齐交叉验证 |

### 两种模式

- **对比模式**：能读到示范音频时启用。给出总相似度、逐词分数、覆盖率、时长比，
  并列出"发音待改进的单词"，附带针对中文母语者的发音提示（θ/ð、词尾 l、-ed 三种读法、-se 读 /z/ 等）。
  点击任意单词即可只播放示范里这个词的前后对比。
- **自评模式**：读不到示范音频时自动降级。只分析用户自己的录音，检查词尾辅音是否发完整、
  信噪比、识别置信度，仍然能给出"哪些词可能吞音了"的提示。

### 必须如实说明的限制

- 这是**声学相似度估计**，不是音素级发音评测，不能当作专业评分。
- 逐词分数依赖示范音频里词边界估计的准确度，短促或连读严重的句子会有偏差。
- 界面上必须同时给出「练习估分」和「语音相似度」两个分数，并说明两者都不是 AI 发音评分。

### 运行方式

逐词对比需要用 `fetch` 读取示范音频的采样数据，而浏览器会拦截 `file://` 下的本地文件读取。
因此必须通过本地服务器打开：

```
start-server.bat              # Windows 双击即可：自动找空闲端口 + 自动开浏览器
node server.mjs 8730          # 没有 Python 时的零依赖替代（--no-open 不开浏览器）
python -m http.server 8730 --bind 127.0.0.1   # 手动执行
```

**端口不能写死。** 这台机器上 8000 常被 **C-Lodop 打印服务**（`CLodopPrint32.exe`）
占着，写死 8000 的后果不是"启动失败"，而是**更糟的静默错误**：

- Windows 上 `bind()` 抛的 `EADDRINUSE` 在这里靠不住。实测：
  已有服务占着 `0.0.0.0:8000` 时，绑 `::`(IPv6) **不报错**；
  绑 `127.0.0.1:8000` **也不报错**。两种情况下两个服务会安静地共用一个端口，
  浏览器按地址族解析时随机命中其中一个——打开的可能是 C-Lodop 的欢迎页。
- 所以 `server.mjs` 改成**绑定前先探测**：连一下 127.0.0.1 和 ::1，
  连得上就说明有人占了，换下一个端口（8730 → 8731 → …，最多试 50 个）。
  绑定本身仍然绑 `127.0.0.1`（只监听本机，不暴露到局域网）。

启动后控制台会打印真正生效的地址，例如：

```
SpeekBetter running at http://127.0.0.1:8730/
(http://localhost:8730 works too)
Port 8730 was busy (common cause: the C-Lodop print service), switched to 8731.
```

> 控制台输出刻意只用 ASCII：这台机器的 Windows 控制台代码页是 GBK，
> 英文以外的输出会变成乱码。

直接双击 `index.html` 也能使用录音、回放和练习记录，只是发音对比会自动降级为自评模式。

### 离线回归测试

`test-pronunciation.mjs` 用真实示范音频验证引擎，不依赖浏览器：

```
node test-pronunciation.mjs
```

覆盖：单词边界估计、自身对比基准、交叉对比区分度、**注入错误检测**（把某个词的音频替换成
噪声或别的词，验证只有那个词被标记）、变速不变调、基频估计、文本对齐、音节数启发式。

## 八、CSS 视觉规范

建议统一使用以下设计变量，避免每个页面自行定义颜色和间距。

```

:root {
  --primary: #2563eb;
  --primary-hover: #1d4ed8;
  --bg: #f8fafc;
  --surface: #ffffff;
  --text: #0f172a;
  --muted: #64748b;
  --border: #e2e8f0;
  --success: #16a34a;
  --warning: #ea580c;

  --sidebar-width: 248px;
  --radius-card: 16px;
  --space-card: 24px;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family:
    Inter, "Segoe UI", Arial, sans-serif;
  line-height: 1.6;
}

button,
input,
select {
  font: inherit;
}

button {
  cursor: pointer;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: var(--space-card);
}

.btn-primary {
  background: var(--primary);
  color: white;
  border: 0;
  border-radius: 10px;
  padding: 12px 20px;
}

.btn-primary:hover {
  background: var(--primary-hover);
}

.muted {
  color: var(--muted);
}

```

布局上建议桌面端内容最大宽度为 1440px 左右，正文区域保留足够的行间距，卡片之间保持统一间距。录音按钮需要醒目，但不要让整页都使用高饱和色。

## 九、分阶段开发计划

下面的安排以单人开发、每天能够投入一定时间为前提，属于初步估算。

| 阶段     | 开发任务             | 交付结果         |
| ------ | ---------------- | ------------ |
| 第 1 阶段 | 首页、导航、全局 CSS     | 可浏览的仪表盘      |
| 第 2 阶段 | 课程数据、音标页面、四六级页面  | 可选择练习内容      |
| 第 3 阶段 | 音频播放、录音、回放       | 真实录音原型       |
| 第 4 阶段 | 练习反馈、模拟结果、历史记录   | 完整的练习闭环      |
| 第 5 阶段 | 移动端适配、权限处理、兼容性测试 | 可演示、可部署的网页原型 |

如果每天投入约 2–3 小时，第一版静态交互原型可以先按 5–10 天规划；这不包括专业发音评测服务的接入和调试。

### 开发完成的验收标准

- 所有导航链接可以正常访问。
- 课程卡片能进入对应练习。
- 可以请求麦克风权限并录音。
- 录音停止后可以正常回放。
- 无麦克风权限时显示明确的错误提示。
- 练习记录可以保存、刷新后恢复。
- 移动端没有明显横向溢出。
- 模拟分数不会被误认为真实 AI 发音评分。
- 用户录音不会在未告知的情况下被上传或长期保存。

## 十、推荐的第一版开发优先级

我的建议是先把功能范围控制住，不要第一天就同时做 AI 对话、会员系统、排行榜和完整课程体系。

## MVP 最小可行产品

实施清单

5 / 8 项

首页 Dashboard 和统一导航

建立完整视觉框架

美式英语句子练习列表

准备 20–30 条初始练习数据

标准音频播放与浏览器录音

确保录音和回放可靠

练习反馈与本地历史记录

完成基本学习闭环

音标专项训练页面

加入常见易混音练习

四六级分类与筛选

按四级、六级和难度组织内容

内置发音对比引擎

逐词对比 + 错误词定位（已完成，见第七节）

真实发音评测接口

作为第二阶段功能

最终建议： 第一版先用原生 HTML/CSS/JavaScript 实现完整的 Dashboard、纠音工作台、课程分类、录音回放和学习记录。等整个交互流程稳定后，再接入专门的美式英语发音评估服务。这样既能尽快做出可以演示的产品，也能避免将大量时间花在尚未验证的复杂技术上。

## 十一、练习室的实际交互（当前交付形态）

第一版跑通之后，练习室主界面又做了一轮简化。下面的形态是实际交付的版本，和前面几节的"规划"可能不同，以本节为准。

### 步骤条就是操作条

只有真正需要用户点击的环节才做成按钮，步骤编号和操作合并在同一行里：

| 编号       | 控件 | 行为                                                                       |
| ---------- | ---- | -------------------------------------------------------------------------- |
| 01 先听示范 | 按钮 | 直接播放模块中正在显示的那一句，不另起一个"播放示范"入口                |
| 02 开始录音 | 按钮 | 点击后立刻请求麦克风并开始录音；录音中就地变成「停止录音」按钮，位置不跳动 |

录音结束后两个步骤都标记为完成，录音回放条同时出现。
`data-step` 属性保留，`markStep()` / `markStepDone()` 仍按 listen → record 推进进度状态。

### 已删除的元素

- 原句下方的提示语（"先自然地说完整句…"）——它和右侧栏的练习建议重复。
- 独立的「播放示范」按钮——与 01 先听示范是同一件事，留一个就够。
- 「02 组织回答」标签——这一版没有独立的"组织回答"环节，留着会让人以为漏了一步。
- 底部控制区的大号录音/停止按钮——与步骤条内的按钮重复。同一个动作出现两个 CTA 会让人犹豫该点哪个。
- 「03 回听重练」标签——回放条在录音结束后自己出现，不需要再占一个步骤位。
- 模块里那排装饰性的声音波形（纯 CSS 动画，和真实录音无关，反而像是在显示音量）。
- 「仅录音」按钮——这个原型只用麦克风，那个按钮没有任何行为。
- 「本轮重点」整张卡片——内容已经移到反馈面板里逐词呈现。
- 「默认保护隐私。录音只保留在当前浏览器中，不会上传。」提示条——同样的话在"设置"弹窗里还有更完整的一版。
- 「最近练习」整张卡片——练习记录在"进度"视图里有完整的一份，练习室不必再重复。
- 原句上方的场景标签（「在社区咖啡馆」这行）——题库里已经有"模块/环节"了，一句话上方再挂一个地名反而分散注意力。
- 原句下方的圆形换题按钮（C 图标）——下面已经有「快速换题」列表，换题不需要第二个入口。
- 右下角的计时器（「0:00」）——录音时长的上限本来就写在右上角「45 秒作答」里，底部再挂一个计时器只是重复信息。
  删掉计时器后，「准备」倒计时改为直接写在「准备」按钮上（`准备 10 秒 → 准备 3 秒`）；
  没有准备时间的题，整行控制区一起收起，不留空条。

删掉之后练习室主区变成单列：上面是练习卡，下面是「快速换题」。

### 一个按钮两用：开始录音 / 停止录音

原先是「02 开始录音」和「02 停止录音」两个按钮来回换，点了"开始"之后要等浏览器
弹出麦克风授权框、授权通过之后，第二个按钮才出现——这中间用户点不了任何东西，
看起来就是"点不动"。

现在合成一个按钮：

- 点击瞬间（在 `await getUserMedia()` **之前**）就把文字换成「停止录音」并切成珊瑚色，
  不等授权结果；
- 再点一次立刻停录；
- 录音中的视觉状态是按钮自身的 `is-recording` 类，位置不跳动。

> **不要再弹「已取消这一轮录音」。** 这个提示是我自己加的，结果把用户搞懵了：
> 他点的是「停止录音」，屏幕却告诉他"取消了"，于是以为按钮走错了分支、结果出不来了。
>
> Chrome 的麦克风授权提示是**页面级小气泡，不遮挡页面**，所以完全可能出现
> "麦克风还在等授权，用户已经点了停止"的情况。这一轮确实没有声音，
> 但那不等于"功能出错"——所以改成**静默作废**，状态区写「麦克风未就绪」，
> 句子下方也说明一句"这一轮没有录到声音"，不留空白让人以为程序没反应。

### 原句正下方直接显示逐词结果，反馈弹窗整个删掉

以前逐词结果只出现在录音结束后的弹窗里，不开弹窗就看不到；
后来发现弹窗本身就是多余的：它是全屏遮罩，会把刚出现在句子下方的结果整个盖住，
而且页面上同时存在两个"反馈"位置，结论容易对不上。

现在**反馈只有一个展示位**：练习卡原句正下方的「这一句你的发音」。
`#feedbackModal` 连同它的 HTML、JS、CSS 全部删除，不留死代码；
弹窗里的「再练一次」也不保留——进度页和「快速换题」已经覆盖了这两个功能。

这块区域从上到下是：

- 标题行右边是概览：`录到 13 个词 · 准 8 · 待改 5 · 已与示范对比`；
- **单独一行醒目的「评价总分」**：大字号 + 按分数着色（绿 / 琥珀 / 红），
  这是这一轮最该先被看到的数。口径是 `result.similarity`（语音相似度），
  和下面词的颜色同源；进度页那个「练习估分」是另一回事（那个依赖转写）；
- **一行「整句结论」**：把这轮收成一句话 + 一个颜色（绿 / 黄 / 红），
  和逐词行共用同一套颜色。英文原句保持白色不动。
  措辞会区分"和示范比"（对比模式）和"录音本身"（自评模式），见十二.3.3；
- 麦克风录到的内容（浏览器转写拿不到时，如实写明分数来自声学对齐，不编覆盖率）；
- 再下面是**一行纯文字的单词**：只显示录音里说到的词，每个词按发音准确度着色
  （绿 = 接近示范、琥珀 = 略弱、红 = 需要改进），下面跟一行颜色图例。

**没有卡片，也没有分数数字。** 这一版改了两轮才定下来：

1. 原来每个词是一个带底色、边框、圆角的"词片"，还带一个 0–100 的分数数字；
2. 先去掉分数数字（一个词一个数字太吵）；
3. 再去掉卡片外形（要求是"显示单词就行"），现在就是一行带颜色的词。

没提到的词（`status === "missing"`）不占地方，直接不出现在这一行里。
词仍保留 `title` 提示（悬停能看到 `θ / ð` 之类的发音要领）和点击试听，
但外观上只是普通文字，不再是一堆按钮。

### 停止录音后立刻给出评价

点「停止录音」后**先**在句子下方占位（显示「正在分析你的录音…」），
逐词分析跑完就直接把总分和词填进那块区域——**没有弹窗**。

> 顺带修掉的一个记账 bug：MediaRecorder 的 `stop` 事件和 300ms 兜底定时器都会调
> `handleRecordingStop()`，而 `resetRecordButton()` 会把 `isSaving` 复位成 `false`，
> 于是兜底定时器到了之后又跑一遍，**一轮练习被记成两条**（弹窗还会再弹一次）。
> 现在改用独立的 `recordingFinished` 标志，一轮只结算一次。
>
> 另外加了 `pronToken`：上一轮的分析如果比新一轮晚回来，不能覆盖新一轮的结果。

### 音频放不出来：挖出的两个真 bug

顺手查了"先听示范"和"点单词试听"为什么不出声，结果挖出两个真问题，都已修掉：

1. **本地服务器不支持 Range 请求。**
   `server.mjs` 原来直接 `res.end(data)`，既没有 `Content-Length` 也没有 `Accept-Ranges`，
   浏览器拿不到总长度，媒体元素的 `duration` 会变成 `Infinity`，
   于是既算不出时长，也无法定位到某个词。实测原生 `<audio>` 的时长显示为 `Infinity`；
   补上 Range 支持（206 + `Content-Range: bytes a-b/total` + `Accept-Ranges: bytes`）之后，
   时长才变成正确的 5.52 秒。这条同时影响「01 先听示范」和逐词试听。

2. **`playRange()` 的 timeupdate 监听第一次触发就把自己摘掉了。**
   原代码不管有没有播到词的结尾，第一次 `timeupdate` 就 `removeEventListener`，
   可 `timeupdate` 每 250 ms 左右才来一次，一个 0.3 s 的词往往第一次回调时还没到结尾——
   监听没了，于是「先播示范这个词，再播你自己的这个词」永远只播得上前一半。
   现在改成**只有真的播到结尾才摘监听**。

另外：MediaRecorder 录出来的 blob 常常没有时长信息（`duration` 是 NaN），
`currentTime = x` 会跳不动。所以点词时**先保证示范那一段**，
自己的录音放不上也不影响对照；正在播的那个词会加 `is-playing`（下划线），
点完不会"没反应"。

### 两条不能省的判据

写这一节时踩到的两个坑，都已经写进 `pronunciation.js` 并有回归测试守着：

1. **浏览器转写拿不到结果时，不能什么都不给。**
   转写决定了"哪个词被说到了"，但声学对齐本身不依赖转写。
   所以转写为空时改为纯声学逐词打分，照样能标红标绿、给出总分。
   这条路径在浏览器里很常见——Chrome 的 `webkitSpeechRecognition` 在没有网络、
   或者非 Google 浏览器上经常不出结果。

2. **只录到环境噪声时，不能把每个词都判成"错"。**
   实测：纯噪声的帧能量几乎是平的（p95−p10 只有 1~2 dB），
   而真人说话时这个动态范围在 60 dB 以上（实测三段示范音频 69~76 dB）。
   判据是「动态范围 ≥ 25 dB 且高能量帧占比 ≥ 8%」两条同时满足才算有人说话。
   不满足时所有词都算"未提及"，并提示先回放录音确认麦克风。

另外，无转写时不再显示"覆盖示范句 N%"——不知道用户实际说了几个词，
报一个 100% 是不诚实的。

### 英文原句的字号

`--fs-*` 阶梯：10 / 11 / 12 / 13 / 14 / 16 / 20 / 26 / 34 px。

英文原句从 `clamp(26px, 3.3vw, 40px)` 调整为 `clamp(20px, 2.4vw, 26px)`，
桌面端 40px → 26px（阶梯降两级），窄屏 26px → 20px。原句不再压过整个面板。

> 注意：`@media (max-width: 720px)` 里原本有一条 `font-size: 24px` 的覆盖，
> 比基础规则算出来的 20px 还要大，等于把"调小"在手机上又抵消回去了。已删除。

### 上一句 / 下一句

练习卡右上角（"第 XX 题"那一行的右侧）加了两个按钮，可以按题库顺序直接换题，
不用回题库再点回来：

- 位置：`.prompt-meta` 行的右端，和"XX 秒作答"并排。
- 顺序：**在模块内按模块顺序走**（模块化改造后），跨模块时退回整个题库顺序。见十二.1.3。
- 首尾置灰：按模块边界——模块第 1 句的「上一句」、模块最后一句的「下一句」是 `disabled`，
  `title` 写成"已经是第一句 / 已经是最后一句"，不会让人以为按钮坏了。
- 悬停提示会写出目标题的标题（"下一句：在咖啡馆修改订单"），点之前就知道会跳到哪。
- 录音中点不动：`selectPrompt` 原本就有守卫，会提示"请先完成当前这轮练习，再切换题目。"

实现上只有三处：`index.html` 加两个按钮、`styles.css` 加 `.prompt-nav-btn`
（无边框文字按钮，和 `.text-button` 同一套视觉），`app.js` 里
`selectPrompt()` 顺手更新置灰状态和提示文案，`stepPrompt(±1)` 负责跳转。

> 窄屏（439 px 实测）：两个按钮各 64 px，右边缘落在 393 px，
> 卡片内容区到 408 px，单行放得下；`.prompt-meta` 加了 `flex-wrap: wrap` 兜底，
> 更窄时会整组换行而不是溢出。

## 十二、题库、难度分级与多学生（当前交付形态）

这一版把题库从"页面里的一段硬编码"拆成独立数据文件，并且加上了难度分级、
录音流水线和按学习者分组的能力。仍然保持零构建、零依赖、零后端。

### 十二.1 题库数据外置到 `data/modules.js`

题库不再写在 `app.js` 顶部，而是一张统一的表，挂在 `window.SPEEKBETTER_MODULES` 上，
用 `<script src="data/modules.js"></script>` 引入（**在 app.js 之前**）。

用 `<script>` 而不是 `fetch()`，是为了保住"双击 index.html 直接打开"这条路：
`file://` 下 `fetch` 会被浏览器拦掉，但 `<script>` 能正常加载。
代价是 `file://` 下读不到示范音频（发音对比降级为自评模式），这一条已在界面上说明。

原来的 `promptSets`（英文原文）和 `promptZh`（中文文案）是两张表，
合并成一张以后中英文并排放在同一条记录里，不会再出现"覆盖式合并"漏字段的问题。

**当前规模：6 个模块 / 36 句**

| 模块     | id                | 句数 | 说明                             |
| -------- | ----------------- | ---- | -------------------------------- |
| 日常交流 | `mod-life-daily`  | 9    | 日常场景口语                     |
| 职场英语 | `mod-work-daily`  | 6    | 会议、汇报、反馈、沟通           |
| 旅行英语 | `mod-travel-daily`| 6    | 机场、酒店、餐厅、海关           |
| 四六级   | `mod-cet-daily`   | 5    | 自我介绍、校园、议论文题         |
| 雅思     | `mod-ielts-daily` | 5    | Part 1 / Part 2 式口语           |
| 托福     | `mod-toefl-daily` | 5    | 校园与话题口语                   |

每句字段：`id` / `level` / `part` / `title` / `context` / `prompt` / `model` /
`prep` / `response` / `focusTitle` / `focusText` / `tags` / `keywords`。

> `model` 在雅思/托福/四六级模块里是**参考答案**，`prompt` 是**题面**；
> 评价面板显示的是参考答案。生活/职场/旅行模块两者相同。
> （这一点在两轮里都提示过，最终按参考答案实现。）

### 十二.1.1 模块是唯一数据源（2026-10-21 改造）

需求："口语题库中的每一个卡片的一句修改为一个模块，一个模块放 30 句左右的英文句子，
模块内可以顺序播放，每个模块给出两个例句，具体内容手动添加。"

**架构决策：`data/modules.js` 是唯一数据源，句子从模块推导。**
`app.js` 启动时把模块摊平成句子表（`sentenceToPrompt()`），
`promptSets` / `promptById` / `sentenceModule` 全部是运行时派生值——
**用户手动加句子只需要改 `data/modules.js` 一个文件**，不存在"题库加了一句、
练习室没看到"的两处维护。

```
data/modules.js
  └── modules[]                    每个模块一个对象
        ├── id / track / level / part / title / context / hint / tags
        └── sentences[]            按顺序播放的句子
              └── id / prompt / zh / model / response / …
```

手动加一句的**最小写法**（其余字段从模块继承）：

```js
{
  id: "life-ask-price",            // = 示范音频文件名（不带扩展名）
  prompt: "Excuse me, how much is this one?",
  zh: "问价格与折扣",               // 可选
}
```

- 模块建议容量 30 句；当前种子数据是各组现有的 5–9 句。
  "建议放到 30 句"只写在数据文件注释和本文档里，**学生看不到**。
- 模块卡片固定展示**前两句例句** + 句数（`renderModuleCards()`）。
- 旧的 `data/prompts.js` 已删除：`index.html`、`app.js`、`tools/` 里三个工具
  全部改读 `modules.js`，留着它只会让人改错文件。
- `tools/audio.mjs` 改成按模块分组体检和出清单（每模块一行 "已录 x/y"）。

### 十二.1.2 模块视图与顺序播放

题库视图（`#view-library`）现在渲染的是**模块卡片**（`.module-grid` / `.module-card`），
不再是单句卡片。点卡片进入模块视图（`#view-module`）：

- 头部：模块标题、场景说明、句数、中文提示；
- 工具条：「从第一句开始练」+「顺序播放」；
- 句子列表：序号、英文原句、中文、▶ 播放这一句、练这句。

**顺序播放**（`playModuleSequence(module, startIndex, advance)`）：

- 逐句优先播 `assets/audio/<id>.wav`；404 时退回 `speechSynthesis` 读英文，
  读完继续下一句（**实测：无音频的句子也能接上，全模块 9 句一口气播完**）；
- `advance = false` 时只播当前句（列表里的 ▶），**播完即停，不推进下一句**；
- 用独立的 `modulePlayer` + `token` 代次号防竞态：切模块、点停止、
  重新点播放都能正确打断上一条链，不会出现"两串音频叠着播"。

> 踩过的坑：`timeupdate` 类的回调不能提前摘监听（见十一节「按时间片段播放」）。
> 这里用的是 `audio.onended`，天然只在真正播完时触发，所以链式播放是稳的。

### 十二.1.3 模块上下文里的「上一句 / 下一句」

练习卡右上角的「上一句 / 下一句」改成**按模块内顺序**走：

- 位置标签在模块内显示「第 N / M 句」（例如「第 04 / 09 句」），
  不在模块内才退回「第 XX 题」；
- 首尾按**模块边界**置灰（第 1 句的「上一句」、模块最后一句的「下一句」）；
- 悬停提示写出目标句的标题（"下一句：在咖啡馆修改订单"）。


### 十二.2 难度分级与筛选

每句带一个 `level`：

- `1` 入门 —— 13 句
- `2` 进阶 —— 12 句
- `3` 挑战 —— 11 句

题库视图有两行筛选，互相独立、可以叠加：

- 题库行：全部 / 生活对话 / 职场英语 / 旅行英语 / 四六级 / 雅思 / 托福
- 难度行：全部 / 入门 / 进阶 / 挑战

模块化之后筛的是**模块**（`filteredModules()`）：
一个模块只要有任意一句命中难度就算命中，所以难度筛选是"这个模块里有没有这个难度的句子"。

计数文案是 `共 N 个模块 · M 句`——N 是当前筛选出的模块数，M 是这些模块的句子总数
（实测：全部 = 6 个模块 / 36 句）。

卡片上用 `.card-level.level-1/2/3` 显示难度徽章（模块内跨难度时显示成"入门–挑战"），
题库用 `.card-dot.work/.travel/.cet` 区分颜色。

### 十二.3 示范音频的硬性规范

发音对比引擎要读音频的采样数据，所以格式不能随便：

- **PCM / 单声道 / 22050 Hz / 16 bit WAV**
- 文件名必须**等于题目 id**：`assets/audio/<id>.wav`

`tools/audio.mjs` 是体检和清单工具（模块化之后改读 `data/modules.js`，按模块分组）：

```bash
node tools/audio.mjs              # 体检：格式不对 / 还没录 / 多余文件 / 偏短 + 每模块已录进度
node tools/audio.mjs --checklist  # 生成 RECORDING.md：按模块分节，每句英文原文 + 建议时长 + 目标文件名
```

**当前状态：6 个模块 / 36 句；36 个正常、0 个格式不对、0 句待录。**

| 模块     | 已录   | 待录 |
| -------- | ------ | ---- |
| 日常交流 | 9 / 9  | 0    |
| 职场英语 | 6 / 6  | 0    |
| 旅行英语 | 6 / 6  | 0    |
| 四六级   | 5 / 5  | 0    |
| 雅思     | 5 / 5  | 0    |
| 托福     | 5 / 5  | 0    |

> **36 句全部有示范音频了**（2026-10-22）。
> 原来只有 16 句，剩下 20 句（日常交流 3 句、职场 6 句、旅行 6 句、四六级 5 句）
> 缺音频时练习卡只能"按录音自评"，**没法真正和示范发音做对比**——
> 缺的就是这一层。现在这 20 句用 TTS 补齐了（见十二.3.2）。

#### 库里的 mp3 怎么办

浏览器端其实不挑格式——`decodeAudioData` 直接就能播 mp3。但库内统一用 wav 有两个原因：
`tools/audio.mjs` 的体检只认 wav，`test-pronunciation.mjs` 的离线测试也只带 wav 解析器。
所以 mp3 只能当**源文件**留在目录里，**转一份同名 wav 进库**：

```bash
# 装了 ffmpeg 就一条命令（单声道 22050 Hz 16 bit，文件名 = 题目 id）
ffmpeg -i "assets/audio/life-be-right-there.mp3" -ac 1 -ar 22050 -c:a pcm_s16le \
       "assets/audio/life-be-right-there.wav"
```

没装 ffmpeg 就用 `tools/convert-audio.html`（浏览器内转换，见十二.4）。
体检工具现在会把目录里的非 wav 文件单独列成「其它格式」，不会当成"多余文件"误报。

### 十二.3.1 第一道题换成了新录的例句

原来第一道是 `life-cafe`（在咖啡馆修改订单）。现在第一道换成用户新提供的录音
`life-be-right-there`（"I'll be right there."），`life-cafe` 顺延到第二道——题还在，只是不再排第一。

新题在 `data/modules.js` 里对应模块的 `sentences` 数组里：

```js
{
  id: "life-be-right-there",
  track: "life",
  level: 1,
  part: "日常交流",
  title: "马上就到",
  context: "朋友问你在哪，你还在路上",
  prompt: "I'll be right there.",
  model: "I'll be right there.",
  response: 25,
  focusTitle: "缩读 I'll",
  keywords: ["right", "there"]
}
```

#### 怎么确定 mp3 里念的是哪一句

这一步没有现成工具，值得把过程记下来（本机没有离线 ASR，Windows 自带识别器只有中文引擎，
`webkitSpeechRecognition` 在无网环境基本返空）。最后用了三条互相独立的证据：

1. **云端 ASR**：`mcode-tools` 的 `connector__matrix__listen_audio` 与 `audios_understand`
   （先把本地文件 `upload_temp_url` 换成 HTTPS 地址再传 URL），两个工具独立跑出同一句
   `"I'll be right there"`，4 个词。
2. **原视频的卡拉OK字幕**：`assets2/1021(1)/1021(1).mp4` 就是这段音频的出处，
   字幕是逐词打字的。抽帧看：0.4 s 显示 `I'll b`、0.6 s 显示 `I'll be r`、
   1.2 s 显示 `I'll be right`、1.6 s 显示 `I'll be right t`——
   **字幕里根本没有 `will` 这个词**，音频是 4 词缩读版。
3. **词边界对齐**：引擎的 `estimateWordBoundaries` 按 4 词切这段音频，
   得到 `i'll 0.10–0.45 / be 0.45–0.80 / right 0.80–1.14 / there 1.14–1.64`，
   和字幕的逐词推进对得上；按 5 词切会把 `be` 推到 0.80 s，与字幕矛盾。

> 走过的弯路值得记一下：ASR 输出的是缩读形式，一开始靠"引擎五词切分得分更高（71 比 56）"
> 判定是完整形式 `I will be right there`。但那只是**模型侧切分方式**的差异，不是音频里真的有
> `will` 这个音节——字幕才是词级时间戳的真凭据。同音色的 TTS A/B（MiniMax TTS 念两种形式、
> 用 ffmpeg `atempo` 拉齐等长后比 DTW 代价）也只拉开 0.043，远小于同音色基线 0.28，判别力不足。

#### 顺带修的两处

- **快速换题写死了下标**：`app.js` 原来取 `[promptSets[0], promptSets[5], promptSets[10]]`，
  题库前面插入新题就会整排偏移。改成按 id 取（`life-be-right-there` / `life-introduce` /
  `work-meeting-update`），以后再加题不会再带偏。
- **缩读与展开形式要能对上**：`pronunciation.js` 的词匹配原来只认字面。
  学生念 "I will be right there"、示范写 "I'll be right there" 时，
  `i'll` 会匹配不上被判成"没说这个词"（界面里就整词消失了）。
  现在加了缩读表：`i'll ≡ i / will`、`don't ≡ do / not` 等，
  并且一个缩读词可以同时覆盖示范里的两个词（`i'll` 同时满足 `i` 和 `will`）。
  回归测试第 10 项专门守着这两个方向。


### 十二.3.2 缺的 20 句用 TTS 补齐（2026-10-22）

练习卡的核心是"把你的录音和**示范发音**做对比"。示范音频缺一句，
这一句就退化成"按录音自评"——**不是对比，只是自说自话**。
补齐的 20 句（日常交流 3 句、职场 6 句、旅行 6 句、四六级 5 句）用 TTS 生成：

- 音色：英文男声 `English_Trustworthy_Man`，语速 0.95，情感 neutral
  （跟读示范要清楚、不能太慢，否则学生跟不动）；
- 文本：直接取 `data/modules.js` 里每句的 `model`（雅思/托福/四六级是参考回答那段）；
- 转码：`ffmpeg -i <id>.mp3 -ac 1 -ar 22050 -c:a pcm_s16le assets/audio/<id>.wav`
  —— 和录音入库用的是同一条命令、同一个格式；
- 源 mp3 留在 `C:\Users\Administrator\Documents\speekbetter-tts-sources\`，
  **项目里只放合规的 wav**（体检工具会把非 wav 单列成"其它格式"，20 个文件会变成噪音）。

**换真人录音：直接把 `<id>.wav` 覆盖掉就行**，文件名 = 句子 id，其余什么都不用改。

> 用户自己录的优先级更高——这批 TTS 是为了让"对比"这个功能从第一天就成立，
> 不是要替代真人录音。

**三重校验**（缺一不可）：

1. **ASR 逐句转写比对**（云端转写 + 和 `model` 文本做词级命中）——
   20/20 全部 ≥90% 词命中。剩下的差异都是转写自己的写法习惯，不是念错：
   "CA981"→"CA 981"、"ten"→"10"、"Li Wen"→"Lee Wen"、"Wei Ms. Chen"→"way miss Chen"。
2. **用项目自己的引擎自检**：拿音频和它自己对比，相似度应接近 100，
   并且引擎切出的**词边界数必须等于文本词数**——这直接决定了逐词着色准不准。
   20/20 全部 `词数 N/N` + `自比相似度 100`。
3. **格式体检**：`node tools/audio.mjs` → 36 正常 / 0 格式不对 / 0 待录。

> ⚠️ ASR 的 `results` 数组**顺序和输入顺序不一致**，直接按下标对齐会全部错位。
> 正确做法是拿转写内容去反查 id（词重叠率最高的那条）。

### 十二.3.3 练习卡里的「整句结论」

逐词颜色之外，句子下方还加了一行**整句结论**（`#inlineVerdict`），
把这一轮收成一句话 + 一个颜色：

| 情况 | 颜色 | 文案 |
| ---- | ---- | ---- |
| 没有需要改进的词 | 绿 | 整句每个词都接近示范，保持这个状态。 |
| 有"略弱"的词，没有"需要改进" | 黄 | 整句跟得上，其中 N 个词还差一点，再练两遍就稳了。 |
| 有"需要改进"的词 | 红 | 整句有 N 个词和示范差得比较多……先把这几个词单独念顺。 |

- 颜色**和逐词行共用一套**（绿=接近示范 / 黄=略弱 / 红=需要改进），图例不用改；
- 措辞区分两种模式：对比模式下说"和示范比"，自评模式下说"录音本身"——
  **不能混着说**，否则就是拿自评结果冒充对比结果；
- 实现：`buildVerdict(result, words)`，纯函数，三种状态已在浏览器实测。

> 英文原句保持白色不动（用户定的），结论加在句子下方那一行彩色词之上。

### 十二.4 录音流水线（两个浏览器内工具）

手机录出来的 m4a/mp3 浏览器能直接播，但体检工具和 Node 离线测试只认 wav，
所以入库前要先转一道格式，都不需要装任何东西：

1. **`tools/convert-audio.html`** —— 浏览器内把 m4a / mp3 / wav / ogg 转成
   PCM 单声道 22050 Hz 16 bit WAV，按句子 id 命名下载。
2. **`tools/extract-sentences.html`** —— 把长音频按静音切成单句
   （0.35 s 断句、0.3–25 s 过滤），逐句试听后用下拉绑定句子 id，
   按 `<id>.wav` 批量下载；重复绑定会标红提醒。

> 两个工具现在都从 `data/modules.js` 读句子表（`flatMap` 摊平所有模块的 `sentences`），
> 所以**加完句子不用再改工具**——下拉框里自动就有新句子。

> 手上已经有 `assets2/` 里 11 段真人英语长音频（shadowing 跟读、日常句子等），
> 可以直接用 `extract-sentences.html` 切句后配给新题，比重录省事。

### 十二.5 缺示范音频时的降级

新题的音频还没录，界面不能就此瘫掉，所以有两条独立的降级路径：

| 场景                     | 表现                                                              |
| ------------------------ | ----------------------------------------------------------------- |
| 点「01 先听示范」         | 音频 404 → 提示「本题的示范音频还不可用，先用语音合成读一遍」→ TTS 朗读 |
| 录音后做逐词发音对比      | 音频 404 → 「本题还没有示范音频，已改用自评模式」→ 只分析自己的录音 |

> **2026-10-22 起 36 句都齐了**，这两条降级路径只在"用户新加句子还没录音频"时才走得到。
> 走降级时，**整句结论的措辞会跟着变**（说"录音本身"而不是"和示范比"），
> 免得把自评结果说成对比结果。

> 关键实现细节：TTS 兜底要用一个 `fellBack` 标志挡住**双重触发**——
> `audio.onerror` 和 `play()` 的 promise reject 会各报一次，不挡的话会弹两次提示。

### 十二.6 多学生：零后端的"账号同步"

这一版没有真正的账号（用户明确说先不做），但记录要能分人看。
做法是**给每条记录打 `learner` 标签**：

- `localStorage` 里每条 session 存一个 `learner` 字段
- 学习者名字存在 `speekbetter_learner_v1`，默认「我」
- 旧记录没有 `learner` 字段时，读取时按**当前学习者**回填，不丢历史
- 进度页的统计、分布、记录列表全部按学习者作用域渲染
- 下拉可以切「全部学习者」或某个具体的人

**老师看全班进度的办法（不需要任何后端）**：
每个学生在自己机器上点「导出记录」拿到一个 JSON，
老师在浏览器里点「导入记录」选这个文件，
班级汇总面板就会列出每个人的轮次、时长和平均分。

导入按 `session.id` 去重，重复导入同一个文件会提示「文件里没有新的记录」。

> 将来接真账号时，只要把 `learner` 换成 `userId` 即可，界面逻辑不用重写。
> 数据模型已经预留好了。

> 存储上限从 50 条提到 200 条——导入别人的记录后总量会变多。
> 实测 13 条记录约 4 KB，200 条放得进 localStorage。