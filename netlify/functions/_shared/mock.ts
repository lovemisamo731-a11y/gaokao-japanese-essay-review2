export function mockOcrText(essayType: string) {
  if (essayType === "minor") {
    return "田中さんへ。明日、私は用事があるので、勉強会で行くことができません。すみません。次の時に一緒に勉強します。李明";
  }

  return "私の好きな季節は春です。春に天気が暖かくて、花がたくさん咲きます。私は友達と公園で行きます。桜を見ることが好きです。春は新しい生活を始まる季節と思います。だから、私は春が一番好きです。";
}

export function mockReview(essayType: string, minorType: string) {
  const isMinor = essayType === "minor";

  return {
    score: {
      total: isMinor ? 7.4 : 24.5,
      max: isMinor ? 10 : 30,
      level: "良好",
      summary: "作文基本回应题目要求，但助词选择、动词搭配和部分直译式表达仍有明显提分空间。",
      majorIssues: ["助词使用不稳", "动词自他关系需要修正", "部分表达偏中式日语"],
    },
    rubric: isMinor
      ? [
          { name: "信息点完整", max: 3, score: 2.4, reason: "主要信息基本完整。" },
          { name: "应用文格式", max: 2, score: 1.4, reason: "称呼、正文、署名最好分行。" },
          { name: "语法准确性", max: 2, score: 1.4, reason: "存在动词和表达问题。" },
          { name: "助词使用", max: 1, score: 0.6, reason: "「勉強会で行く」助词不当。" },
          { name: "表达得体自然", max: 1, score: 0.8, reason: "道歉语气基本得体。" },
          { name: "文体统一", max: 1, score: 0.8, reason: "整体文体较统一。" },
        ]
      : [
          { name: "内容完整度", max: 6, score: 5, reason: "能围绕喜欢春天展开。" },
          { name: "结构逻辑", max: 5, score: 4.2, reason: "开头和结尾清楚，展开略薄。" },
          { name: "语法准确性", max: 7, score: 5, reason: "存在自他动词和句型问题。" },
          { name: "助词使用", max: 4, score: 2.5, reason: "移动方向和主题助词不稳。" },
          { name: "词汇与表达", max: 4, score: 3.4, reason: "表达基本清楚，但略有直译。" },
          { name: "文体统一与自然度", max: 2, score: 1.6, reason: "整体自然度尚可。" },
          { name: "字数与格式", max: 2, score: 2, reason: "格式基本符合。" },
        ],
    corrections: [
      {
        category: "助词错误",
        badge: "重点扣分项",
        items: [
          {
            original: "私は友達と公園で行きます。",
            wrong: "で",
            problem: "公園で行きます",
            fix: "私は友達と公園へ行きます。",
            explain: "「で」表示动作发生的场所，「へ」表示移动方向。这里是去公园，应使用「へ」或「に」。",
          },
          {
            original: "勉強会で行くことができません。",
            wrong: "で",
            problem: "勉強会で行く",
            fix: "勉強会に行くことができません。",
            explain: "「勉強会」是动作到达的对象或参加的活动，用「に」更自然。",
          },
        ],
      },
      {
        category: "语法错误",
        badge: "需要讲解",
        items: [
          {
            original: "春は新しい生活を始まる季節と思います。",
            wrong: "生活を始まる",
            problem: "生活を始まる",
            fix: "春は新しい生活が始まる季節だと思います。",
            explain: "「始まる」是不及物动词，主语用「が」。",
          },
        ],
      },
    ],
    polish: [
      {
        original: "私の好きな季節は春です。",
        polished: "私が一番好きな季節は春です。",
        point: "用「一番」突出主题，开头更明确。",
        reusable: "私が一番〜のは〜です。",
      },
      {
        original: "すみません。次の時に一緒に勉強します。",
        polished: "本当にすみません。次回はぜひ一緒に勉強したいです。",
        point: "语气更礼貌，更符合应用文场景。",
        reusable: "次回はぜひ〜したいです。",
      },
    ],
    modelEssay: {
      title: isMinor ? `${minorType || "留言"}类小作文修改范文` : "大作文修改范文",
      essay: isMinor
        ? "田中さんへ\n\n明日、用事があるので、勉強会に参加できません。\n本当にすみません。\n次回はぜひ一緒に勉強したいです。\n\n李明"
        : "私が一番好きな季節は春です。\n\n春は暖かく、さまざまな花が咲くので、明るい気持ちになります。私は友達と公園へ行って、桜を見るのが好きです。きれいな桜を見ると、新しい生活が始まる季節だと感じます。\n\nそのため、私は春が一番好きです。",
      explanation: "这版范文保留学生原意，修正助词、语法和中式表达，控制在高考日语作文可模仿水平。",
      improvements: ["修正助词和动词搭配", "保留原意但提升自然度", "增加自然衔接和完整表达"],
    },
  };
}
