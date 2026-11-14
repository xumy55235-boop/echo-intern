/* ==========================================================================
   diagnose.js —— 简历对标诊断引擎 + 页面渲染
      Echo.diag.analyze(resume, jd)   纯规则诊断，离线可用
      Echo.diag.demo                   示例简历 / 示例 JD（方便一键演示）
   诊断思路（对应产品定义里的「把不确定变成有依据」）：
      1. 先从 JD 里识别目标岗位族，抽出一份「要求清单」；
      2. 再用岗位技能词典去比对简历，分成「命中」与「缺口」；
      3. 按四个维度打分：关键词覆盖 60 分 + 量化表达 20 分 + 动词强度 10 分 + 结构完整 10 分；
      4. 缺口逐条给出「怎么补」，并把简历里的弱表达改写示范一遍。
   ========================================================================== */
window.Echo = window.Echo || {};

(function () {
  "use strict";
  var util = Echo.util;

  /* ---------------- 文本工具 ---------------- */
  function lower(s) { return String(s || "").toLowerCase(); }

  function aliasHit(text, alias) {
    var t = lower(text), a = lower(alias);
    if (!a) return false;
    if (a.length <= 3) {
      // 短词（js / ui / pm / go）用词边界匹配，避免 json 命中 js 这类误判
      var re = new RegExp("(^|[^a-z0-9])" + a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z0-9]|$)");
      return re.test(t);
    }
    return t.indexOf(a) >= 0;
  }

  function skillHit(text, skill) {
    for (var i = 0; i < skill.aliases.length; i++) {
      if (aliasHit(text, skill.aliases[i])) return skill.aliases[i];
    }
    return null;
  }

  /* ---------------- 岗位族识别 ---------------- */
  function detectRole(jd) {
    var hit = { key: "通用", n: 0 };
    Echo.seed.roles.forEach(function (r) {
      var n = 0;
      r.words.forEach(function (w) { if (aliasHit(jd, w)) n++; });
      if (n > hit.n) hit = { key: r.key, n: n };
    });
    return hit.key;
  }

  /* ---------------- 从 JD 抽要求 ---------------- */
  var REQ_WORDS = ["要求", "任职", "资格", "职责", "熟悉", "熟练", "掌握", "了解", "具备", "优先", "有经验", "能力", "负责", "参与"];

  function extractRequirements(jd) {
    var parts = String(jd || "").split(/[\n。；;]|[0-9][.、)]/);
    var out = [];
    parts.forEach(function (p) {
      var s = p.trim().replace(/^[、,，·\-—●•\s]+/, "");
      if (s.length < 4 || s.length > 90) return;
      for (var i = 0; i < REQ_WORDS.length; i++) {
        if (s.indexOf(REQ_WORDS[i]) >= 0) { out.push(s); return; }
      }
    });
    return util.uniq(out).slice(0, 9);
  }

  /** 硬性门槛（年级 / 到岗天数 / 专业 / 学历），帮用户先排除"根本不符合"的岗位 */
  function extractHardTerms(jd) {
    var t = String(jd || ""), out = [];
    var pats = [
      { re: /(大[一二三四]|本科|硕士|研究生|应届)/g, tip: "学历 / 年级门槛" },
      { re: /每周[^，。；\n]{0,6}天/g, tip: "到岗时间要求" },
      { re: /(专业不限|[^，。；\n]{2,6}专业(优先|相关)?)/g, tip: "专业要求" },
      { re: /(实习期[^，。；\n]{0,8}|实习[^，。；\n]{0,4}个月)/g, tip: "实习时长" }
    ];
    pats.forEach(function (p) {
      var m = t.match(p.re);
      if (m) out.push({ tip: p.tip, text: util.uniq(m).slice(0, 3).join(" / ") });
    });
    return out;
  }

  /* ---------------- 弱动词 / 量化 ---------------- */
  var WEAK_VERBS = ["参与", "协助", "负责", "帮助", "配合", "学习", "了解", "接触", "尝试", "跟进一些", "做一些"];
  var STRONG_VERBS = ["独立完成", "主导", "推动", "搭建", "设计", "优化", "提升", "实现", "沉淀", "复用"];

  function lineList(text) {
    return String(text || "").split(/\n+/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 3; });
  }

  function scanWeak(text) {
    var found = [];
    lineList(text).forEach(function (line) {
      WEAK_VERBS.forEach(function (v) {
        if (line.indexOf(v) >= 0 && found.length < 6) {
          if (!found.some(function (f) { return f.line === line; })) found.push({ verb: v, line: line });
        }
      });
    });
    return found;
  }

  function countNumbers(text) {
    var m = String(text || "").match(/\d+(\.\d+)?\s*(%|％|万|人|次|天|份|个|小时|名|元)/g);
    var plain = String(text || "").match(/\d{2,}/g);
    var n = (m ? m.length : 0);
    return n > 0 ? n : Math.min(2, plain ? plain.length : 0);
  }

  /* ---------------- 结构检查 ---------------- */
  var SECTIONS = [
    { key: "edu", name: "教育背景", words: ["教育", "学校", "学历", "本科", "专业", "GPA", "在校"] },
    { key: "skill", name: "技能清单", words: ["技能", "掌握", "熟练", "工具", "语言"] },
    { key: "exp", name: "项目 / 实习经历", words: ["项目", "实习", "实践", "经历", "作品"] },
    { key: "campus", name: "校园 / 荣誉 / 证书", words: ["社团", "学生会", "班委", "获奖", "竞赛", "证书", "志愿"] }
  ];

  function checkSections(text) {
    return SECTIONS.map(function (s) {
      var has = s.words.some(function (w) { return text.indexOf(w) >= 0; });
      return { key: s.key, name: s.name, has: has };
    });
  }

  /* ---------------- 改写建议 ---------------- */
  function buildRewrites(weak) {
    var tips = {
      "参与": "写明你在其中独立负责的那部分，以及最后的产出物",
      "协助": "换成「独立完成 X，支撑了 Y」，别把功劳让给别人",
      "负责": "「负责」只是分工，后面必须接一句可验证的结果",
      "配合": "写清你对接了谁、推进了什么、解决了什么问题",
      "学习": "学习过程不是成果，写你用它做出了什么",
      "了解": "「了解」太弱，改成「能用 X 完成 Y」"
    };
    return weak.slice(0, 4).map(function (w) {
      var clean = w.line.replace(/^[·\-•\d\s.、]+/, "");
      return {
        verb: w.verb,
        from: clean.slice(0, 46) + (clean.length > 46 ? "…" : ""),
        how: tips[w.verb] || "补一句可量化的结果，让 HR 能评估它的价值",
        to: "用「动作 + 对象 + 结果」重写，例如：「" + clean.slice(0, 14) + "…，最终使 X 提升 N% / 覆盖 N 人」"
      };
    });
  }

  /* ---------------- 主诊断 ---------------- */
  function analyze(resume, jd) {
    resume = String(resume || "");
    jd = String(jd || "");
    var role = detectRole(jd + " " + resume);

    // 1) 关键词：以 JD 中出现的技能为"要求集合"
    var required = [], matched = [], gaps = [];
    var weightAll = 0, weightHit = 0;
    Echo.seed.skills.forEach(function (sk) {
      var inJd = skillHit(jd, sk);
      var inResume = skillHit(resume, sk);
      if (inJd) {
        required.push(sk);
        weightAll += sk.weight;
        if (inResume) { matched.push({ name: sk.name, family: sk.family, weight: sk.weight, ev: inResume }); weightHit += sk.weight; }
        else gaps.push({ name: sk.name, family: sk.family, weight: sk.weight, how: sk.how });
      } else if (inResume) {
        matched.push({ name: sk.name, family: sk.family, weight: sk.weight, ev: inResume, extra: true });
      }
    });

    // JD 里没识别出技能时退化为"岗位族通用要求"，避免出现"0 项要求"的尴尬结果
    if (!required.length) {
      required = Echo.seed.skills.filter(function (sk) { return sk.family === role || sk.family === "通用"; });
      required.forEach(function (sk) {
        weightAll += sk.weight;
        if (skillHit(resume, sk)) weightHit += sk.weight;
        else gaps.push({ name: sk.name, family: sk.family, weight: sk.weight, how: sk.how });
      });
    }

    // 2) 四个维度的分数
    var kwScore = weightAll ? (weightHit / weightAll) * 60 : 30;
    var nums = countNumbers(resume);
    var quantScore = nums === 0 ? 8 : nums <= 2 ? 14 : nums <= 5 ? 18 : 20;
    var weak = scanWeak(resume);
    var verbScore = weak.length === 0 ? 10 : weak.length <= 1 ? 10 : weak.length <= 3 ? 7 : weak.length <= 5 ? 4 : 2;
    var sections = checkSections(resume);
    var structScore = sections.filter(function (s) { return s.has; }).length * 2.5;

    var score = Math.round(kwScore + quantScore + verbScore + structScore);
    score = util.clamp(score, 0, 100);

    var grade, tone, verdict;
    if (score >= 78) {
      grade = "A"; tone = "mint";
      verdict = gaps.length
        ? "可以直接投 —— 匹配度不错。投之前把下面 " + Math.min(2, gaps.length) + " 个缺口在简历里补一句，回音率还会更高。"
        : "可以直接投 —— 关键词覆盖很完整，投完记得在台账里记一笔，7 天没动静就主动跟进。";
    } else if (score >= 60) {
      grade = "B"; tone = "amber";
      verdict = "先改再投 —— 差 " + gaps.length + " 个关键词，花 30 分钟照 JD 补一遍表述，能明显降低「已送达」概率。";
    } else {
      grade = "C"; tone = "rose";
      verdict = "建议先补再投 —— 现在投出去的成本是「又一份没回音」。先把下面 2-3 个缺口补上，再回来投这份岗位。";
    }

    var dims = [
      { name: "关键词覆盖", value: Math.round(kwScore), max: 60, tip: "目标 JD 要求 vs 简历命中" },
      { name: "量化表达", value: quantScore, max: 20, tip: "有数字的结果更可信（当前 " + nums + " 处）" },
      { name: "动词强度", value: verbScore, max: 10, tip: weak.length ? "有 " + weak.length + " 处「参与 / 协助 / 负责」这类弱表达" : "没有明显弱动词，很好" },
      { name: "结构完整", value: Math.round(structScore), max: 10, tip: sections.filter(function (s) { return !s.has; }).map(function (s) { return "缺 " + s.name; }).join("、") || "四个板块都在" }
    ];

    return {
      at: util.nowStamp(), role: role, score: score, grade: grade, tone: tone, verdict: verdict,
      resumeLen: resume.length, jdLen: jd.length,
      matchRate: util.pct(weightHit, weightAll || 1),
      matched: util.sortBy(matched, function (m) { return -m.weight; }),
      gaps: util.sortBy(gaps, function (g) { return -g.weight; }),
      dims: dims, requirements: extractRequirements(jd), hardTerms: extractHardTerms(jd),
      sections: sections, weak: weak, numberCount: nums,
      rewrites: buildRewrites(weak), strongCount: STRONG_VERBS.filter(function (v) { return resume.indexOf(v) >= 0; }).length
    };
  }

  /* ---------------- 示例数据（一键演示用） ---------------- */
  var demoResume = [
    "教育背景",
    "XX 大学 信息管理专业 本科在读 大二  2023.09 - 2027.06",
    "主修课程：数据库原理、管理信息系统、Python 程序设计、统计学",
    "",
    "技能",
    "· 熟悉 Python 基础语法，了解 MySQL 与基本 SQL 查询",
    "· 熟练使用 Excel（数据透视表、VLOOKUP），会一点 PPT 排版",
    "· 了解 HTML/CSS，能改简单的页面",
    "",
    "项目经历",
    "校园二手书交易小程序（课程作业）  2025.03 - 2025.06",
    "· 参与需求讨论，负责部分页面文案与测试",
    "· 协助整理用户反馈，配合组员完成上线",
    "",
    "社团与荣誉",
    "· 校学生会宣传部干事，参与 3 次校级活动宣传",
    "· 获得学院二等奖学金一次",
    "",
    "其他",
    "· 英语四级 528 分，可阅读英文技术文档"
  ].join("\n");

  var demoJd = [
    "岗位：数据分析实习生（可转正）",
    "岗位职责：",
    "1. 负责业务数据的提取与清洗，输出日常数据报表；",
    "2. 参与指标体系的搭建，跟进核心指标的波动原因；",
    "3. 配合业务方完成专题分析，沉淀分析方法并复用。",
    "任职要求：",
    "1. 本科在读，大二及以上，每周到岗 3 天以上；",
    "2. 熟练掌握 SQL 进行数据提取，了解窗口函数者优先；",
    "3. 熟练使用 Excel / Python（pandas）进行数据分析；",
    "4. 对留存、转化等指标有基本理解，具备数据敏感度；",
    "5. 统计学、数学、信息管理相关专业优先；",
    "6. 沟通表达清晰，有社团或学生工作经历加分。"
  ].join("\n");

  Echo.diag = { analyze: analyze, demo: { resume: demoResume, jd: demoJd } };
})();

/* ==========================================================================
   页面渲染
   ========================================================================== */
(function () {
  "use strict";
  var util = Echo.util, ui = Echo.ui, store = Echo.store, diag = Echo.diag;

  var last = null;

  function T(id) { return document.getElementById(id); }

  /* 结果为空时的占位 */
  function renderPlaceholder() {
    T("result").innerHTML =
      '<div class="card">' +
        ui.empty("◎", "填好上面两项，3 分钟出结果",
          "会给出总分、四个维度的分数、命中的关键词、缺什么以及怎么补。") +
        '<div class="note note--ico">' +
          '<span class="ico">↗</span><span>' +
          '<span class="note__t">不想自己写？点右上角「填入示例」</span>' +
          "用一份「大二学生投数据分析实习」的简历与 JD，先看整套诊断长什么样。</span></div>" +
      "</div>";
  }

  /* 读取输入 */
  function readResume() {
    var mode = document.querySelector(".seg__btn.is-on").getAttribute("data-mode");
    if (mode === "blocks") {
      var parts = [];
      if (T("bEdu").value.trim()) parts.push("教育背景\n" + T("bEdu").value.trim());
      if (T("bSkill").value.trim()) parts.push("技能\n" + T("bSkill").value.trim());
      if (T("bProj").value.trim()) parts.push("项目 / 实习经历\n" + T("bProj").value.trim());
      if (T("bCampus").value.trim()) parts.push("校园经历与荣誉\n" + T("bCampus").value.trim());
      return parts.join("\n\n");
    }
    return T("resumeText").value.trim();
  }

  function addGapsToSprint(gaps, navigate) {
    var added = 0;
    gaps.slice(0, 2).forEach(function (g) {
      store.addSprintItem("补一个缺口：" + g.name + "（" + g.family + "）", "补缺", "gap");
      added++;
    });
    ui.toast(added ? "已把 " + added + " 个缺口加入本周清单" : "这个岗位没有明显缺口，不用补", added ? "mint" : "amber");
    if (added && navigate) setTimeout(function () { location.href = "sprint.html"; }, 900);
  }

  /* 渲染诊断结果 */
  function render(result) {
    var host = T("result");
    var color = result.tone === "mint" ? "success" : result.tone === "amber" ? "warn" : "danger";
    var toneText = { mint: "匹配良好", amber: "还需打磨", rose: "缺口较大" }[result.tone];

    var dimRows = result.dims.map(function (d) {
      var p = Math.round(d.value / d.max * 100);
      var tone = p >= 75 ? "mint" : p >= 45 ? "amber" : "rose";
      return '<div class="mt-2">' +
        '<div class="row row--between" style="font-size:12px">' +
          "<span style=\"font-weight:650\">" + d.name + "</span>" +
          '<span style="color:var(--muted)">' + d.value + " / " + d.max + "</span>" +
        "</div>" +
        '<div class="meter meter--thin mt-1"><div class="meter__bar meter__bar--' + tone + '" style="width:' + p + '%"></div></div>' +
        '<div class="field-note" style="margin-top:3px">' + util.esc(d.tip) + "</div>" +
      "</div>";
    }).join("");

    var gapHTML = result.gaps.length
      ? '<div class="list">' + result.gaps.slice(0, 6).map(function (g, i) {
          return '<div class="list__item">' +
            '<div class="list__ico" style="background:var(--danger-soft);color:var(--danger)">补</div>' +
            '<div style="flex:1;min-width:0">' +
              '<div class="list__t">' + util.esc(g.name) +
                ' <span class="badge badge--line">' + util.esc(g.family) + "</span></div>" +
              '<div class="list__d">怎么补：' + util.esc(g.how) + "</div>" +
            "</div>" +
            '<button class="mini-btn" data-gap="' + i + '">加进清单</button>' +
          "</div>";
        }).join("") + "</div>"
      : '<div class="note note--mint note--ico"><span class="ico">✓</span><span>JD 里的关键词基本都被你的简历覆盖到了，可以直接投。</span></div>';

    var matchedHTML = result.matched.length
      ? '<div class="chips">' + result.matched.slice(0, 16).map(function (m) {
          return '<span class="chip chip--plain">✓ ' + util.esc(m.name) + "</span>";
        }).join("") + "</div>"
      : '<div class="field-note">简历里没有识别出与这个岗位相关的技能关键词。</div>';

    var rewriteHTML = result.rewrites.length
      ? result.rewrites.slice(0, 3).map(function (r) {
          return '<div class="hit">' +
            '<div class="hit__lv" style="background:var(--warn)"></div>' +
            '<div style="flex:1;min-width:0"><div class="hit__t">"' + util.esc(r.from) + '"</div>' +
            '<div class="hit__d">' + util.esc(r.how) + "</div>" +
            '<div class="field-note" style="color:var(--text-2)">改写示范：' + util.esc(r.to) + "</div></div></div>";
        }).join("")
      : '<div class="note note--mint note--ico"><span class="ico">✓</span><span>没有看到明显的弱表达，继续用「动作 + 结果」写就够了。</span></div>';

    var schemaRows = result.sections.map(function (s) {
      return '<div class="row" style="justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--line-2)">' +
        "<span>" + util.esc(s.name) + "</span>" +
        (s.has ? '<span class="badge badge--mint">已有</span>' : '<span class="badge badge--rose">缺失</span>') + "</div>";
    }).join("");

    var hardHTML = result.hardTerms.length
      ? '<div class="list">' + result.hardTerms.map(function (h) {
          return '<div class="list__item"><div class="list__ico">!</div><div>' +
            '<div class="list__t">' + util.esc(h.tip) + "</div>" +
            '<div class="list__d">' + util.esc(h.text) + " —— 先确认自己是否满足，不满足的岗位投了也很难有回音。</div></div></div>";
        }).join("") + "</div>"
      : '<div class="field-note">这段 JD 里没有写明硬性门槛（年级 / 到岗天数 / 专业）。</div>';

    var reqHTML = result.requirements.length
      ? '<div class="list">' + result.requirements.map(function (r, i) {
          return '<div class="list__item"><div class="list__ico">' + (i + 1) + "</div><div><div class=\"list__d\">" + util.esc(r) + "</div></div></div>";
        }).join("") + "</div>"
      : '<div class="field-note">没能识别出要求条目 —— 把 JD 的「任职要求」整段复制进来会更准。</div>';

    host.innerHTML =
      '<div class="card card--accent">' +
        '<div class="card__head">' +
          '<div class="card__ico">◈</div>' +
          '<div style="flex:1;min-width:0">' +
            '<div class="card__title">诊断结果 · ' + util.esc(result.role) + " 方向</div>" +
            '<div class="card__desc">' + util.esc(result.at) + "</div>" +
          "</div>" +
          '<span class="badge badge--' + (result.tone === "mint" ? "mint" : result.tone === "amber" ? "amber" : "rose") + '">' + toneText + "</span>" +
        "</div>" +
        '<div class="score-hero">' +
          '<div>' +
            '<div class="score-big" style="color:var(--' + color + ')">' + result.score + "</div>" +
            '<div class="field-note" style="margin-top:0">匹配分 / 100</div>' +
          "</div>" +
          '<div class="grade grade--' + result.tone + '">' + result.grade + "</div>" +
          '<div style="flex:1;min-width:180px">' +
            '<div style="font-weight:650;font-size:12.6px">关键词命中率 ' + result.matchRate + "%</div>" +
            '<div class="card__desc mt-1">' + util.esc(result.verdict) + "</div>" +
          "</div>" +
        "</div>" +
        dimRows +
        '<div class="row mt-2">' +
          '<span class="badge badge--line">量化 ' + result.numberCount + " 处</span>" +
          '<span class="badge badge--line">强动词 ' + result.strongCount + " 处</span>" +
          '<span class="badge badge--line">弱表达 ' + result.weak.length + " 处</span>" +
        "</div>" +
      "</div>" +

      '<div class="card mt-2">' +
        '<div class="card__head">' +
          '<div class="card__ico card__ico--rose">◌</div>' +
          '<div style="flex:1;min-width:0">' +
            '<div class="card__title">差什么 · 按重要度排序</div>' +
            '<div class="card__desc">JD 提到、简历里没有的，每条都给了补法</div>' +
          "</div>" +
        "</div>" +
        gapHTML +
      "</div>" +

      '<div class="card mt-2">' +
        '<div class="card__head">' +
          '<div class="card__ico card__ico--amber">✎</div>' +
          '<div style="flex:1;min-width:0">' +
            '<div class="card__title">二改建议</div>' +
            '<div class="card__desc">同一段经历，换一种写法，回音率不一样</div>' +
          "</div>" +
        "</div>" +
        rewriteHTML +
      "</div>" +

      '<details class="fold mt-2">' +
        '<summary>已命中 ' + result.matched.length + " 项 · 板块完整度</summary>" +
        '<div class="fold__body">' + matchedHTML +
          '<div class="mt-2">' + schemaRows + "</div>" +
        "</div>" +
      "</details>" +

      '<details class="fold mt-2">' +
        '<summary>JD 硬性门槛 · 先自查</summary>' +
        '<div class="fold__body">' + hardHTML + "</div>" +
      "</details>" +

      '<details class="fold mt-2">' +
        '<summary>JD 要求清单（' + result.requirements.length + " 条）</summary>" +
        '<div class="fold__body">' + reqHTML + "</div>" +
      "</details>" +

      '<div class="card mt-2">' +
        '<div class="card__head">' +
          '<div class="card__ico card__ico--mint">→</div>' +
          '<div style="flex:1;min-width:0">' +
            '<div class="card__title">现在就可以做</div>' +
            '<div class="card__desc">诊断的意义不是打分，而是给出下一步动作</div>' +
          "</div>" +
        "</div>" +
        '<div class="row">' +
          '<button class="btn btn--primary" id="btnToSprint">缺口加进本周清单</button>' +
          '<a class="btn" href="tracker.html">记录这条投递</a>' +
          '<a class="btn" href="radar.html">先查这家公司</a>' +
          '<button class="btn btn--ghost" id="btnAgain">再诊断一次</button>' +
        "</div>" +
      "</div>";

    T("btnToSprint").onclick = function () { addGapsToSprint(result.gaps, true); };
    T("btnAgain").onclick = function () {
      document.getElementById("inputCard").scrollIntoView({ behavior: "smooth", block: "start" });
    };
    host.querySelectorAll("[data-gap]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var g = result.gaps[Number(btn.getAttribute("data-gap"))];
        if (!g) return;
        store.addSprintItem("补一个缺口：" + g.name + "（" + g.family + "）", "补缺", "gap");
        ui.toast("已把「" + g.name + "」加入本周清单", "mint");
        btn.disabled = true;
        btn.textContent = "已加入";
      });
    });
  }

  /* 历史诊断记录 */
  function renderHistory() {
    var runs = store.diagnoseRuns();
    var host = T("history");
    if (!runs.length) {
      host.innerHTML = '<div class="field-note">还没有诊断记录，做完一次就会出现在这里。</div>';
      return;
    }
    host.innerHTML = '<div class="list">' + runs.slice(0, 6).map(function (r) {
      var tone = r.score >= 78 ? "success" : r.score >= 60 ? "warn" : "danger";
      return '<div class="list__item">' +
        '<div class="list__ico" style="background:var(--' + tone + '-soft);color:var(--' + tone + ')">' + r.score + "</div>" +
        '<div style="flex:1;min-width:0"><div class="list__t">' + util.esc(r.role) + " 方向 · 等级 " + r.grade + "</div>" +
        '<div class="list__d">缺口 ' + (r.gaps ? r.gaps.length : 0) + " 项 · " + util.esc(r.at) + "</div></div>" +
        '<button class="mini-btn" data-run="' + r.id + '">看结论</button>' +
      "</div>";
    }).join("") + "</div>";

    host.querySelectorAll("[data-run]").forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute("data-run");
        var run = null;
        store.diagnoseRuns().forEach(function (r) { if (r.id === id) run = r; });
        if (!run) return;
        ui.modal({
          title: "历史诊断 · " + run.role + " 方向",
          wide: true,
          body: '<div class="score-hero"><div class="score-big" style="font-size:38px">' + run.score + "</div>" +
                '<div class="grade grade--' + run.tone + '">' + run.grade + "</div>" +
                '<div style="flex:1"><div class="card__desc">' + util.esc(run.verdict || "") + "</div></div></div>" +
                '<div class="mt-2"><div class="card__desc">当时识别到的缺口</div><div class="chips mt-1">' +
                (run.gaps || []).map(function (g) { return '<span class="chip chip--plain">' + util.esc(g.name) + "</span>"; }).join("") +
                "</div></div>",
          foot: '<button class="btn btn--primary" data-x="1">知道了</button>'
        });
      };
    });
  }

  /* 视图切换 */
  function initTabs() {
    document.querySelectorAll("[data-mode]").forEach(function (tab) {
      tab.onclick = function () {
        document.querySelectorAll("[data-mode]").forEach(function (t) { t.classList.remove("is-on"); });
        tab.classList.add("is-on");
        var blocks = tab.getAttribute("data-mode") === "blocks";
        T("blockForm").style.display = blocks ? "" : "none";
        T("pasteForm").style.display = blocks ? "none" : "";
      };
    });
  }

  function runDiagnose() {
    var resume = readResume();
    var jd = T("jdText").value.trim();
    if (resume.length < 60) { ui.toast("简历内容太少（至少 60 字），先把你写的简历贴进来", "amber"); return; }
    if (jd.length < 30) { ui.toast("JD 太短了，把「任职要求」那一段也复制进来", "amber"); return; }

    var result = diag.analyze(resume, jd);
    last = result;
    render(result);

    store.addDiagnoseRun({
      role: result.role, score: result.score, grade: result.grade, tone: result.tone,
      verdict: result.verdict, matchRate: result.matchRate,
      gaps: result.gaps.map(function (g) { return { name: g.name, family: g.family, how: g.how }; }),
      jdText: jd.slice(0, 1200), resumeText: resume.slice(0, 1200),
      dims: result.dims
    });
    renderHistory();
    T("result").scrollIntoView({ behavior: "smooth", block: "start" });
    ui.toast("诊断完成：匹配度 " + result.score + " 分（" + result.grade + " 级）", result.tone);
  }

  /* 初始化 */
  ui.mountNav("diagnose");
  initTabs();
  renderPlaceholder();
  renderHistory();
  T("btnRun").onclick = runDiagnose;

  T("btnDemo").onclick = function () {
    T("roleName").value = "数据分析实习生";
    T("jdText").value = diag.demo.jd;
    document.querySelector('[data-mode="paste"]').click();
    T("resumeText").value = diag.demo.resume;
    ui.toast("已填入示例简历与 JD，点「开始诊断」试试", "mint");
    T("inputCard").scrollIntoView({ behavior: "smooth", block: "start" });
  };

  T("btnClear").onclick = function () {
    T("roleName").value = "";
    T("jdText").value = "";
    T("resumeText").value = "";
    ["bEdu", "bSkill", "bProj", "bCampus"].forEach(function (k) { T(k).value = ""; });
    renderPlaceholder();
    ui.toast("已清空输入");
  };
})();
