(() => {
  "use strict";

  const STORAGE_KEY = "speekbetter_sessions_v2";
  const LEARNER_KEY = "speekbetter_learner_v1";

  // 题库放在 data/modules.js：一个模块 = 一组可以连着练的句子（建议 30 句左右），
  // 题库里的每一张卡片就是一个模块。句子在模块内按顺序练习、顺序连播。
  // 用 <script> 引入而不是 fetch，是为了 file:// 直接打开时也能读到题。
  const modules = Array.isArray(window.SPEEKBETTER_MODULES) ? window.SPEEKBETTER_MODULES : [];

  /** 模块里的一句 -> 一条可练习的句子（把引擎需要的字段补齐） */
  function sentenceToPrompt(module, sentence) {
    return {
      id: sentence.id,
      track: sentence.track || module.track,
      level: sentence.level || module.level,
      part: sentence.part || module.part,
      title: sentence.title || sentence.zh || sentence.prompt,
      context: sentence.context || module.context,
      hint: sentence.hint || module.hint,
      prompt: sentence.prompt,
      model: sentence.model || sentence.prompt,
      prep: sentence.prep || 0,
      response: sentence.response || module.response || 30,
      focusTitle: sentence.focusTitle || module.focusTitle,
      focusText: sentence.focusText || module.focusText,
      tags: sentence.tags || module.tags || [],
      keywords: sentence.keywords || []
    };
  }

  // 所有句子摊平成一份列表：引擎、快速换题、进度页继续用它
  const promptSets = [];
  const promptById = new Map();
  const sentenceModule = new Map();
  for (const module of modules) {
    for (const sentence of module.sentences || []) {
      const prompt = sentenceToPrompt(module, sentence);
      promptSets.push(prompt);
      promptById.set(prompt.id, prompt);
      sentenceModule.set(prompt.id, module);
    }
  }

  const trackNames = { life: "生活对话", work: "职场英语", travel: "旅行英语", cet: "四六级", ielts: "雅思", toefl: "托福" };
  const trackShort = { life: "日常", work: "职场", travel: "旅行", cet: "四六", ielts: "雅思", toefl: "托福" };
  const trackOrder = ["life", "work", "travel", "cet", "ielts", "toefl"];
  const levelNames = { 1: "入门", 2: "进阶", 3: "挑战" };
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  const el = {
    views: $$(".view"),
    pageTitle: $("#pageTitle"),
    goalText: $("#goalText"),
    goalRing: $("#goalRing"),
    goalPercent: $("#goalPercent"),
    goalBar: $("#goalBar"),
    profileMeta: $("#profileMeta"),
    streakLabel: $("#streakLabel"),
    averageScore: $("#averageScore"),
    studio: $("#studio"),
    trackDot: $("#trackDot"),
    trackLabel: $("#trackLabel"),
    partLabel: $("#partLabel"),
    stateLabel: $("#stateLabel"),
    promptIndex: $("#promptIndex"),
    durationLabel: $("#durationLabel"),
    prevPrompt: $("#prevPrompt"),
    nextPrompt: $("#nextPrompt"),
    promptText: $("#promptText"),
    inlineResult: $("#inlineResult"),
    inlineResultMeta: $("#inlineResultMeta"),
    inlineResultScore: $("#inlineResultScore"),
    inlineResultScoreValue: $("#inlineResultScoreValue"),
    inlineResultHeard: $("#inlineResultHeard"),
    inlineVerdict: $("#inlineVerdict"),
    inlineVerdictText: $("#inlineVerdictText"),
    inlineWords: $("#inlineWords"),
    inlineLegend: $("#inlineLegend"),
    stepListen: $("#stepListen"),
    liveTranscript: $("#liveTranscript"),
    prepButton: $("#prepButton"),
    prepLabel: $("#prepLabel"),
    studioControls: $("#studioControls"),
    recordButton: $("#recordButton"),
    recordLabel: $("#recordLabel"),
    recordStopIcon: $("#recordStopIcon"),
    playbackBar: $("#playbackBar"),
    playbackToggle: $("#playbackToggle"),
    playbackAudio: $("#playbackAudio"),
    playbackProgress: $("#playbackProgress"),
    playbackTime: $("#playbackTime"),
    compareModeBadge: $("#compareModeBadge"),
    compareModeText: $("#compareModeText"),
    demoMissingBanner: $("#demoMissingBanner"),
    missingAudioId: $("#missingAudioId"),
    demoMissingDismiss: $("#demoMissingDismiss"),
    fileProtocolBanner: $("#fileProtocolBanner"),
    fileProtocolDismiss: $("#fileProtocolDismiss"),
    quickList: $("#quickList"),
    libraryCount: $("#libraryCount"),
    filterRow: $("#filterRow"),
    levelRow: $("#levelRow"),
    searchInput: $("#searchInput"),
    libraryMeta: $("#libraryMeta"),
    moduleGrid: $("#moduleGrid"),
    moduleTitle: $("#moduleTitle"),
    moduleContext: $("#moduleContext"),
    moduleCount: $("#moduleCount"),
    moduleHint: $("#moduleHint"),
    moduleList: $("#moduleList"),
    modulePractice: $("#modulePractice"),
    modulePlayAll: $("#modulePlayAll"),
    totalRounds: $("#totalRounds"),
    totalMinutes: $("#totalMinutes"),
    overallAverage: $("#overallAverage"),
    progressStreak: $("#progressStreak"),
    weekTotal: $("#weekTotal"),
    weeklyChart: $("#weeklyChart"),
    trackBalance: $("#trackBalance"),
    historyList: $("#historyList"),
    clearHistory: $("#clearHistory"),
    learnerSelect: $("#learnerSelect"),
    learnerName: $("#learnerName"),
    exportRecords: $("#exportRecords"),
    importRecords: $("#importRecords"),
    importFile: $("#importFile"),
    classSummary: $("#classSummary"),
    settingsModal: $("#settingsModal"),
    settingsButton: $("#settingsButton"),
    closeSettings: $("#closeSettings"),
    settingsDone: $("#settingsDone"),
    profileButton: $("#profileButton"),
    toast: $("#toast"),
    toastText: $("#toastText")
  };

  let sessions = readSessions();
  let currentPrompt = promptSets[0];
  let activeFilter = "all";
  let activeLevel = "all";
  let searchQuery = "";
  let isRecording = false;
  let isStarting = false;
  let isPreparing = false;
  let isSaving = false;
  // 录音请求的「代次」：每次开始录音 +1，用来作废还在等待麦克风授权的旧请求
  let recordToken = 0;
  // 本轮录音是否已经结算过，避免 MediaRecorder 事件和兜底定时器重复记一次
  let recordingFinished = false;
  // 发音分析的代次：防止上一轮慢出来的结果盖掉新一轮
  let pronToken = 0;
  let mediaRecorder = null;
  let mediaStream = null;
  let audioChunks = [];
  let playbackUrl = "";
  let playbackBlob = null;
  let transcriptChunks = [];
  let lastPronunciation = null;
  let modelProbe = null;
  let startedAt = 0;
  let elapsed = 0;
  let timerId = null;
  let prepId = null;
  let recognition = null;
  let finalTranscript = "";
  let interimTranscript = "";
  let toastId = null;
  let lastSession = null;
  let modelAudio = null;

  function readSessions() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(value)) return [];
      // 旧记录没有 learner 字段，一律算到当前学习者头上，别把历史弄丢
      const fallback = readLearner();
      return value.map((session) => (session && !session.learner ? { ...session, learner: fallback } : session));
    } catch {
      return [];
    }
  }

  function saveSessions() {
    try {
      // 200 条大约几百 KB，localStorage 放得下；上限从 50 提到 200 是因为
      // 导入别人的记录后总量会变多。
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, 200)));
    } catch {
      showToast("当前浏览器无法保存练习记录。");
    }
  }

  /* ------------------------------------------------------------------ *
   * 学习者
   * ------------------------------------------------------------------ *
   * 这一版还没有真正的账号（用户明确说先不做），但记录要能分人看：
   * 每条记录打上 learner 标签，老师把学生的记录导出成一个文件，
   * 在自己机器上导入后就能看到全班情况。
   * 将来接真账号时，只要把 learner 换成 userId 即可，界面逻辑不用重写。
   */
  function readLearner() {
    try {
      return localStorage.getItem(LEARNER_KEY) || "我";
    } catch {
      return "我";
    }
  }

  function saveLearner(name) {
    try {
      localStorage.setItem(LEARNER_KEY, name);
    } catch {
      showToast("当前浏览器无法保存学习者名称。");
    }
  }

  function knownLearners() {
    const set = new Set(sessions.map((session) => session.learner).filter(Boolean));
    set.add(readLearner());
    return [...set].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  }

  function exportRecords() {
    const payload = {
      app: "speekbetter",
      version: 1,
      exportedAt: new Date().toISOString(),
      sessions
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `speekbetter-records-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`已导出 ${sessions.length} 条练习记录。`);
  }

  function importRecords(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let incoming = [];
      try {
        const parsed = JSON.parse(String(reader.result));
        incoming = Array.isArray(parsed) ? parsed : Array.isArray(parsed.sessions) ? parsed.sessions : [];
      } catch {
        showToast("这个文件读不出来，请选择由本页面导出的 JSON。");
        return;
      }
      const known = new Set(sessions.map((session) => session.id));
      const fresh = incoming.filter((session) => session && session.id && !known.has(session.id));
      if (!fresh.length) {
        showToast("文件里没有新的记录，可能已经导入过了。");
        return;
      }
      sessions = [...fresh, ...sessions].slice(0, 200);
      saveSessions();
      renderDashboard();
      renderProgress();
      renderLearnerList();
      showToast(`已导入 ${fresh.length} 条记录。`);
    };
    reader.onerror = () => showToast("文件读取失败，请重试。");
    reader.readAsText(file);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    return `${min}:${String(Math.max(0, Math.floor(seconds % 60))).padStart(2, "0")}`;
  }

  function dayStart(date) {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    return value;
  }

  function isSameDay(a, b) {
    return dayStart(a).getTime() === dayStart(b).getTime();
  }

  function lastSevenDays() {
    const today = dayStart(new Date());
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(today);
      day.setDate(today.getDate() - (6 - index));
      return day;
    });
  }

  function average(values) {
    const valid = values.filter(Number.isFinite);
    if (!valid.length) return null;
    return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
  }

  function streakDays(list) {
    const rows = list || sessions;
    if (!rows.length) return 0;
    const practiced = new Set(rows.map((session) => dayStart(session.createdAt).getTime()));
    let day = dayStart(new Date());
    if (!practiced.has(day.getTime())) day.setDate(day.getDate() - 1);
    let count = 0;
    while (practiced.has(day.getTime())) {
      count += 1;
      day.setDate(day.getDate() - 1);
    }
    return count;
  }

  function showToast(message) {
    window.clearTimeout(toastId);
    el.toastText.textContent = message;
    el.toast.classList.add("is-visible");
    toastId = window.setTimeout(() => el.toast.classList.remove("is-visible"), 3200);
  }

  function setView(name) {
    el.views.forEach((view) => view.classList.toggle("is-active", view.id === `view-${name}`));
    // 模块视图是题库的下级，导航上"口语题库"保持高亮
    const navKey = name === "module" ? "library" : name;
    $$(".nav-button").forEach((button) => button.classList.toggle("is-active", button.dataset.view === navKey));
    $$(".mobile-nav button").forEach((button) => button.classList.toggle("is-active", button.dataset.view === navKey));
    el.pageTitle.textContent = { studio: "练习室", library: "口语题库", module: "口语题库", progress: "学习进度" }[name] || "Practice room";
    if (name === "progress") renderProgress();
    if (name === "library") renderLibrary();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetSteps() {
    $$(".step-item").forEach((item, index) => {
      item.classList.toggle("is-current", index === 0);
      item.classList.remove("is-done");
    });
  }

  function markStep(step, completePrevious = true) {
    const items = $$(".step-item");
    const target = items.find((item) => item.dataset.step === step);
    if (!target) return;
    if (completePrevious) {
      items.forEach((item) => {
        if (items.indexOf(item) < items.indexOf(target)) {
          item.classList.remove("is-current");
          item.classList.add("is-done");
        }
      });
    }
    items.forEach((item) => item.classList.remove("is-current"));
    target.classList.add("is-current");
  }

  function markStepDone(step) {
    const target = $$(".step-item").find((item) => item.dataset.step === step);
    if (!target) return;
    target.classList.remove("is-current");
    target.classList.add("is-done");
  }

  function selectPrompt(id, options = {}) {
    if (isRecording || isStarting || isPreparing) {
      showToast("请先完成当前这轮练习，再切换题目。");
      return;
    }
    const prompt = promptSets.find((item) => item.id === id);
    if (!prompt) return;
    currentPrompt = prompt;
    clearPlayback();
    el.trackLabel.textContent = trackNames[prompt.track];
    el.trackDot.className = `track-dot ${prompt.track === "life" ? "" : prompt.track}`;
    el.partLabel.textContent = prompt.part;
    const index = promptSets.indexOf(prompt);
    // 位置标签：在模块里显示"第 N / M 句"，不在模块里才显示题号
    const module = sentenceModule.get(prompt.id);
    const list = module ? (module.sentences || []).map((s) => s.id) : promptSets.map((p) => p.id);
    const pos = list.indexOf(prompt.id);
    el.promptIndex.textContent = module
      ? `第 ${String(pos + 1).padStart(2, "0")} / ${String(list.length).padStart(2, "0")} 句`
      : `第 ${String(index + 1).padStart(2, "0")} 题`;
    // 上一句 / 下一句：按模块顺序走，首尾两端置灰，悬停提示能提前看到是哪一句
    const prev = promptById.get(list[pos - 1]);
    const next = promptById.get(list[pos + 1]);
    el.prevPrompt.disabled = !prev;
    el.nextPrompt.disabled = !next;
    el.prevPrompt.title = prev ? `上一句：${prev.title}` : "已经是第一句";
    el.nextPrompt.title = next ? `下一句：${next.title}` : "已经是最后一句";
    el.durationLabel.textContent = `${prompt.response} 秒作答`;
    el.promptText.textContent = prompt.prompt;
    el.prepButton.style.display = prompt.prep ? "inline-flex" : "none";
    el.prepLabel.textContent = prompt.prep ? `准备 ${prompt.prep} 秒` : "准备";
    // 计时器删掉后，这一行只剩准备倒计时；没有准备时间的题就整行收起来
    el.studioControls.hidden = !prompt.prep;
    el.stateLabel.textContent = "就绪";
    el.liveTranscript.textContent = "";
    el.liveTranscript.classList.remove("is-visible");
    resetInlineResult();
    resetPronunciation();
    resetSteps();
    if (!options.keepView) setView("studio");

    // 预检查示范音频是否可用，不可用则提示用户已切换自评模式
    checkModelAudio(prompt.id);
  }

  /** 当前所在模块的句子列表（没有模块时退回整个题库） */
  function navList() {
    const module = sentenceModule.get(currentPrompt && currentPrompt.id);
    if (module) return (module.sentences || []).map((s) => s.id);
    return promptSets.map((p) => p.id);
  }

  /** 上一句 / 下一句：在当前模块内走一步 */
  function stepPrompt(offset) {
    const list = navList();
    const index = list.indexOf(currentPrompt.id);
    const target = promptById.get(list[index + offset]);
    if (target) selectPrompt(target.id);
  }

  /** 检查示范音频文件是否存在，不存在则显示自评模式横幅 */
  async function checkModelAudio(promptId) {
    const audioUrl = `assets/audio/${promptId}.wav`;
    el.demoMissingBanner.hidden = true;
    el.compareModeBadge.hidden = true;

    try {
      const response = await fetch(audioUrl, { method: "HEAD" });
      if (!response.ok) {
        showDemoMissingBanner(promptId);
      }
    } catch {
      // fetch 失败（如 file:// 协议被阻止），也显示横幅
      showDemoMissingBanner(promptId);
    }
  }

  function showDemoMissingBanner(promptId) {
    el.missingAudioId.textContent = promptId;
    el.demoMissingBanner.hidden = false;
  }

  function filteredModules() {
    const query = searchQuery.trim().toLowerCase();
    return modules.filter((module) => {
      const matchesTrack = activeFilter === "all" || module.track === activeFilter;
      const sentences = module.sentences || [];
      const matchesLevel = activeLevel === "all" || sentences.some((s) => String(s.level || module.level) === activeLevel);
      const haystack = [
        module.title,
        module.context,
        module.hint,
        module.part,
        (module.tags || []).join(" "),
        module.focusTitle,
        module.focusText,
        ...sentences.map((s) => `${s.title || ""} ${s.zh || ""} ${s.prompt || ""}`)
      ].join(" ").toLowerCase();
      return matchesTrack && matchesLevel && (!query || haystack.includes(query));
    });
  }

  /**
   * 「先听示范」：播放模块中显示的那一句。
   *
   * 生活对话模块里显示的句子和示范音频是同一句，直接播音频；
   * 雅思/托福模块里显示的是题目，而示范音频里是参考答案，此时用语音合成读题目。
   */
  async function listenToModel() {
    markStep("listen");
    if (modelAudio && !modelAudio.paused) {
      modelAudio.pause();
      modelAudio.currentTime = 0;
      setListenLabel("先听示范");
      return;
    }
    if (modelAudio) modelAudio.pause();

    const shown = currentPrompt.prompt;
    if (currentPrompt.model !== shown) {
      // 示范音频里是参考答案，这里读模块中显示的题目
      speakText(shown);
      return;
    }

    modelAudio = new Audio(`assets/audio/${currentPrompt.id}.wav`);
    modelAudio.preload = "auto";
    modelAudio.volume = 0.95;
    modelAudio.onplay = () => setListenLabel("正在播放");
    modelAudio.onended = () => setListenLabel("先听示范");
    modelAudio.onpause = () => setListenLabel("先听示范");
    // 示范音频还没录（404）或者 file:// 被浏览器拦截时，退回语音合成读一遍。
    // onerror 和 play() 的 reject 可能都触发，用一个标记避免读两遍。
    let fellBack = false;
    const fallback = () => {
      if (fellBack) return;
      fellBack = true;
      setListenLabel("先听示范");
      showToast("本题的示范音频还不可用，先用语音合成读一遍。");
      speakText(shown);
    };
    modelAudio.onerror = fallback;
    try {
      await modelAudio.play();
    } catch {
      fallback();
    }
  }

  function setListenLabel(text) {
    const label = el.stepListen.querySelector(".step-label");
    if (label) label.textContent = text;
    el.stepListen.classList.toggle("is-playing", text === "正在播放");
  }

  /** 用浏览器语音合成读出一段英文；onend 用于顺序播放时接着读下一句 */
  function speakText(text, onend) {
    if (!("speechSynthesis" in window)) {
      showToast("示范音频播放失败，请刷新页面后重试。");
      if (onend) onend();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.88;
    utterance.onstart = () => setListenLabel("正在播放");
    utterance.onend = utterance.onerror = () => {
      setListenLabel("先听示范");
      if (onend) onend();
    };
    window.speechSynthesis.speak(utterance);
  }
  function clearPlayback() {
    if (playbackUrl) URL.revokeObjectURL(playbackUrl);
    playbackUrl = "";
    playbackBlob = null;
    el.playbackAudio.pause();
    el.playbackAudio.removeAttribute("src");
    el.playbackAudio.load();
    el.playbackBar.classList.remove("is-visible");
    el.playbackProgress.style.width = "0%";
    el.playbackTime.textContent = "0:00";
    el.playbackToggle.innerHTML = '<svg class="icon"><use href="#i-play"></use></svg>';
  }

  /** 切换题目时清空上一轮的发音对比结果 */
  function resetPronunciation() {
    lastPronunciation = null;
  }

  /** 清空原句下方的「你的发音」区域 */
  function resetInlineResult() {
    if (!el.inlineResult) return;
    el.inlineResult.hidden = true;
    el.inlineResult.classList.remove("is-loading");
    el.inlineResultMeta.textContent = "";
    el.inlineResultScore.hidden = true;
    el.inlineResultScoreValue.textContent = "—";
    el.inlineResultHeard.textContent = "";
    el.inlineVerdict.hidden = true;
    el.inlineVerdictText.textContent = "";
    el.inlineWords.innerHTML = "";
    el.inlineLegend.hidden = true;
  }

  /**
   * 停止录音后立刻在句子下方占位：先告诉用户「正在分析」，
   * 别让人对着空白的句子等下去。
   */
  function showInlinePending() {
    if (!el.inlineResult) return;
    el.inlineResult.hidden = false;
    el.inlineResult.classList.add("is-loading");
    el.inlineResultMeta.textContent = "正在分析你的录音…";
    el.inlineResultScore.hidden = true;
    el.inlineResultScoreValue.textContent = "—";
    el.inlineResultHeard.textContent = "";
    el.inlineVerdict.hidden = true;
    el.inlineVerdictText.textContent = "";
    el.inlineWords.innerHTML = "";
    el.inlineLegend.hidden = true;
  }

  /**
   * 整句结论：把逐词结果收成一句话，颜色跟逐词行同一套（绿/黄/红）。
   * 对比模式下说的是「和示范比」，自评模式下说的是「录音本身」——不能混着说。
   */
  function buildVerdict(result, words) {
    const good = words.filter((w) => w.status === "good").length;
    const weak = words.filter((w) => w.status === "weak").length;
    const bad = words.filter((w) => w.status === "error").length;
    if (!good && !weak && !bad) return null;
    const compare = result.mode === "compare";
    if (bad > 0) {
      return {
        level: "error",
        text: compare
          ? `整句有 ${bad} 个词和示范差得比较多${weak ? `，另外 ${weak} 个词还差一点` : ""}，先把这几个词单独念顺。`
          : `录音里有 ${bad} 个词比较含混${weak ? `，另外 ${weak} 个词也偏弱` : ""}，放慢一点再念一遍。`
      };
    }
    if (weak > 0) {
      return {
        level: "weak",
        text: compare
          ? `整句跟得上，其中 ${weak} 个词还差一点，再练两遍就稳了。`
          : `录音基本清楚，${weak} 个词还含混，多念几遍会更利落。`
      };
    }
    return {
      level: "good",
      text: compare
        ? "整句每个词都接近示范，保持这个状态。"
        : "录音说得清楚又完整，保持这个状态。"
    };
  }

  /**
   * 把这一轮的结果直接摆在练习卡里（原句正下方）：
   * 上面是评价总分和麦克风录到的内容，下面一排是录到的每个词 + 发音准确度颜色。
   */
  function renderInlineResult(result, session) {
    if (!el.inlineResult) return;
    const all = (result.words || []).filter((word) => word && word.word);
    // 只显示录音里说到的词；没提到的词不占地方
    const words = all.filter((word) => word.status && word.status !== "missing");
    if (!words.length) {
      el.inlineResult.hidden = false;
      el.inlineResult.classList.remove("is-loading");
      el.inlineResultMeta.textContent = "这一轮没有可分析的内容";
      el.inlineResultHeard.textContent = "先回放「你的录音」确认麦克风是否正常，再重试一次。";
      el.inlineVerdict.hidden = true;
      el.inlineVerdictText.textContent = "";
      el.inlineWords.innerHTML = "";
      el.inlineLegend.hidden = true;
      return;
    }

    el.inlineResult.hidden = false;
    el.inlineResult.classList.remove("is-loading");

    // 评价总分：单独一行、字号最大，直接给出这一轮的结论
    if (typeof result.similarity === "number") {
      el.inlineResultScoreValue.textContent = result.similarity;
      el.inlineResultScore.className = `inline-result-score ${result.similarity >= 75 ? "is-good" : result.similarity >= 55 ? "is-weak" : "is-error"}`;
    } else {
      el.inlineResultScoreValue.textContent = "—";
      el.inlineResultScore.className = "inline-result-score";
    }
    el.inlineResultScore.hidden = false;

    // 整句结论：一眼看到这一轮到底行不行
    const verdict = buildVerdict(result, words);
    if (verdict) {
      el.inlineVerdict.className = `inline-verdict is-${verdict.level}`;
      el.inlineVerdictText.textContent = verdict.text;
      el.inlineVerdict.hidden = false;
    } else {
      el.inlineVerdict.hidden = true;
      el.inlineVerdictText.textContent = "";
    }

    const heard = (session && session.transcript ? session.transcript : "").trim();
    if (heard) {
      el.inlineResultHeard.textContent = `麦克风录到：${heard}`;
    } else {
      el.inlineResultHeard.textContent = "这一轮没拿到浏览器转写，下面的分数来自录音与示范的声学对齐。";
    }

    const meta = [];
    meta.push(`录到 ${words.length} 个词`);
    const good = words.filter((word) => word.status === "good").length;
    const weak = words.filter((word) => word.status === "weak").length;
    const bad = words.filter((word) => word.status === "error").length;
    if (good + weak + bad) meta.push(`准 ${good} · 待改 ${weak + bad}`);
    meta.push(result.mode === "compare" ? "已与示范对比" : "仅按录音自评");
    el.inlineResultMeta.textContent = meta.join(" · ");

    el.inlineWords.innerHTML = words.map((word) => {
      const status = word.status || "missing";
      const label = escapeHtml(word.word);
      const tip = word.hint ? `${word.hint.label}：${word.hint.zh}` : statusLabel(status);
      const heardWord = word.heard && word.heard.toLowerCase() !== word.word.toLowerCase()
        ? `（听成 ${word.heard}）` : "";
      // 点一个词，只听示范里的这个词 + 你自己说的这个词
      const time = typeof word.modelStart === "number" ? ` data-start="${word.modelStart.toFixed(3)}" data-end="${word.modelEnd.toFixed(3)}"` : "";
      const userTime = typeof word.userStart === "number" ? ` data-user-start="${word.userStart.toFixed(3)}" data-user-end="${word.userEnd.toFixed(3)}"` : "";
      const playable = time || userTime;
      return `<button type="button" class="inline-word is-${status}"${time}${userTime} title="${escapeHtml(`${tip}${heardWord}`)}"${playable ? "" : " disabled"}>${label}</button>`;
    }).join("");

    el.inlineLegend.hidden = false;
  }

  function startPrep() {
    if (isRecording || isStarting) return;
    if (!currentPrompt.prep) {
      showToast("这道题可以直接开始录音。");
      return;
    }
    if (isPreparing) return;
    isPreparing = true;
    let remaining = currentPrompt.prep;
    el.prepButton.classList.add("is-active");
    el.stateLabel.textContent = "准备中";
    // 计时器已经删掉，倒计时直接写在「准备」按钮上
    el.prepLabel.textContent = `准备 ${remaining} 秒`;
    const tick = () => {
      remaining -= 1;
      el.prepLabel.textContent = `准备 ${Math.max(0, remaining)} 秒`;
      if (remaining <= 0) {
        window.clearInterval(prepId);
        prepId = null;
        isPreparing = false;
        el.prepButton.classList.remove("is-active");
        el.prepLabel.textContent = `准备 ${currentPrompt.prep} 秒`;
        el.stateLabel.textContent = "就绪";
        showToast("准备时间结束，可以开始录音了。");
      }
    };
    tick();
    if (remaining > 0) prepId = window.setInterval(tick, 1000);
  }

  /**
   * 录音按钮是一个开关：点一下变「停止录音」，再点一下停。
   *
   * 关键点是按钮状态必须在 await getUserMedia() 之前就切过去——
   * 浏览器弹出授权框时用户看不到任何变化，就会以为按钮没反应；
   * 而等到授权回来才切换，用户点第二下时 isRecording 还没置位，停止请求就丢了。
   */
  async function beginRecording() {
    if (isSaving) return;
    // 已经在录（或正在等授权）→ 这次点击是「停止」
    if (isRecording || isStarting) {
      stopRecording();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      showToast("当前浏览器无法录音，请使用最新版 Chrome 或 Edge。");
      return;
    }

    clearPlayback();
    finalTranscript = "";
    interimTranscript = "";
    transcriptChunks = [];
    audioChunks = [];
    elapsed = 0;
    isSaving = false;
    recordingFinished = false;
    // 上一轮的结果先清掉，避免和新录音的实时字幕叠在一起
    resetInlineResult();

    // 立刻切成「停止录音」，不等麦克风授权
    const token = ++recordToken;
    isStarting = true;
    setRecordButtonState(true);
    el.stateLabel.textContent = "请求麦克风";

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // 授权期间用户已经点了停止：这路麦克风直接丢掉
      if (token !== recordToken) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      mediaStream = stream;
      mediaRecorder = new MediaRecorder(mediaStream);
      mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) audioChunks.push(event.data);
      });
      mediaRecorder.addEventListener("stop", handleRecordingStop, { once: true });
      mediaRecorder.start(250);
      startRecognition();
      startedAt = Date.now();
      isStarting = false;
      isRecording = true;
      el.stateLabel.textContent = "录音中";
      markStep("record");
      timerId = window.setInterval(updateRecordingTimer, 250);
    } catch (error) {
      if (token !== recordToken) return;
      mediaStream = null;
      mediaRecorder = null;
      isStarting = false;
      setRecordButtonState(false);
      const denied = error?.name === "NotAllowedError";
      showToast(denied ? "麦克风权限被拒绝，请在浏览器设置中允许后重试。" : "麦克风无法启动，请检查设备和浏览器权限。");
      el.stateLabel.textContent = "麦克风不可用";
    }
  }

  /** 同一个按钮的两种样子：开始录音 / 停止录音 */
  function setRecordButtonState(recording) {
    el.recordLabel.textContent = recording ? "停止录音" : "开始录音";
    el.recordStopIcon.hidden = !recording;
    el.recordButton.classList.toggle("is-recording", recording);
    el.studio.classList.toggle("is-recording", recording);
  }

  function updateRecordingTimer() {
    elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    if (elapsed >= currentPrompt.response) stopRecording();
  }

  function startRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    let lastFinalIndex = -1;
    recognition.addEventListener("result", (event) => {
      interimTranscript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0].transcript.trim();
        if (result.isFinal) {
          if (index <= lastFinalIndex) continue;
          lastFinalIndex = index;
          finalTranscript += ` ${text}`;
          // 记录每个最终结果的时间戳与置信度，用于定位每个词在录音中的位置
          const raw = result[0].confidence;
          transcriptChunks.push({
            text,
            at: Date.now(),
            confidence: typeof raw === "number" && raw > 0 ? raw : null
          });
        } else interimTranscript += ` ${text}`;
      }
      const visible = `${finalTranscript} ${interimTranscript}`.trim();
      el.liveTranscript.textContent = visible.slice(-240);
      el.liveTranscript.classList.toggle("is-visible", Boolean(visible));
    });
    recognition.addEventListener("error", (event) => {
      if (["not-allowed", "service-not-allowed"].includes(event.error)) {
        showToast("实时转写不可用，但录音和回放仍然可以正常使用。");
      }
    });
    recognition.addEventListener("end", () => {
      if (isRecording && recognition) {
        try { recognition.start(); } catch {}
      }
    });
    try { recognition.start(); } catch {}
  }

  function stopRecognition() {
    if (!recognition) return;
    const active = recognition;
    recognition = null;
    try { active.stop(); } catch {}
  }

  function stopRecording() {
    if (!isRecording && !isStarting) return;
    const wasStarting = isStarting;
    isRecording = false;
    isStarting = false;
    // 作废还在等待授权的请求：授权回来之后这路麦克风会被直接丢掉
    recordToken += 1;
    window.clearInterval(timerId);
    timerId = null;
    stopRecognition();
    setRecordButtonState(false);

    if (wasStarting) {
      // 麦克风还没就绪，这一轮确实没有录到声音。
      // 这里不能再弹「已取消这一轮录音」——用户点的是「停止录音」，
      // 弹一条"取消"会让人以为按钮走错了分支、结果出不来了。
      // 静默作废这次请求，把情况说清楚就够了。
      el.recordButton.disabled = false;
      el.recordButton.classList.remove("is-busy");
      el.stateLabel.textContent = "麦克风未就绪";
      el.studio.classList.remove("is-recording");
      el.liveTranscript.classList.remove("is-visible");
      // 句子下方也说明一下，别让那块地方空着让人以为程序没反应
      el.inlineResult.hidden = false;
      el.inlineResult.classList.remove("is-loading");
      el.inlineResultMeta.textContent = "这一轮没有录到声音";
      el.inlineResultScore.hidden = true;
      el.inlineResultHeard.textContent = "麦克风还没就绪就被停下了。等浏览器允许使用麦克风后，再点「开始录音」重试一次。";
      el.inlineVerdict.hidden = true;
      el.inlineVerdictText.textContent = "";
      el.inlineWords.innerHTML = "";
      return;
    }

    elapsed = Math.max(1, Math.floor((Date.now() - startedAt) / 1000));
    el.stateLabel.textContent = "处理中";
    el.recordLabel.textContent = "正在生成反馈";
    el.recordButton.classList.add("is-busy");
    el.recordButton.disabled = true;
    if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
    }
    // 录音停下后立刻给出评价：MediaRecorder 的 stop 事件通常几十毫秒就到，
    // 这里的定时器只是兜底，不再让人干等一秒。
    window.setTimeout(() => {
      if (!recordingFinished) handleRecordingStop();
    }, 300);
  }

  function handleRecordingStop() {
    // MediaRecorder 的 stop 事件和上面的兜底定时器都会调到这里，只结算一次
    if (recordingFinished) return;
    recordingFinished = true;
    isSaving = true;
    const chunks = audioChunks.slice();
    const transcript = `${finalTranscript} ${interimTranscript}`.replace(/\s+/g, " ").trim();
    const mimeType = mediaRecorder?.mimeType || "audio/webm";

    if (chunks.length) {
      if (playbackUrl) URL.revokeObjectURL(playbackUrl);
      playbackBlob = new Blob(chunks, { type: mimeType });
      playbackUrl = URL.createObjectURL(playbackBlob);
      el.playbackAudio.src = playbackUrl;
      el.playbackBar.classList.add("is-visible");
    }

    const result = analyzeTranscript(transcript, elapsed);
    lastSession = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      promptId: currentPrompt.id,
      track: currentPrompt.track,
      title: currentPrompt.title,
      prompt: currentPrompt.prompt,
      learner: readLearner(),
      createdAt: new Date().toISOString(),
      duration: elapsed,
      transcript,
      chunks: transcriptChunks.slice(),
      ...result
    };
    sessions.unshift(lastSession);
    saveSessions();
    renderDashboard();
    renderProgress();
    markStepDone("record");
    resetRecordButton();
    // 练习卡里先占位，让用户立刻看到"这一轮已经在算了"；
    // 反馈弹窗已经删掉，结果直接落在原句下方。
    showInlinePending();
    runPronunciationCheck(lastSession);
  }

  /* ------------------------------------------------------------------ *
   * 发音对比
   * ------------------------------------------------------------------ */
  async function runPronunciationCheck(session) {
    if (!window.Pronunciation) return;
    // 代次：上一轮的分析如果比新一轮晚回来，就不能覆盖新一轮的结果
    const token = ++pronToken;

    const prompt = promptSets.find((item) => item.id === session.promptId);
    try {
      const result = await window.Pronunciation.compare({
        modelUrl: `assets/audio/${session.promptId}.wav`,
        modelText: prompt ? prompt.model : session.prompt,
        userBlob: playbackBlob,
        transcript: session.transcript,
        chunks: session.chunks || [],
        keywords: prompt ? prompt.keywords : []
      });
      if (token !== pronToken) return;
      lastPronunciation = result;
      renderInlineResult(result, session);
      // 根据返回的 mode 显示对比徽章
      if (result.mode === "compare") {
        el.compareModeBadge.hidden = false;
        el.compareModeText.textContent = "对比模式";
      } else if (result.mode === "self") {
        el.compareModeBadge.hidden = false;
        el.compareModeText.textContent = "自评模式";
      } else {
        el.compareModeBadge.hidden = true;
      }
    } catch (error) {
      if (token !== pronToken) return;
      // 练习卡里也要说清楚发生了什么，不能静悄悄地空着
      el.inlineResult.hidden = false;
      el.inlineResult.classList.remove("is-loading");
      el.inlineResultMeta.textContent = "这一轮没能完成发音分析";
      el.inlineResultHeard.textContent = `原因：${error && error.message ? error.message : error}`;
      el.inlineVerdict.hidden = true;
      el.inlineVerdictText.textContent = "";
      el.inlineWords.innerHTML = "";
      el.inlineLegend.hidden = true;
    }
  }

  function statusLabel(status) {
    if (status === "good") return "接近示范";
    if (status === "weak") return "略弱";
    if (status === "error") return "需要改进";
    return "未提及";
  }

  /* --- 试听：示范音频 / 我的录音，支持只播放某个词 --- */
  function playRange(audio, start, end, then) {
    if (!audio) return;
    // 只有真的播到词的结尾才摘掉监听。
    // 之前是第一次 timeupdate 就摘掉，可 timeupdate 每 250ms 左右才来一次，
    // 一个 0.3s 的词往往第一次回调时还没到结尾 —— 监听没了，
    // 于是「先播示范这个词，再播你自己的这个词」永远只播得上前一半。
    const stop = () => {
      if (typeof end === "number" && end > start && audio.currentTime >= end) {
        audio.removeEventListener("timeupdate", stop);
        audio.pause();
        if (then) then();
      }
    };
    audio.addEventListener("timeupdate", stop);
    audio.currentTime = Math.max(0, start || 0);
    audio.play().then(() => {
      if (typeof end !== "number" || end <= start) {
        audio.removeEventListener("timeupdate", stop);
        if (then) then();
      }
    }).catch(() => showToast("音频无法播放，请重试。"));
  }

  function getModelAudio() {
    const url = `assets/audio/${currentPrompt.id}.wav`;
    if (!modelProbe || modelProbe.dataset.src !== url) {
      modelProbe = new Audio(url);
      modelProbe.dataset.src = url;
      modelProbe.preload = "auto";
    }
    return modelProbe;
  }

  function handlePronWordClick(event) {
    const button = event.target.closest("[data-start], [data-user-start]");
    if (!button) return;
    const start = button.dataset.start !== undefined ? Number(button.dataset.start) : null;
    const end = button.dataset.end !== undefined ? Number(button.dataset.end) : null;
    const userStart = button.dataset.userStart !== undefined ? Number(button.dataset.userStart) : null;
    const userEnd = button.dataset.userEnd !== undefined ? Number(button.dataset.userEnd) : null;

    // 正在放的那个词要看得见，否则点了没反应会让人以为按钮坏了
    let blinkTimer = 0;
    const mark = (on) => {
      button.classList.toggle("is-playing", on);
      window.clearTimeout(blinkTimer);
      if (on) {
        const span = Math.max(1, (end || 0) - (start || 0));
        blinkTimer = window.setTimeout(() => button.classList.remove("is-playing"), (span + 3) * 1000);
      }
    };

    if (start !== null) {
      // 对比模式：先播示范中这个词，再播你自己的同一个词
      mark(true);
      playRange(getModelAudio(), start, end, () => {
        mark(false);
        // 自己的录音是 MediaRecorder 出来的 blob，有些浏览器定位不进去，
        // 放不上也不影响示范这一段——那才是对照的依据。
        if (userStart !== null) playRange(el.playbackAudio, userStart, userEnd);
      });
    } else if (userStart !== null) {
      // 自评模式没有示范音频，直接回放你自己的这个词
      mark(true);
      playRange(el.playbackAudio, userStart, userEnd, () => mark(false));
    }
  }

  function resetRecordButton(stateText = "已评分") {
    isSaving = false;
    isStarting = false;
    isRecording = false;
    el.recordButton.disabled = false;
    el.recordButton.classList.remove("is-busy");
    el.recordLabel.textContent = "开始录音";
    el.recordStopIcon.hidden = true;
    el.recordButton.classList.remove("is-recording");
    el.studio.classList.remove("is-recording");
    el.stateLabel.textContent = stateText;
    el.liveTranscript.classList.remove("is-visible");
  }

  function normalizeWords(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9'\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  }

  function analyzeTranscript(transcript, duration) {
    const words = normalizeWords(transcript);
    const fillers = (transcript.match(/\b(um+|uh+|erm+|like|you know|sort of|kind of|basically|actually)\b/gi) || []).length;
    const wpm = words.length && duration >= 4 ? Math.round((words.length / duration) * 60) : null;
    const expected = [...new Set(currentPrompt.keywords.map((word) => word.toLowerCase()))];
    const matches = expected.filter((word) => words.some((spoken) => spoken === word || spoken.includes(word) || word.includes(spoken))).length;
    const keywordRecall = expected.length ? Math.round((matches / expected.length) * 100) : 0;
    const hasTranscript = words.length > 0;
    const fillerRate = hasTranscript ? Number(((fillers / words.length) * 100).toFixed(1)) : 0;

    let score = null;
    if (hasTranscript) {
      score = 58;
      if (words.length >= 18) score += 6;
      if (words.length >= 35) score += 5;
      if (wpm && wpm >= 105 && wpm <= 165) score += 12;
      else if (wpm && wpm >= 85 && wpm <= 185) score += 7;
      else if (wpm) score += 3;
      score += Math.round(keywordRecall * .1);
      score -= Math.min(14, Math.max(0, fillers - 1) * 2);
      score = Math.max(32, Math.min(96, score));
    }

    return {
      words: words.length,
      fillers,
      fillerRate,
      wpm,
      keywordRecall,
      score
    };
  }


  function renderDashboard() {
    const todaySessions = sessions.filter((session) => isSameDay(session.createdAt, new Date()));
    const todayMinutes = todaySessions.reduce((sum, session) => sum + session.duration, 0) / 60;
    const goal = Math.min(100, Math.round((todayMinutes / 10) * 100));
    const scores = sessions.map((session) => session.score);
    const avg = average(scores);
    const streak = streakDays();

    el.goalText.textContent = `${Math.min(10, Math.round(todayMinutes))} / 10 分钟`;
    el.goalRing.style.setProperty("--value", goal);
    el.goalPercent.textContent = `${goal}%`;
    el.goalBar.style.width = `${goal}%`;
    el.profileMeta.textContent = sessions.length ? `${sessions.length} 轮练习` : "新的练习计划";
    el.streakLabel.textContent = `连续 ${streak} 天`;
    el.averageScore.textContent = avg ?? "—";

    // 用 id 取，不用下标：题库前面插入新题时，"快速换题"不会被带偏
    const quickIds = ["life-be-right-there", "life-introduce", "work-meeting-update"];
    el.quickList.innerHTML = quickIds
      .map((id) => promptSets.find((prompt) => prompt.id === id))
      .filter(Boolean)
      .map((prompt, index) => `
      <button class="quick-row" data-prompt="${prompt.id}">
        <span class="quick-number">${String(index + 1).padStart(2, "0")}</span>
        <span class="quick-copy"><strong>${escapeHtml(prompt.title)}</strong><span>${trackNames[prompt.track]} · ${prompt.response} 秒</span></span>
        <svg class="icon"><use href="#i-arrow"></use></svg>
      </button>
    `).join("");
  }

  /* ---------------- 模块：卡片、详情、顺序播放 ---------------- */
  let currentModuleId = null;
  const modulePlayer = { moduleId: null, index: -1, playing: false, audio: null, token: 0 };

  function currentModule() {
    return modules.find((module) => module.id === currentModuleId) || null;
  }

  /** 题库里的每一张卡片 = 一个模块，卡片上给出两句例句 */
  function renderModuleCards() {
    const visible = filteredModules();
    const sentenceCount = visible.reduce((sum, module) => sum + (module.sentences || []).length, 0);
    el.libraryCount.textContent = visible.length;
    el.libraryMeta.textContent = `共 ${visible.length} 个模块 · ${sentenceCount} 句`;
    if (!visible.length) {
      el.moduleGrid.innerHTML = '<div class="library-empty">没有找到匹配的模块，请尝试其他关键词或分类。</div>';
      return;
    }
    el.moduleGrid.innerHTML = visible.map((module) => {
      const sentences = module.sentences || [];
      const levels = [...new Set(sentences.map((s) => s.level || module.level))].sort();
      const levelText = levels.length > 1
        ? `${levelNames[levels[0]]}–${levelNames[levels[levels.length - 1]]}`
        : levelNames[levels[0]] || "";
      const samples = sentences.slice(0, 2);
      return `
      <article class="module-card" data-module="${module.id}" tabindex="0" role="button" aria-label="进入模块 ${escapeHtml(module.title)}">
        <div class="card-top">
          <span class="card-track"><span class="card-dot ${module.track === "life" ? "" : module.track}"></span>${trackNames[module.track]}</span>
          <span class="card-level level-${levels[0] || 1}">${escapeHtml(levelText)}</span>
        </div>
        <h2>${escapeHtml(module.title)}</h2>
        <p>${escapeHtml(module.context)}</p>
        <ul class="module-samples">
          ${samples.map((s) => `<li>${escapeHtml(s.prompt)}</li>`).join("")}
        </ul>
        <div class="card-footer"><span>${sentences.length} 句</span><span class="card-arrow"><svg class="icon"><use href="#i-arrow"></use></svg></span></div>
      </article>`;
    }).join("");
  }

  /** 打开一个模块：列出它的句子，可以逐句听、可以顺序连播、可以练某一句 */
  function openModule(id) {
    const module = modules.find((m) => m.id === id);
    if (!module) return;
    currentModuleId = id;
    stopModulePlayback();
    const sentences = module.sentences || [];
    el.moduleTitle.textContent = module.title;
    el.moduleContext.textContent = module.context;
    el.moduleCount.textContent = `${sentences.length} 句`;
    el.moduleHint.textContent = module.hint;
    el.moduleList.innerHTML = sentences.map((sentence, index) => `
      <li class="module-sentence" data-sentence="${sentence.id}">
        <span class="module-index">${String(index + 1).padStart(2, "0")}</span>
        <div class="module-copy">
          <p class="module-en">${escapeHtml(sentence.prompt)}</p>
          <p class="module-zh">${escapeHtml(sentence.zh || sentence.title || "")}</p>
        </div>
        <div class="module-row-actions">
          <button class="icon-button" data-play="${sentence.id}" title="播放这一句" aria-label="播放这一句"><svg class="icon"><use href="#i-play"></use></svg></button>
          <button class="text-button" data-practice="${sentence.id}">练这句</button>
        </div>
      </li>`).join("");
    setView("module");
  }

  function renderModulePlaybackState() {
    $$(".module-sentence", el.moduleList).forEach((row, index) => {
      row.classList.toggle("is-playing", modulePlayer.playing && index === modulePlayer.index);
    });
    if (!el.modulePlayAll) return;
    el.modulePlayAll.textContent = modulePlayer.playing ? "停止播放" : "顺序播放";
    el.modulePlayAll.classList.toggle("is-playing", modulePlayer.playing);
  }

  function stopModulePlayback() {
    modulePlayer.token++;
    modulePlayer.playing = false;
    modulePlayer.index = -1;
    if (modulePlayer.audio) {
      modulePlayer.audio.pause();
      modulePlayer.audio = null;
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    renderModulePlaybackState();
  }

  /**
   * 顺序播放：一句接一句，从第一句到最后一句。
   * advance = false 时只播这一句（列表里的 ▶ 按钮）。
   * 没录示范音频的句子退回语音合成，读完继续下一句。
   */
  function playModuleSequence(module, startIndex, advance) {
    stopModulePlayback();
    const sentences = module.sentences || [];
    if (!sentences.length) return;
    modulePlayer.moduleId = module.id;
    modulePlayer.playing = true;
    const token = modulePlayer.token;
    const step = (index) => {
      if (token !== modulePlayer.token) return;
      if (index >= sentences.length) {
        stopModulePlayback();
        return;
      }
      modulePlayer.index = index;
      renderModulePlaybackState();
      const sentence = sentences[index];
      const audio = new Audio(`assets/audio/${sentence.id}.wav`);
      modulePlayer.audio = audio;
      let fellBack = false;
      const next = () => {
        if (token !== modulePlayer.token) return;
        if (!advance) {
          stopModulePlayback();
          return;
        }
        step(index + 1);
      };
      const fallback = () => {
        if (fellBack) return;
        fellBack = true;
        modulePlayer.audio = null;
        speakText(sentence.prompt, next);
      };
      audio.onended = next;
      audio.onerror = fallback;
      audio.play().catch(fallback);
    };
    step(startIndex);
  }

  function renderLibrary() {
    renderModuleCards();
  }

  function renderProgress() {
    const scope = el.learnerSelect ? el.learnerSelect.value : "all";
    const scoped = scope === "all" ? sessions : sessions.filter((session) => session.learner === scope);
    const totalSeconds = scoped.reduce((sum, session) => sum + session.duration, 0);
    const avg = average(scoped.map((session) => session.score));
    const streak = streakDays(scoped);
    el.totalRounds.textContent = scoped.length;
    el.totalMinutes.textContent = `${Math.round(totalSeconds / 60)} 分钟`;
    el.overallAverage.textContent = avg ?? "—";
    el.progressStreak.textContent = `${streak} 天`;

    const days = lastSevenDays();
    const minuteCounts = days.map((day) => scoped.filter((session) => isSameDay(session.createdAt, day)).reduce((sum, session) => sum + session.duration, 0) / 60);
    const max = Math.max(5, ...minuteCounts);
    el.weekTotal.textContent = `${Math.round(minuteCounts.reduce((sum, count) => sum + count, 0))} 分钟`;
    el.weeklyChart.innerHTML = days.map((day, index) => {
      const height = Math.max(3, Math.round((minuteCounts[index] / max) * 88));
      return `<div class="day-column ${isSameDay(day, new Date()) ? "is-today" : ""}"><span class="day-bar" style="--height:${height}%" title="${minuteCounts[index].toFixed(1)} minutes"></span><span>${day.toLocaleDateString(undefined, { weekday: "short" }).slice(0,3)}</span></div>`;
    }).join("");

    const trackCounts = {};
    trackOrder.forEach((track) => { trackCounts[track] = 0; });
    scoped.forEach((session) => { trackCounts[session.track] = (trackCounts[session.track] || 0) + 1; });
    const total = Math.max(1, scoped.length);
    el.trackBalance.innerHTML = trackOrder.map((track) => {
      const percent = Math.round((trackCounts[track] / total) * 100);
      return `<div class="balance-row"><div class="balance-head"><strong>${trackNames[track]}</strong><span>${trackCounts[track]} 次 · ${percent}%</span></div><div class="balance-track"><span class="${track}" style="width:${scoped.length ? percent : 0}%"></span></div></div>`;
    }).join("");

    if (!scoped.length) {
      el.historyList.innerHTML = '<div class="empty-row">还没有练习记录。先到练习室完成第一轮吧。</div>';
    } else {
      el.historyList.innerHTML = scoped.slice(0, 12).map((session) => {
        const date = new Date(session.createdAt);
        return `<div class="history-row">
          <span class="history-date">${date.toLocaleDateString(undefined,{month:"short"}).toUpperCase()}<br>${date.getDate()}</span>
          <div class="history-copy"><strong>${escapeHtml(session.title)}</strong><span>${trackNames[session.track]} · ${formatTime(session.duration)} · ${session.wpm ? `${session.wpm} WPM` : "无转写"}${session.learner && scope === "all" ? ` · ${escapeHtml(session.learner)}` : ""}</span></div>
          <span class="history-score">${session.score ?? "—"}</span>
          <button class="history-repeat" data-repeat="${session.id}" aria-label="Practice this prompt again"><svg class="icon"><use href="#i-arrow"></use></svg></button>
        </div>`;
      }).join("");
    }

    renderClassSummary();
  }

  /** 班级汇总：把每个学习者的练习情况列出来，老师一眼看到谁练了多少 */
  function renderClassSummary() {
    if (!el.classSummary) return;
    const rows = knownLearners().map((name) => {
      const items = sessions.filter((session) => session.learner === name);
      const minutes = items.reduce((sum, session) => sum + session.duration, 0) / 60;
      const avg = average(items.map((session) => session.score));
      const last = items.length ? items[0].createdAt : null;
      const lastText = last ? new Date(last).toLocaleDateString(undefined, { month: "numeric", day: "numeric" }) : "—";
      return `<div class="class-row">
        <div class="class-name"><strong>${escapeHtml(name)}</strong><span>${items.length} 轮 · ${Math.round(minutes)} 分钟 · 最近 ${lastText}</span></div>
        <div class="class-score">${avg ?? "—"}</div>
      </div>`;
    });
    el.classSummary.innerHTML = rows.join("") || '<div class="empty-row">还没有学习者记录。</div>';
  }

  /** 学习者下拉框：全部 + 已知的每个人 */
  function renderLearnerList() {
    if (!el.learnerSelect) return;
    const current = el.learnerSelect.value || "all";
    const options = ['<option value="all">全部学习者</option>']
      .concat(knownLearners().map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`));
    el.learnerSelect.innerHTML = options.join("");
    el.learnerSelect.value = knownLearners().includes(current) || current === "all" ? current : "all";
  }

  function playRecording() {
    if (!playbackUrl) return;
    if (el.playbackAudio.paused) {
      el.playbackAudio.play().catch(() => showToast("录音无法播放，请重试。"));
    } else {
      el.playbackAudio.pause();
    }
  }

  function bindEvents() {
    $$("[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
    document.addEventListener("click", (event) => {
      const moduleCard = event.target.closest("[data-module]");
      if (moduleCard) openModule(moduleCard.dataset.module);
      const promptButton = event.target.closest("[data-prompt]");
      if (promptButton) selectPrompt(promptButton.dataset.prompt);
      const repeatButton = event.target.closest("[data-repeat]");
      if (repeatButton) {
        const session = sessions.find((item) => item.id === repeatButton.dataset.repeat);
        if (session) selectPrompt(session.promptId);
      }
    });

    el.moduleGrid.addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key)) return;
      const card = event.target.closest("[data-module]");
      if (card) { event.preventDefault(); openModule(card.dataset.module); }
    });

    // 模块详情：逐句播放 / 练这句
    el.moduleList.addEventListener("click", (event) => {
      const playButton = event.target.closest("[data-play]");
      if (playButton) {
        const module = currentModule();
        const index = module ? (module.sentences || []).findIndex((s) => s.id === playButton.dataset.play) : -1;
        if (module && index >= 0) playModuleSequence(module, index, false);
        return;
      }
      const practiceButton = event.target.closest("[data-practice]");
      if (practiceButton) selectPrompt(practiceButton.dataset.practice);
    });

    el.modulePractice.addEventListener("click", () => {
      const module = currentModule();
      if (!module || !(module.sentences || []).length) return;
      selectPrompt(module.sentences[0].id);
    });

    el.modulePlayAll.addEventListener("click", () => {
      const module = currentModule();
      if (!module) return;
      if (modulePlayer.playing) {
        stopModulePlayback();
        return;
      }
      playModuleSequence(module, 0, true);
    });

    el.filterRow.addEventListener("click", (event) => {
      const button = event.target.closest("[data-filter]");
      if (!button) return;
      activeFilter = button.dataset.filter;
      $$(".filter", el.filterRow).forEach((filter) => filter.classList.toggle("is-active", filter === button));
      renderLibrary();
    });

    el.searchInput.addEventListener("input", () => { searchQuery = el.searchInput.value; renderLibrary(); });
    if (el.levelRow) {
      el.levelRow.addEventListener("click", (event) => {
        const button = event.target.closest("[data-level]");
        if (!button) return;
        activeLevel = button.dataset.level;
        $$("[data-level]", el.levelRow).forEach((chip) => chip.classList.toggle("is-active", chip === button));
        renderLibrary();
      });
    }
    if (el.learnerSelect) {
      el.learnerSelect.addEventListener("change", () => renderProgress());
    }
    if (el.learnerName) {
      el.learnerName.addEventListener("change", () => {
        const name = el.learnerName.value.trim();
        if (!name) { el.learnerName.value = readLearner(); return; }
        saveLearner(name);
        el.learnerName.value = name;
        renderLearnerList();
        renderProgress();
        showToast(`接下来的练习会记在「${name}」名下。`);
      });
    }
    if (el.exportRecords) el.exportRecords.addEventListener("click", exportRecords);
    if (el.importRecords) el.importRecords.addEventListener("click", () => el.importFile.click());
    if (el.importFile) {
      el.importFile.addEventListener("change", () => {
        const file = el.importFile.files && el.importFile.files[0];
        if (file) importRecords(file);
        el.importFile.value = "";
      });
    }
    el.stepListen.addEventListener("click", listenToModel);
    el.prevPrompt.addEventListener("click", () => stepPrompt(-1));
    el.nextPrompt.addEventListener("click", () => stepPrompt(1));
    el.prepButton.addEventListener("click", startPrep);
    // 一个按钮两用：开始录音 / 停止录音
    el.recordButton.addEventListener("click", beginRecording);
    el.playbackToggle.addEventListener("click", playRecording);
    el.settingsButton.addEventListener("click", () => { el.settingsModal.classList.add("is-open"); document.body.style.overflow = "hidden"; });
    el.profileButton.addEventListener("click", () => { el.settingsModal.classList.add("is-open"); document.body.style.overflow = "hidden"; });
    el.closeSettings.addEventListener("click", closeSettings);
    el.settingsDone.addEventListener("click", closeSettings);
    el.settingsModal.addEventListener("click", (event) => { if (event.target === el.settingsModal) closeSettings(); });

    el.playbackAudio.addEventListener("timeupdate", () => {
      const duration = Number.isFinite(el.playbackAudio.duration) ? el.playbackAudio.duration : 0;
      const percent = duration ? (el.playbackAudio.currentTime / duration) * 100 : 0;
      el.playbackProgress.style.width = `${percent}%`;
      el.playbackTime.textContent = formatTime(el.playbackAudio.currentTime);
    });
    el.playbackAudio.addEventListener("play", () => { el.playbackToggle.innerHTML = '<svg class="icon"><use href="#i-pause"></use></svg>'; });
    el.playbackAudio.addEventListener("pause", () => { el.playbackToggle.innerHTML = '<svg class="icon"><use href="#i-play"></use></svg>'; });
    el.playbackAudio.addEventListener("ended", () => { el.playbackProgress.style.width = "100%"; el.playbackToggle.innerHTML = '<svg class="icon"><use href="#i-play"></use></svg>'; });

    el.clearHistory.addEventListener("click", () => {
      if (!sessions.length) { showToast("当前没有可清空的练习记录。"); return; }
      if (window.confirm("确定要清空当前浏览器中的全部练习记录吗？")) {
        sessions = [];
        saveSessions();
        renderDashboard();
        renderProgress();
        showToast("练习记录已清空。");
      }
    });

    // 练习卡里的逐词结果：点一个词，只听示范里这个词 + 你自己说的这个词
    el.inlineWords.addEventListener("click", handlePronWordClick);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (el.settingsModal.classList.contains("is-open")) closeSettings();
      }
      if (event.code === "Space" && $('#view-studio').classList.contains("is-active") && !["INPUT", "TEXTAREA", "BUTTON"].includes(document.activeElement.tagName)) {
        event.preventDefault();
        (isRecording || isStarting) ? stopRecording() : beginRecording();
      }
    });

    window.addEventListener("beforeunload", cleanup);
  }

  // 示范音频缺失横幅关闭
  el.demoMissingDismiss.addEventListener("click", () => {
    el.demoMissingBanner.hidden = true;
  });
  // file:// 协议横幅关闭
  el.fileProtocolDismiss.addEventListener("click", () => {
    el.fileProtocolBanner.hidden = true;
  });

  function closeSettings() {
    el.settingsModal.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  function cleanup() {
    window.clearInterval(timerId);
    window.clearInterval(prepId);
    stopRecognition();
    if (mediaStream) mediaStream.getTracks().forEach((track) => track.stop());
    if (mediaRecorder?.state && mediaRecorder.state !== "inactive") {
      try { mediaRecorder.stop(); } catch {}
    }
    if (playbackUrl) URL.revokeObjectURL(playbackUrl);
  }

  function init() {
    // 检测是否直接以 file:// 协议打开，如果是则显示提示
    if (location.protocol === "file:") {
      el.fileProtocolBanner.hidden = false;
    }

    if (!promptSets.length) {
      showToast("题库没有加载成功，请确认 data/modules.js 存在。");
      return;
    }
    if (el.learnerName) el.learnerName.value = readLearner();
    renderLearnerList();
    renderDashboard();
    renderLibrary();
    renderProgress();
    selectPrompt(promptSets[0].id, { keepView: true });
    bindEvents();
  }

  init();
})();
