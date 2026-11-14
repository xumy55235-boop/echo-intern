/* ==========================================================================
   radar.js —— 防坑雷达：粘贴招聘信息 → 规则匹配打分 → 命中证据 + 应对建议
   规则库：Echo.seed.radarRules；话术词典：Echo.seed.phrases
   历史：Echo.store.radarRuns / addRadarRun；清单勾选存 localStorage 独立 key
   ========================================================================== */
(function () {
  "use strict";
  var util = Echo.util, ui = Echo.ui, store = Echo.store;

  var CHECK_KEY = "huiyin_radar_check";

  /* ---------------- 示例：一段典型可疑招聘（含常见套路特征） ---------------- */
  var EXAMPLE = [
    "【急招】市场运营助理 · 当天入职（学历不限）",
    "1. 月入过万，底薪 + 高提成，应届生优先，入职即签包 offer 协议；",
    "2. 学历不限、专业不限，无需经验，会用手机就能做；",
    "3. 公司统一安排免费培训，入职需先交 380 元服装费与工牌押金，做满一个月退还；",
    "4. 培训期间费用可分期付款，转正后从工资里扣，并签订包就业协议；",
    "5. 工作轻松，主要是线上做任务、点赞返利，多劳多得；",
    "6. 名额有限，大量招聘，请尽快加微信 HR666 私聊报名；",
    "7. 面试请携带身份证正反面照片，方便当天办理入职；",
    "8. 具体工作地点加微信后发定位，非诚勿扰。"
  ].join("\n");

  /* ---------------- 等级 / 权重 ---------------- */
  function levelOf(score) {
    if (score >= 60) return { key: "scam", label: "疑似诈骗", tone: "rose", badge: "rose", ico: "!" };
    if (score >= 30) return { key: "high", label: "高风险", tone: "amber", badge: "amber", ico: "!" };
    if (score >= 1) return { key: "warn", label: "需要留意", tone: "amber", badge: "amber", ico: "?" };
    return { key: "ok", label: "未发现明显风险", tone: "mint", badge: "brand", ico: "✓" };
  }

  function lvMeta(lv) {
    if (lv >= 3) return { text: "高危", color: "var(--rose)", badge: "rose" };
    if (lv === 2) return { text: "警告", color: "var(--amber)", badge: "amber" };
    return { text: "提示", color: "var(--cyan)", badge: "cyan" };
  }

  /* ---------------- 建议动作（按等级） ---------------- */
  var ADVICE = {
    scam: [
      "不要交任何费用，包括押金、培训费、服装费、体检费。",
      "不要发送身份证正反面照片、银行卡号与短信验证码。",
      "立刻停止沟通，不要点对方发的链接、不要下载对方指定的 App。",
      "保留聊天记录、对方名片、收款码截图，作为举报证据。",
      "在国家反诈中心 App、12321 或招聘平台举报该账号。"
    ],
    high: [
      "先去天眼查 / 爱企查核实公司全称、成立时间与经营范围是否与招聘主体一致。",
      "要求对方提供对公账户与书面 offer，拒绝私下转账。",
      "面试地点选公司办公区，别去酒店、民宅或咖啡馆。",
      "把薪资结构、底薪、提成怎么算写清楚再决定。",
      "面试前把公司名、时间地点截图发给同学或家人报备。"
    ],
    warn: [
      "注意薪资和岗位描述之间的落差，超高薪 + 无门槛要格外警惕。",
      "面试前先确认底薪结构：底薪多少、提成怎么算、什么时候结算。",
      "核对岗位内容是不是销售 / 客服类的引流岗，问清楚每天具体做什么。",
      "尽量用招聘平台内沟通，少加私人微信，留住聊天记录。"
    ],
    ok: [
      "暂时没有发现典型套路，但仍建议核实企业主体真实性。",
      "正规面试一般不会收费，遇到任何要钱的说法一律拒绝。",
      "offer 以企业邮箱发送、带公司盖章的为准。",
      "把面试时间地点告诉室友或家人，保持联系。"
    ]
  };
  var ADVICE_TITLE = {
    scam: "疑似诈骗：先停手，不交钱、不发证件",
    high: "高风险：先把公司查清楚，再谈下一步",
    warn: "需要留意：这些点先问清楚再决定",
    ok: "暂未发现明显套路，但也别掉以轻心"
  };
  var ADVICE_SUB = {
    scam: "命中的特征里有收费、贷款或刷单类的高危项，按下面顺序做，别急着回复对方。",
    high: "有几处明显不对劲，先别答应任何条件，把能核实的信息都核实一遍。",
    warn: "没有致命特征，但有几处说法含糊，问清楚再投入时间。",
    ok: "这段话读起来像正常招聘，稳妥起见还是先核实企业主体与面试地点。"
  };

  /* ---------------- 检测引擎 ---------------- */
  function scanText(text) {
    var src = String(text || "");
    var low = src.toLowerCase();
    var hits = [];
    Echo.seed.radarRules.forEach(function (r) {
      var evs = [];
      r.keys.forEach(function (k) {
        var idx = low.indexOf(String(k).toLowerCase());
        if (idx < 0) return;
        var a = Math.max(0, idx - 18);
        var b = Math.min(src.length, idx + k.length + 18);
        var frag = "…" + src.slice(a, b).replace(/\s+/g, " ").trim() + "…";
        var dup = false;
        evs.forEach(function (e) { if (e.frag === frag) dup = true; });
        if (!dup) evs.push({ key: k, frag: frag });
      });
      if (evs.length) hits.push({ id: r.id, lv: r.lv, label: r.label, why: r.why, ev: evs });
    });
    var score = 0;
    hits.forEach(function (h) { score += h.lv === 3 ? 34 : h.lv === 2 ? 18 : 8; });
    score = Math.min(100, score);
    return { hits: hits, score: score };
  }

  function guessTitle(text) {
    var lines = String(text || "").split("\n").filter(function (l) { return l.trim(); });
    var first = lines.length ? lines[0].trim() : "";
    if (first.length > 18) first = first.slice(0, 18) + "…";
    return first || "未命名岗位";
  }

  /* ---------------- 结果区 ---------------- */
  var lastRun = null;

  function hitHTML(h) {
    var m = lvMeta(h.lv);
    var out = '<div class="hit">' +
      '<div class="hit__lv" style="background:' + m.color + '"></div>' +
      '<div style="flex:1">' +
        '<div class="row" style="gap:8px"><span class="hit__t">' + util.esc(h.label) + "</span>" +
        '<span class="badge badge--' + m.badge + '">' + m.text + "</span></div>" +
        '<div class="hit__d">' + util.esc(h.why) + "</div>";
    (h.ev || []).slice(0, 2).forEach(function (e) {
      out += '<div class="field-note">命中原文：' + util.esc(e.frag) + "</div>";
    });
    out += "</div></div>";
    return out;
  }

  function adviceHTML(lv) {
    var out = '<div class="mt-2"><div class="card__title">下一步怎么做</div>';
    out += '<div class="note note--' + lv.tone + ' note--ico mt-1">' +
      '<span class="ico">' + lv.ico + '</span>' +
      "<span><span class=\"note__t\">" + ADVICE_TITLE[lv.key] + "</span>" + ADVICE_SUB[lv.key] + "</span></div>";
    out += '<div class="list mt-1">';
    (ADVICE[lv.key] || []).forEach(function (t, i) {
      out += '<div class="list__item">' +
        '<div class="list__ico" style="background:var(--' + lv.tone + '-soft);color:var(--' + lv.tone + ')">' + (i + 1) + "</div>" +
        '<div class="list__t" style="font-weight:500">' + util.esc(t) + "</div></div>";
    });
    out += "</div></div>";
    return out;
  }

  function renderResult(run) {
    lastRun = run || null;
    var host = document.getElementById("resultBody");
    if (!run) {
      host.innerHTML = ui.empty("◇", "还没检测过",
        "把招聘信息或 HR 的聊天记录粘到上面的框里，点「开始检测」，30 秒看看有没有坑。",
        '<button class="btn btn--primary btn--sm" id="btnEmptyDemo">填入一段典型可疑招聘</button>');
      var eb = document.getElementById("btnEmptyDemo");
      if (eb) eb.onclick = fillExample;
      return;
    }

    var lv = levelOf(run.risk || 0);
    var hits = run.hits || [];
    var high = hits.filter(function (h) { return h.lv === 3; }).length;
    var out = [];

    out.push('<div class="score-hero">');
    out.push('<div><div class="field-note">风险分（越高越像坑）</div>');
    out.push('<div class="score-big" style="color:var(--' + lv.tone + ')">' + (run.risk || 0) +
      '<small style="font-size:15px;color:var(--muted);font-weight:600"> / 100</small></div></div>');
    out.push('<div><span class="badge badge--' + lv.badge + '"><span class="dot"></span>' + lv.label + "</span>");
    out.push('<div class="card__desc mt-1" style="max-width:360px">' +
      util.esc(run.title || "未命名岗位") + "：" + (hits.length
        ? "共命中 " + hits.length + " 条可疑特征" + (high ? "，其中高危 " + high + " 条" : "") + "。"
        : "没有命中常见可疑特征，但仍建议核实企业主体。") + "</div></div>");
    out.push("</div>");

    out.push('<div class="risk-gauge mt-2"><div class="risk-gauge__pin" style="left:' +
      util.clamp(run.risk || 0, 0, 100) + '%"></div></div>');
    out.push('<div class="row row--between field-note"><span>0 基本安全</span><span>30 需要留意</span>' +
      "<span>60 高风险</span><span>100 疑似诈骗</span></div>");

    if (hits.length) {
      out.push('<div class="mt-2"><div class="card__title">命中的可疑特征</div><div class="mt-1">');
      hits.forEach(function (h) { out.push(hitHTML(h)); });
      out.push("</div></div>");
    } else {
      out.push('<div class="mt-2">' + ui.noteBox("mint", "✓", "没有命中常见的可疑特征",
        "这段话里暂时没发现收费、培训贷、包过、刷单或私聊引流等典型特征，可以继续了解，但别急着交任何材料。") + "</div>");
    }

    out.push(adviceHTML(lv));
    host.innerHTML = out.join("");
  }

  /* ---------------- 检测动作 ---------------- */
  function doScan() {
    var ta = document.getElementById("radarText");
    var pos = document.getElementById("radarPos");
    var text = (ta.value || "").trim();
    if (text.length < 6) {
      ui.toast("先粘贴一段招聘信息或聊天记录吧", "amber");
      ta.focus();
      return;
    }
    var res = scanText(text);
    var lv = levelOf(res.score);
    var title = (pos.value || "").trim() || guessTitle(text);
    var saved = store.addRadarRun({
      title: title, risk: res.score, level: lv.key, hits: res.hits, text: text
    });
    renderResult(saved);
    renderHistory();
    ui.toast("检测完成：风险分 " + res.score + " · " + lv.label, lv.tone);
  }

  function fillExample() {
    document.getElementById("radarText").value = EXAMPLE;
    document.getElementById("radarPos").value = "市场运营助理（示例）";
    ui.toast("已填入一段典型可疑招聘，点「开始检测」试试", "amber");
  }

  function clearAll() {
    document.getElementById("radarText").value = "";
    document.getElementById("radarPos").value = "";
    renderResult(null);
    ui.toast("已清空，可以重新粘贴");
  }

  /* ---------------- 复制结论 ---------------- */
  function buildCopy(run) {
    var lv = levelOf(run.risk || 0);
    var lines = [];
    lines.push("【回音 · 防坑雷达】检测结论");
    lines.push("岗位：" + (run.title || "未填写"));
    lines.push("时间：" + (run.at || util.nowStamp()));
    lines.push("风险分：" + (run.risk || 0) + " / 100 —— " + lv.label);
    if (run.hits && run.hits.length) {
      lines.push("命中特征：");
      run.hits.forEach(function (h, i) {
        var m = lvMeta(h.lv);
        var keys = (h.ev || []).map(function (e) { return e.key; });
        lines.push((i + 1) + ". [" + m.text + "] " + h.label +
          (keys.length ? "（命中：" + keys.join("、") + "）" : "") + " —— " + h.why);
      });
    } else {
      lines.push("命中特征：未发现明显可疑特征");
    }
    lines.push("建议：");
    (ADVICE[lv.key] || []).forEach(function (x) { lines.push("- " + x); });
    lines.push("（本页为规则初筛，不构成法律意见，疑问请以官方渠道核实为准）");
    return lines.join("\n");
  }

  function fallbackCopy(text, okMsg) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "readonly");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    ta.remove();
    ui.toast(ok ? okMsg : "复制失败，请手动选中文字复制", ok ? "mint" : "rose");
  }

  function copyText(text, okMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        ui.toast(okMsg, "mint");
      }, function () {
        fallbackCopy(text, okMsg);
      });
    } else {
      fallbackCopy(text, okMsg);
    }
  }

  function copyConclusion() {
    if (!lastRun) {
      ui.toast("先做一次检测，再复制结论", "amber");
      return;
    }
    copyText(buildCopy(lastRun), "结论已复制，可以直接贴给同学或家人");
  }

  /* ---------------- 投递前自查清单 ---------------- */
  var CHECKS = [
    { t: "公司全称能在天眼查 / 爱企查查到，且招聘主体一致", d: "别只看简称，搜全称核对成立时间与经营范围" },
    { t: "面试地点是公司办公区，不是酒店 / 民宅 / 咖啡厅", d: "地址可在公司官网或工商登记里核对" },
    { t: "offer 由企业邮箱发送，带有公司盖章或正式落款", d: "个人邮箱、微信发的口头承诺都不算数" },
    { t: "全程不收取任何费用（押金 / 培训费 / 服装费 / 体检费）", d: "任何名义的收费都可以直接拒绝并举报" },
    { t: "薪资结构写进书面 offer：底薪、提成、结算周期", d: "只写「面议」「月入过万」的要追问清楚" },
    { t: "不提供银行卡照片、身份证正反面原件与人脸验证码", d: "入职材料一般在正式录用后才交" },
    { t: "把面试时间地点告诉同学或家人，保持联系", d: "单独赴约时留个心眼，安全第一" }
  ];

  function loadChecks() {
    var raw = null;
    try { raw = localStorage.getItem(CHECK_KEY); } catch (e) { raw = null; }
    if (!raw) return [];
    try { return JSON.parse(raw) || []; } catch (e) { return []; }
  }
  function saveChecks(arr) {
    try { localStorage.setItem(CHECK_KEY, JSON.stringify(arr)); } catch (e) { /* 忽略 */ }
  }

  function renderChecklist() {
    var done = loadChecks();
    var n = 0;
    for (var i = 0; i < CHECKS.length; i++) { if (done[i]) n++; }

    document.getElementById("checkList").innerHTML = CHECKS.map(function (c, i) {
      return '<div class="task' + (done[i] ? " is-done" : "") + '">' +
        '<div class="task__box" data-box="' + i + '">✓</div>' +
        '<div><div class="task__t">' + util.esc(c.t) + "</div>" +
        '<div class="task__d">' + util.esc(c.d) + "</div></div>" +
      "</div>";
    }).join("");

    document.getElementById("checkRing").innerHTML = ui.ring(util.pct(n, CHECKS.length), "自查", "sm");
    document.getElementById("checkNote").innerHTML = n === CHECKS.length
      ? "✓ 全部确认完毕，可以放心投了"
      : "已完成 " + n + " / " + CHECKS.length + " 条，还有 " + (CHECKS.length - n) + " 条待确认";

    document.getElementById("checkList").querySelectorAll("[data-box]").forEach(function (el) {
      el.onclick = function () {
        var idx = +el.getAttribute("data-box");
        var arr = loadChecks();
        while (arr.length < CHECKS.length) arr.push(false);
        arr[idx] = !arr[idx];
        saveChecks(arr.slice(0, CHECKS.length));
        renderChecklist();
      };
    });
  }

  /* ---------------- 检测历史 ---------------- */
  function renderHistory() {
    var host = document.getElementById("radarHistory");
    var runs = store.radarRuns();
    if (!runs.length) {
      host.innerHTML = ui.empty("◷", "还没有检测记录",
        "检测过的招聘会留在这里，方便你回头对比、复盘。");
      return;
    }
    host.innerHTML = '<div class="list">' + runs.map(function (r) {
      var lv = levelOf(r.risk || 0);
      return '<div class="list__item" data-run="' + util.esc(r.id) + '" style="cursor:pointer">' +
        '<div class="list__ico" style="background:var(--' + lv.tone + '-soft);color:var(--' + lv.tone +
          ');font-size:12.5px">' + (r.risk || 0) + "</div>" +
        '<div><div class="list__t">' + util.esc(r.title || "未命名岗位") + "</div>" +
        '<div class="list__d">' + util.esc(lv.label) + " · 命中 " + ((r.hits || []).length) + " 条</div></div>" +
        '<div class="list__time">' + util.esc(r.at || "") + "</div>" +
      "</div>";
    }).join("") + "</div>";

    host.querySelectorAll("[data-run]").forEach(function (el) {
      el.onclick = function () {
        var id = el.getAttribute("data-run");
        var found = null;
        store.radarRuns().forEach(function (r) { if (r.id === id) found = r; });
        if (!found) return;
        document.getElementById("radarText").value = found.text || "";
        document.getElementById("radarPos").value = found.title || "";
        renderResult(found);
        ui.toast("已回填这次检测的原文", "mint");
        window.scrollTo({ top: 0, behavior: "smooth" });
      };
    });
  }

  /* ---------------- 危险话术词典 ---------------- */
  var PHRASE_TAGS = ["全部", "高危", "留心", "提示", "正常"];
  var phraseFilter = "全部";

  function tagTone(tag) {
    if (tag === "高危") return "rose";
    if (tag === "留心") return "amber";
    if (tag === "提示") return "cyan";
    return "mint";
  }

  function renderPhraseChips() {
    var all = Echo.seed.phrases;
    document.getElementById("phraseChips").innerHTML = PHRASE_TAGS.map(function (t) {
      var n = t === "全部" ? all.length : all.filter(function (p) { return p.tag === t; }).length;
      return '<button type="button" class="chip' + (t === phraseFilter ? " is-on" : "") + '" data-tag="' + t + '">' +
        t + ' <b style="opacity:.6;font-weight:700">' + n + "</b></button>";
    }).join("");
    document.getElementById("phraseChips").querySelectorAll("[data-tag]").forEach(function (el) {
      el.onclick = function () {
        phraseFilter = el.getAttribute("data-tag");
        renderPhraseChips();
        renderPhrases();
      };
    });
  }

  function renderPhrases() {
    var list = Echo.seed.phrases.filter(function (p) {
      return phraseFilter === "全部" || p.tag === phraseFilter;
    });
    var host = document.getElementById("phraseList");
    if (!list.length) {
      host.innerHTML = ui.empty("○", "这一档暂时没有条目", "换个分类看看，或者选「全部」。");
      return;
    }
    host.innerHTML = list.map(function (p) {
      var tone = tagTone(p.tag);
      return '<div class="hit" style="align-items:center">' +
        '<div class="hit__lv" style="background:var(--' + tone + ')"></div>' +
        '<div style="flex:1"><div class="row" style="gap:8px">' +
          '<span class="hit__t">' + util.esc(p.text) + "</span>" +
          '<span class="badge badge--' + tone + '">' + util.esc(p.tag) + "</span></div>" +
        '<div class="hit__d">' + util.esc(p.note) + "</div></div>" +
      "</div>";
    }).join("");
  }

  /* ---------------- 初始化 ---------------- */
  ui.mountNav("radar", { back: "tracker.html", title: "防坑雷达" });
  renderResult(null);
  renderChecklist();
  renderHistory();
  renderPhraseChips();
  renderPhrases();

  document.getElementById("btnScan").onclick = doScan;
  document.getElementById("btnDemo").onclick = fillExample;
  document.getElementById("btnClear").onclick = clearAll;
  document.getElementById("btnCopy").onclick = copyConclusion;
})();

