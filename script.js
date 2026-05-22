const form = document.querySelector("#essayForm");
const essayTypeInputs = document.querySelectorAll("input[name='essayType']");
const minorTypeField = document.querySelector("#minorTypeField");
const minorType = document.querySelector("#minorType");
const promptInput = document.querySelector("#prompt");
const essayInput = document.querySelector("#essay");
const essayImage = document.querySelector("#essayImage");
const imagePreview = document.querySelector("#imagePreview");
const previewImage = document.querySelector("#previewImage");
const uploadZone = document.querySelector("#uploadZone");
const runOcr = document.querySelector("#runOcr");
const ocrStatus = document.querySelector("#ocrStatus");
const studentName = document.querySelector("#studentName");
const resultTitle = document.querySelector("#resultTitle");
const scoreMeter = document.querySelector("#scoreMeter");
const loadSample = document.querySelector("#loadSample");
const tabList = document.querySelector(".tabs");
const tabs = document.querySelectorAll(".tab");
const contents = document.querySelectorAll(".tab-content");

const rubrics = {
  major: [
    ["内容完整度", 6],
    ["结构逻辑", 5],
    ["语法准确性", 7],
    ["助词使用", 4],
    ["词汇与表达", 4],
    ["文体统一与自然度", 2],
    ["字数与格式", 2],
  ],
  minor: [
    ["信息点完整", 3],
    ["应用文格式", 2],
    ["语法准确性", 2],
    ["助词使用", 1],
    ["表达得体自然", 1],
    ["文体统一", 1],
  ],
};

const sampleData = {
  major: {
    prompt:
      "请以「私の好きな季節」为题，写一篇 300 字左右的日语作文。要求内容完整，表达自然，文体统一。",
    essay:
      "私の好きな季節は春です。春に天気が暖かくて、花がたくさん咲きます。私は友達と公園で行きます。桜を見ることが好きです。春は新しい生活を始まる季節と思います。だから、私は春が一番好きです。",
  },
  minor: {
    prompt:
      "你明天不能参加日语学习小组活动，请给同学写一则留言，说明原因并表达歉意。80 字左右。",
    essay:
      "田中さんへ。明日、私は用事があるので、勉強会で行くことができません。すみません。次の時に一緒に勉強します。李明",
  },
};

let hasUploadedImage = false;
let useMockOcr = false;
let ocrImageDataUrl = "";

const sampleImage =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="760" height="360" viewBox="0 0 760 360">
      <rect width="760" height="360" fill="#f8fbff"/>
      <rect x="34" y="28" width="692" height="304" rx="12" fill="#ffffff" stroke="#d7dee8"/>
      <text x="70" y="82" fill="#667085" font-family="Arial, sans-serif" font-size="22" font-weight="700">学生手写作文图片示例</text>
      <path d="M72 132 C150 105, 210 151, 286 126 S423 128, 500 116 S630 112, 690 132" fill="none" stroke="#1f2933" stroke-width="4" stroke-linecap="round"/>
      <path d="M72 184 C170 160, 240 203, 332 176 S480 181, 690 172" fill="none" stroke="#1f2933" stroke-width="4" stroke-linecap="round"/>
      <path d="M72 236 C168 213, 274 249, 380 224 S548 222, 690 236" fill="none" stroke="#1f2933" stroke-width="4" stroke-linecap="round"/>
      <text x="70" y="296" fill="#2563eb" font-family="Arial, sans-serif" font-size="18">点击“识别手写日语”后生成可校对文本</text>
    </svg>
  `);

function getEssayType() {
  return document.querySelector("input[name='essayType']:checked").value;
}

function toggleMinorType() {
  minorTypeField.classList.toggle("hidden", getEssayType() !== "minor");
}

function getOcrDemoText() {
  return sampleData[getEssayType()].essay;
}

function getApiEssayPayload() {
  const type = getEssayType();
  return {
    essayType: type,
    minorType: type === "minor" ? minorType.value : "",
    prompt: promptInput.value.trim(),
    essay: essayInput.value.trim(),
    studentName: studentName.value.trim(),
  };
}

function setOcrStatus(text, tone = "muted") {
  ocrStatus.textContent = text;
  ocrStatus.dataset.tone = tone;
}

const tabStatus = document.createElement("div");
tabStatus.className = "tab-status";
tabStatus.setAttribute("aria-live", "polite");
tabStatus.textContent = "当前显示：评分总览";
tabList.insertAdjacentElement("afterend", tabStatus);

function showEmptyTabState(targetId) {
  const target = document.querySelector(`#${targetId}`);
  if (!target || target.textContent.trim()) return;

  const labels = {
    errors: ["错误纠正", "批改完成后，这里会显示原句、问题位置和修改建议。"],
    polish: ["句子润色", "批改完成后，这里会显示可直接讲解给学生的润色表达。"],
    teaching: ["修改范文", "批改完成后，这里会显示保留学生原意的修改范文。"],
  };
  const [title, message] = labels[targetId] || ["等待内容", "批改结果会在这里生成。"];
  target.innerHTML = `
    <div class="empty-state compact">
      <h3>${title}</h3>
      <p>${message}</p>
    </div>
  `;
}

function switchTab(targetId, announce = true) {
  const target = document.querySelector(`#${targetId}`);
  const activeTab = document.querySelector(`.tab[data-tab="${targetId}"]`);
  if (!target || !activeTab) return;

  tabs.forEach((item) => {
    const isActive = item === activeTab;
    item.classList.toggle("active", isActive);
    item.setAttribute("aria-selected", String(isActive));
  });
  contents.forEach((item) => item.classList.toggle("active", item === target));
  showEmptyTabState(targetId);

  const label = activeTab.textContent.trim();
  tabStatus.textContent = announce ? `已切换到：${label}` : `当前显示：${label}`;
  target.scrollTop = 0;
}

function compressImageDataUrl(dataUrl, maxSide = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => {
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("图片压缩失败。"));
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    });
    image.addEventListener("error", () => reject(new Error("图片读取失败。")));
    image.src = dataUrl;
  });
}

function previewUploadedImage(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    setOcrStatus("请上传图片格式的手写作文。", "error");
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", async () => {
    previewImage.src = reader.result;
    imagePreview.classList.remove("hidden");
    hasUploadedImage = true;
    useMockOcr = false;
    ocrImageDataUrl = "";
    setOcrStatus("图片已上传，正在优化识别图片...", "ready");

    try {
      ocrImageDataUrl = await compressImageDataUrl(reader.result);
      setOcrStatus("图片已优化，可开始识别。", "ready");
    } catch (error) {
      ocrImageDataUrl = reader.result;
      setOcrStatus("图片已上传，可开始识别。", "ready");
    }
  });
  reader.readAsDataURL(file);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sentenceCount(text) {
  return text.split(/[。！？\n]/).filter((item) => item.trim().length > 0).length;
}

function scoreEssay(type, text, promptText) {
  const rubric = rubrics[type];
  const length = text.replace(/\s/g, "").length;
  const count = sentenceCount(text);
  const hasPolite = /です|ます/.test(text);
  const hasPlain = /だ。|である|と思う|できる。/.test(text);
  const hasParticleRisk = /で行|に天気|生活を始まる|勉強会で行/.test(text);
  const hasGrammarRisk = /季節と思|次の時|見ることが好き/.test(text);

  return rubric.map(([name, max], index) => {
    let deduction = 0;
    if (length < (type === "major" ? 95 : 35) && ["内容完整度", "信息点完整", "字数与格式"].includes(name)) deduction += 1;
    if (count < 4 && ["结构逻辑", "内容完整度"].includes(name)) deduction += 1;
    if (hasParticleRisk && name === "助词使用") deduction += type === "major" ? 1.5 : 0.5;
    if (hasGrammarRisk && name === "语法准确性") deduction += type === "major" ? 2 : 0.8;
    if (hasPolite && hasPlain && ["文体统一与自然度", "文体统一"].includes(name)) deduction += 0.6;
    if (!promptText.trim() && index === 0) deduction += 1;
    const floor = max >= 5 ? 2 : 0.4;
    const score = Math.max(floor, max - deduction);
    return { name, max, score: Math.round(score * 10) / 10 };
  });
}

function buildCorrections(type, appType) {
  const formatCorrections =
    type === "minor"
      ? [
          {
            original: "田中さんへ。明日、私は用事があるので...",
            problem: `${appType}场景的格式`,
            fix: "田中さんへ\n明日、用事があるので、勉強会に参加できません。\n李明",
            explain: `${appType}类小作文要优先保证信息清楚、格式简洁。称呼、正文、署名分行后，老师阅卷时更容易判断信息点。`,
          },
        ]
      : [];

  return [
    {
      title: "助词错误",
      badge: "重点扣分项",
      items: [
        {
          original: "私は友達と公園で行きます。",
          problem: "公園で行きます",
          wrong: "で",
          fix: "私は友達と公園へ行きます。",
          explain: "「で」表示动作发生的场所，「へ」表示移动方向。这里是“去公园”，应使用「へ」或「に」。",
        },
        {
          original: "勉強会で行くことができません。",
          problem: "勉強会で行く",
          wrong: "で",
          fix: "勉強会に行くことができません。",
          explain: "「勉強会」是动作到达的对象或参加的活动，用「に」更自然。",
        },
      ],
    },
    {
      title: "语法错误",
      badge: "需要讲解",
      items: [
        {
          original: "春は新しい生活を始まる季節と思います。",
          problem: "生活を始まる",
          wrong: "生活を始まる",
          fix: "春は新しい生活が始まる季節だと思います。",
          explain: "「始まる」是不及物动词，主语用「が」。如果使用「を」，要改成他动词「始める」。",
        },
        {
          original: "次の時に一緒に勉強します。",
          problem: "次の時",
          wrong: "次の時",
          fix: "次回、一緒に勉強したいです。",
          explain: "「次回」比直译式的「次の時」更自然，也更符合应用文表达。",
        },
      ],
    },
    {
      title: "表达不自然",
      badge: "提分空间",
      items: [
        {
          original: "桜を見ることが好きです。",
          problem: "見ることが好き",
          wrong: "見ることが好き",
          fix: "桜を見るのが好きです。",
          explain: "表示喜欢做某事时，「动词辞书形 + のが好きです」更自然，作文中也很常用。",
        },
        {
          original: "春に天気が暖かくて、花がたくさん咲きます。",
          problem: "春に天気",
          wrong: "春に",
          fix: "春は暖かく、花がたくさん咲きます。",
          explain: "这里用「春は」作为主题更自然，句子也更简洁。",
        },
      ],
    },
    {
      title: "文体问题",
      badge: "统一语气",
      items: [
        {
          original: "だから、私は春が一番好きです。",
          problem: "句尾表达略单一",
          wrong: "だから",
          fix: "そのため、私は春が一番好きです。",
          explain: "「だから」偏口语，作文中可以换成「そのため」等更书面、更自然的连接表达。",
        },
      ],
    },
    ...(formatCorrections.length
      ? [
          {
            title: "格式问题",
            badge: "小作文专属",
            items: formatCorrections,
          },
        ]
      : []),
  ];
}

function highlightError(original, wrong) {
  const safeOriginal = escapeHtml(original);
  if (!wrong) return safeOriginal;

  const safeWrong = escapeHtml(wrong);
  return safeOriginal.replace(safeWrong, `<mark class="error-mark">${safeWrong}</mark>`);
}

function buildPolish() {
  return [
    {
      original: "私の好きな季節は春です。",
      polished: "私が一番好きな季節は春です。",
      point: "用「一番」突出主题，开头更明确。",
      reusable: "私が一番〜のは〜です。",
    },
    {
      original: "春に天気が暖かくて、花がたくさん咲きます。",
      polished: "春は暖かく、さまざまな花が咲くので、明るい気持ちになります。",
      point: "加入感受后，内容更充实，表达更有作文感。",
      reusable: "〜ので、明るい気持ちになります。",
    },
    {
      original: "すみません。次の時に一緒に勉強します。",
      polished: "本当にすみません。次回はぜひ一緒に勉強したいです。",
      point: "应用文中语气更礼貌，也更符合留言场景。",
      reusable: "次回はぜひ〜したいです。",
    },
  ];
}

function getLevel(total, max) {
  const rate = total / max;
  if (rate >= 0.82) return { text: "良好", className: "good" };
  if (rate >= 0.65) return { text: "中等", className: "mid" };
  return { text: "需加强", className: "mid" };
}

function renderOverview(scores, type, name) {
  const max = type === "major" ? 30 : 10;
  const total = Math.round(scores.reduce((sum, item) => sum + item.score, 0) * 10) / 10;
  const level = getLevel(total, max);
  const label = type === "major" ? "大作文" : `${minorType.value}类小作文`;

  scoreMeter.innerHTML = `<strong>${total}</strong><span>/ ${max}</span>`;
  resultTitle.textContent = `${name ? `${name} · ` : ""}${label}批改`;

  const scoreRows = scores
    .map((item) => {
      const width = Math.round((item.score / item.max) * 100);
      return `
        <li class="score-line">
          <span>${item.name}</span>
          <div class="bar" aria-hidden="true"><i style="width:${width}%"></i></div>
          <strong>${item.score}/${item.max}</strong>
        </li>
      `;
    })
    .join("");

  document.querySelector("#overview").innerHTML = `
    <div class="overview-grid">
      <article class="summary-card">
        <div class="item-head">
          <h3>整体判断</h3>
          <span class="level-pill ${level.className}">${level.text}</span>
        </div>
        <p>这篇作文基本能回应题目，但语言准确性和表达自然度仍有明显提分空间。最影响得分的是助词选择、动词自他关系和部分直译式表达。</p>
      </article>
      <article class="score-card">
        <h3>细致评分</h3>
        <ul class="score-list">${scoreRows}</ul>
      </article>
      <article class="score-card">
        <h3>主要扣分原因</h3>
        <ul class="issue-list">
          <li class="issue-card"><strong>助词使用不稳</strong><span>移动方向、动作场所和参加活动的表达需要区分。</span></li>
          <li class="issue-card"><strong>语法细节影响准确性</strong><span>「始まる / 始める」等自他动词关系需要重点讲解。</span></li>
          <li class="issue-card"><strong>表达略有中式日语</strong><span>部分句子可以换成更自然的作文句型。</span></li>
        </ul>
      </article>
    </div>
  `;

  return { total, max };
}

function renderApiOverview(result, type, name) {
  const score = result.score;
  scoreMeter.innerHTML = `<strong>${escapeHtml(score.total)}</strong><span>/ ${escapeHtml(score.max)}</span>`;
  const label = type === "major" ? "大作文" : `${minorType.value}类小作文`;
  resultTitle.textContent = `${name ? `${name} · ` : ""}${label}批改`;

  const scoreRows = result.rubric
    .map((item) => {
      const width = Math.round((Number(item.score) / Number(item.max)) * 100);
      return `
        <li class="score-line">
          <span>${escapeHtml(item.name)}</span>
          <div class="bar" aria-hidden="true"><i style="width:${width}%"></i></div>
          <strong>${escapeHtml(item.score)}/${escapeHtml(item.max)}</strong>
        </li>
      `;
    })
    .join("");

  const issues = score.majorIssues
    .map((issue) => `<li class="issue-card"><strong>${escapeHtml(issue)}</strong><span>${escapeHtml(issue)}</span></li>`)
    .join("");

  document.querySelector("#overview").innerHTML = `
    <div class="overview-grid">
      <article class="summary-card">
        <div class="item-head">
          <h3>整体判断</h3>
          <span class="level-pill ${score.level === "良好" || score.level === "优秀" ? "good" : "mid"}">${escapeHtml(score.level)}</span>
        </div>
        <p>${escapeHtml(score.summary)}</p>
      </article>
      <article class="score-card">
        <h3>细致评分</h3>
        <ul class="score-list">${scoreRows}</ul>
      </article>
      <article class="score-card">
        <h3>主要扣分原因</h3>
        <ul class="issue-list">${issues}</ul>
      </article>
    </div>
  `;
}

function renderErrors(type) {
  const groups = buildCorrections(type, minorType.value);
  document.querySelector("#errors").innerHTML = groups
    .map(
      (group) => `
      <section class="correction-group">
        <div class="group-title">
          <h3>${group.title}</h3>
          <span class="type-pill">${group.badge}</span>
        </div>
        <div class="correction-list">
          ${group.items
            .map(
              (item) => `
              <article class="correction-item">
                <div>
                  <div class="label">原句</div>
                  <div class="sentence">${highlightError(item.original, item.wrong)}</div>
                </div>
                <div>
                  <div class="label">问题位置</div>
                  <div class="sentence">${escapeHtml(item.problem)}</div>
                </div>
                <div>
                  <div class="label">修改建议</div>
                  <div class="sentence fix">${escapeHtml(item.fix)}</div>
                </div>
                <p class="explain">${escapeHtml(item.explain)}</p>
              </article>
            `
            )
            .join("")}
        </div>
      </section>
    `
    )
    .join("");
}

function renderApiErrors(groups) {
  document.querySelector("#errors").innerHTML = groups
    .map(
      (group) => `
      <section class="correction-group">
        <div class="group-title">
          <h3>${escapeHtml(group.category)}</h3>
          <span class="type-pill">${escapeHtml(group.badge)}</span>
        </div>
        <div class="correction-list">
          ${group.items
            .map(
              (item) => `
              <article class="correction-item">
                <div>
                  <div class="label">原句</div>
                  <div class="sentence">${highlightError(item.original, item.wrong)}</div>
                </div>
                <div>
                  <div class="label">问题位置</div>
                  <div class="sentence">${escapeHtml(item.problem)}</div>
                </div>
                <div>
                  <div class="label">修改建议</div>
                  <div class="sentence fix">${escapeHtml(item.fix)}</div>
                </div>
                <p class="explain">${escapeHtml(item.explain)}</p>
              </article>
            `
            )
            .join("")}
        </div>
      </section>
    `
    )
    .join("");
}

function renderPolish() {
  document.querySelector("#polish").innerHTML = `
    <ul class="polish-list">
      ${buildPolish()
        .map(
          (item) => `
          <li class="polish-card">
            <div>
              <div class="label">原句</div>
              <div class="sentence">${escapeHtml(item.original)}</div>
            </div>
            <div>
              <div class="label">润色后</div>
              <div class="sentence fix">${escapeHtml(item.polished)}</div>
            </div>
            <p class="explain"><strong>提升点：</strong>${escapeHtml(item.point)}</p>
            <p class="explain"><strong>可复用表达：</strong>${escapeHtml(item.reusable)}</p>
          </li>
        `
        )
        .join("")}
    </ul>
  `;
}

function renderApiPolish(items) {
  document.querySelector("#polish").innerHTML = `
    <ul class="polish-list">
      ${items
        .map(
          (item) => `
          <li class="polish-card">
            <div>
              <div class="label">原句</div>
              <div class="sentence">${escapeHtml(item.original)}</div>
            </div>
            <div>
              <div class="label">润色后</div>
              <div class="sentence fix">${escapeHtml(item.polished)}</div>
            </div>
            <p class="explain"><strong>提升点：</strong>${escapeHtml(item.point)}</p>
            <p class="explain"><strong>可复用表达：</strong>${escapeHtml(item.reusable)}</p>
          </li>
        `
        )
        .join("")}
    </ul>
  `;
}

function renderTeaching(type) {
  const isMinor = type === "minor";
  const title = isMinor ? `${minorType.value}类小作文修改范文` : "大作文修改范文";
  const modelEssay = isMinor
    ? `田中さんへ

明日、用事があるので、勉強会に参加できません。
本当にすみません。
次回はぜひ一緒に勉強したいです。

李明`
    : `私が一番好きな季節は春です。

春は暖かく、さまざまな花が咲くので、明るい気持ちになります。私は友達と公園へ行って、桜を見るのが好きです。きれいな桜を見ると、新しい生活が始まる季節だと感じます。

そのため、私は春が一番好きです。`;
  const explanation = isMinor
    ? "这版参考表达保留原意，重点修正应用文格式、助词和表达得体性。称呼、正文、署名单独分行后，更符合便条、留言类小作文的阅卷习惯。"
    : "这版参考表达保留学生原意，重点修正助词、动词自他关系和中式表达，并补充感受句，让内容更完整、表达更自然。";

  document.querySelector("#teaching").innerHTML = `
    <article class="teaching-card">
      <div class="item-head">
        <h3>${title}</h3>
        <span class="level-pill good">保留原意</span>
      </div>
      <div class="sentence fix model-essay">${escapeHtml(modelEssay)}</div>
      <p>${explanation}</p>
    </article>
    <article class="teaching-card" style="margin-top:16px">
      <h3>主要提升点</h3>
      <ul>
        <li>修正不自然的助词和动词搭配，提升语言准确性。</li>
        <li>保留学生原本意思，不改成超出高考水平的复杂表达。</li>
        <li>优化句子衔接和文体语气，让整体表达更自然。</li>
      </ul>
    </article>
  `;
}

function renderApiModelEssay(modelEssay) {
  document.querySelector("#teaching").innerHTML = `
    <article class="teaching-card">
      <div class="item-head">
        <h3>${escapeHtml(modelEssay.title)}</h3>
        <span class="level-pill good">参考表达</span>
      </div>
      <div class="sentence fix model-essay">${escapeHtml(modelEssay.essay)}</div>
      <p>${escapeHtml(modelEssay.explanation)}</p>
    </article>
    <article class="teaching-card" style="margin-top:16px">
      <h3>主要提升点</h3>
      <ul>
        ${modelEssay.improvements.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </article>
  `;
}

function renderReviewResult(result) {
  const type = getEssayType();
  renderApiOverview(result, type, studentName.value.trim());
  renderApiErrors(result.corrections);
  renderApiPolish(result.polish);
  renderApiModelEssay(result.modelEssay);
}

async function runReview(event) {
  event.preventDefault();
  const type = getEssayType();
  const essay = essayInput.value.trim();
  const promptText = promptInput.value.trim();

  if (!essay || !promptText) {
    document.querySelector("#overview").innerHTML = `
      <div class="empty-state">
        <h3>还缺少内容</h3>
        <p>请先填写题目要求，并通过 OCR 识别或校对学生作文文本，再开始批改。</p>
      </div>
    `;
    resultTitle.textContent = "等待完整输入";
    scoreMeter.innerHTML = `<strong>--</strong><span>/ ${type === "major" ? 30 : 10}</span>`;
    return;
  }

  const submitButton = form.querySelector("button[type='submit']");
  submitButton.disabled = true;
  submitButton.textContent = "正在批改...";

  try {
    const response = await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getApiEssayPayload()),
    });

    if (!response.ok) throw new Error("review api unavailable");
    const result = await response.json();
    renderReviewResult(result);
  } catch (error) {
    const scores = scoreEssay(type, essay, promptText);
    renderOverview(scores, type, studentName.value.trim());
    renderErrors(type);
    renderPolish();
    renderTeaching(type);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "开始批改";
  }
}

essayTypeInputs.forEach((input) => input.addEventListener("change", toggleMinorType));
form.addEventListener("submit", runReview);
essayImage.addEventListener("change", (event) => previewUploadedImage(event.target.files[0]));

["dragenter", "dragover"].forEach((eventName) => {
  uploadZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadZone.classList.add("dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  uploadZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadZone.classList.remove("dragging");
  });
});

uploadZone.addEventListener("drop", (event) => {
  const file = event.dataTransfer.files[0];
  if (!file) return;
  essayImage.files = event.dataTransfer.files;
  previewUploadedImage(file);
});

runOcr.addEventListener("click", async () => {
  if (!hasUploadedImage) {
    setOcrStatus("请先上传学生手写作文图片。", "error");
    return;
  }

  runOcr.disabled = true;
  setOcrStatus("正在识别手写日语...", "ready");

  if (useMockOcr) {
    window.setTimeout(() => {
      essayInput.value = getOcrDemoText();
      setOcrStatus("OCR 示例识别完成，请老师校对后开始批改。", "success");
      runOcr.disabled = false;
    }, 700);
    return;
  }

  try {
    const response = await fetch("/api/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageDataUrl: ocrImageDataUrl || previewImage.src,
        essayType: getEssayType(),
        minorType: getEssayType() === "minor" ? minorType.value : "",
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "OCR 接口请求失败。");
    }
    const result = await response.json();
    essayInput.value = result.text || "";
    setOcrStatus(result.provider ? `识别完成：${result.provider}，请老师校对后开始批改。` : "识别完成，请老师校对后开始批改。", "success");
  } catch (error) {
    essayInput.value = getOcrDemoText();
    setOcrStatus(`真实 OCR 未完成：${error.message} 已填入演示识别结果。`, "error");
  } finally {
    runOcr.disabled = false;
  }
});

tabs.forEach((tab) => {
  tab.setAttribute("aria-selected", String(tab.classList.contains("active")));
  tab.addEventListener("click", () => switchTab(tab.dataset.tab));
});

tabList.addEventListener("click", (event) => {
  const tab = event.target.closest(".tab");
  if (!tab) return;
  switchTab(tab.dataset.tab);
});

loadSample.addEventListener("click", () => {
  const type = getEssayType();
  promptInput.value = sampleData[type].prompt;
  essayInput.value = "";
  studentName.value = type === "major" ? "高三 2 班 A12" : "高三 1 班 B06";
  hasUploadedImage = true;
  useMockOcr = true;
  ocrImageDataUrl = sampleImage;
  imagePreview.classList.remove("hidden");
  previewImage.src = sampleImage;
  previewImage.alt = "OCR 示例图片占位";
  setOcrStatus("已载入 OCR 示例，可点击识别手写日语。", "ready");
});

toggleMinorType();
