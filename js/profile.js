/* ==========================================================================
   profile.js —— 我的陪跑档案：画像设定 + 目标进度 + 成长记录 + 数据管理
   所有读写都走 Echo.store，不在全局新建变量
   ========================================================================== */
(function () {
  "use strict";
  var util = Echo.util, ui = Echo.ui, store = Echo.store;

  var MOOD_EMOJI = ["", "😣", "😕", "😐", "🙂", "😄"];

  function val(id) {
    return (document.getElementById(id).value || "").replace(/^\s+|\s+$/g, "");
  }

  /* ---------------- 画像表单 ---------------- */
  function renderProfileCard() {
    var p = store.profile();
    document.getElementById("pfName").textContent = p.name || "我的";
    document.getElementById("pfGrade").textContent = p.grade || "大二";
    document.getElementById("pfAva").textContent = (p.name || "回").slice(0, 1);
    document.getElementById("pfCardName").textContent = p.name || "同学";
    document.getElementById("pfCardSub").textContent =
      (p.school || "普通院校") + " · " + (p.major || "未填写专业");
    document.getElementById("pfRole").textContent = p.targetRole || "互联网实习";
    document.getElementById("pfCity").textContent = p.targetCity ? p.targetCity : "城市不限";
    document.getElementById("pfSub").textContent =
      (p.weeklyGoal || 5) + " 份 / 周的目标已设定。进度、提醒和诊断口径都会跟着你走。";
  }

  function renderForm() {
    var p = store.profile();
    document.getElementById("fName").value = p.name || "";
    document.getElementById("fSchool").value = p.school || "";
    document.getElementById("fMajor").value = p.major || "";
    document.getElementById("fRole").value = p.targetRole || "";
    document.getElementById("fCity").value = p.targetCity || "";
    document.getElementById("fGoal").value = p.weeklyGoal || 5;
    document.getElementById("fGrade").value = p.grade || "大二";
  }

  function saveForm() {
    var goal = parseInt(val("fGoal"), 10);
    if (isNaN(goal)) goal = 5;
    goal = util.clamp(goal, 1, 30);
    store.setProfile({
      name: val("fName") || "同学",
      school: val("fSchool") || "普通院校",
      major: val("fMajor") || "未填写",
      grade: document.getElementById("fGrade").value,
      targetRole: val("fRole") || "互联网实习（产品 / 运营 / 数据）",
      targetCity: val("fCity"),
      weeklyGoal: goal
    });
    ui.toast("画像已保存，进度与提醒都会按它来算", "mint");
    renderForm();
    renderProfileCard();
    renderGoal();
  }

  /* ---------------- 本周目标进度 ---------------- */
  function goalFeedback(s) {
    if (!s.weekGoal) return "先去上面设一个每周投递目标，比如 5 份 —— 有目标，进度才有意义。";
    if (s.thisWeek === 0) return "这周还没投出第一份。别想着一口气投十份，挑 1 个最匹配的岗位投掉，今天就算开门红。";
    if (s.thisWeek < s.weekGoal) return "还差 " + (s.weekGoal - s.thisWeek) + " 份就达到目标 —— 今天再投 1 份，进度条就会明显往前走一格。";
    if (s.thisWeek === s.weekGoal) return "本周目标刚好完成。别再硬凑数量了，把剩下的时间花在跟进已有投递上更划算。";
    return "已经超过目标 " + (s.thisWeek - s.weekGoal) + " 份，节奏很稳。记得留出时间跟进 —— 投出去只是开始。";
  }

  function renderGoal() {
    var s = store.stats();
    var host = document.getElementById("goalBox");
    host.innerHTML =
      '<div class="row mt-1">' +
        ui.ring(s.weekProgress, "本周投递") +
        '<div style="flex:1;min-width:190px">' +
          '<div class="card__title">本周已投 ' + s.thisWeek + " 份 / 目标 " + s.weekGoal + " 份</div>" +
          '<div class="card__desc mt-1">' + util.esc(goalFeedback(s)) + "</div>" +
          '<div class="mt-1">' + ui.meter(s.weekProgress, s.weekProgress >= 100 ? "mint" : "") + "</div>" +
          '<div class="field-note">累计投递 ' + s.total + " 份 · 有回音 " + s.replied + " 份 · 回音率 " + s.replyRate + "%</div>" +
        "</div>" +
      "</div>";
  }

  /* ---------------- 成长记录：情绪曲线 ---------------- */
  function renderGrowMood() {
    var trend = store.moodTrend(7);
    var data = trend.map(function (d) {
      return {
        label: d.date.slice(5),
        value: d.level ? d.level * 20 : 4,
        display: d.level ? MOOD_EMOJI[d.level] : "·"
      };
    });
    document.getElementById("growMood").innerHTML = ui.bars(data, { soft: true }) +
      '<div class="field-note">没有打卡的那天空着就好 —— 记录是为了看清自己，不是为了交作业。</div>';
  }

  /* ---------------- 成长记录：投递分布 ---------------- */
  function renderGrowFunnel() {
    var host = document.getElementById("growFunnel");
    var s = store.stats();
    if (!s.total) {
      host.innerHTML = ui.empty("○", "还没有投递记录",
        "去台账记录第一份投递，这里就会长出你自己的分布图。",
        '<a class="btn btn--primary btn--sm" href="tracker.html">去记录</a>');
      return;
    }
    var max = Math.max(1, s.total);
    var rows = Echo.STATUS.map(function (st) {
      var n = s.byStatus[st.key] || 0;
      return '<div class="funnel__row">' +
        '<div class="funnel__name">' + util.esc(st.label) + "</div>" +
        '<div class="funnel__bar"><div class="funnel__fill" style="width:' + util.pct(n, max) + '%"></div></div>' +
        '<div class="funnel__n">' + n + "</div>" +
      "</div>";
    }).join("");
    host.innerHTML = '<div class="funnel">' + rows + "</div>" +
      '<div class="field-note">停在「已投递 / 已查看」是首投族最常见的位置，不代表你不行，只说明还需要提高简历与 JD 的对齐度。</div>';
  }

  /* ---------------- 成长记录：诊断历史 ---------------- */
  function diagRole(r) {
    return r.role || r.targetRole || r.target || r.position || "未填写目标岗位";
  }

  function diagScore(r) {
    if (typeof r.score === "number") return r.score;
    if (typeof r.match === "number") return r.match;
    if (typeof r.matchScore === "number") return r.matchScore;
    return null;
  }

  function renderGrowDiag() {
    var host = document.getElementById("growDiag");
    var runs = store.diagnoseRuns().slice(0, 5);
    if (!runs.length) {
      host.innerHTML = ui.empty("◈", "还没有诊断记录",
        "做一次简历对标诊断，结果会留在这里，方便你回头看变化。",
        '<a class="btn btn--primary btn--sm" href="diagnose.html">去诊断</a>');
      return;
    }
    host.innerHTML = '<div class="list">' + runs.map(function (r) {
      var sc = diagScore(r);
      return '<div class="list__item">' +
        '<div class="list__ico" style="background:var(--accent-soft);color:var(--accent)">◈</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div class="list__t">' + util.esc(diagRole(r)) + "</div>" +
          '<div class="list__d">' + (sc != null ? "匹配分 " + sc + " 分" : "本次未记录匹配分") + "</div>" +
        "</div>" +
        '<div class="list__time">' + util.esc(r.at || "") + "</div>" +
      "</div>";
    }).join("") + "</div>";
  }

  /* ---------------- 成长记录：防坑检测历史 ---------------- */
  function radarTitle(r) {
    if (r.title) return r.title;
    if (r.company) return r.company;
    if (r.text) return String(r.text).slice(0, 20) + "…";
    return "一段被检查过的招聘信息";
  }

  function radarScore(r) {
    if (typeof r.score === "number") return r.score;
    if (typeof r.risk === "number") return r.risk;
    if (typeof r.riskScore === "number") return r.riskScore;
    return null;
  }

  // 与防坑雷达页的等级口径保持一致：scam / high / warn / ok
  var RADAR_LEVELS = {
    scam: { label: "疑似诈骗", tone: "rose" },
    high: { label: "高风险", tone: "amber" },
    warn: { label: "需要留意", tone: "amber" },
    ok: { label: "未发现明显风险", tone: "mint" }
  };

  function radarLevel(r) {
    if (r.level && RADAR_LEVELS[r.level]) return RADAR_LEVELS[r.level];
    var sc = radarScore(r);
    if (typeof sc !== "number") return null;
    if (sc >= 60) return RADAR_LEVELS.scam;
    if (sc >= 30) return RADAR_LEVELS.high;
    if (sc >= 1) return RADAR_LEVELS.warn;
    return RADAR_LEVELS.ok;
  }

  function renderGrowRadar() {
    var host = document.getElementById("growRadar");
    var runs = store.radarRuns().slice(0, 5);
    if (!runs.length) {
      host.innerHTML = ui.empty("◇", "还没有检测记录",
        "把可疑的招聘信息粘进防坑雷达查一次，结果会记在这里。",
        '<a class="btn btn--primary btn--sm" href="radar.html">去检测</a>');
      return;
    }
    host.innerHTML = '<div class="list">' + runs.map(function (r) {
      var sc = radarScore(r);
      var lv = radarLevel(r);
      return '<div class="list__item">' +
        '<div class="list__ico" style="background:var(--warn-soft);color:var(--warn)">◇</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div class="list__t">' + util.esc(radarTitle(r)) + "</div>" +
          '<div class="list__d">' + (sc != null ? "风险分 " + sc + " 分" : "已完成风险检查") +
            (r.hits && r.hits.length ? " · 命中 " + r.hits.length + " 条规则" : "") + "</div>" +
        "</div>" +
        (lv ? '<span class="badge badge--' + lv.tone + '">' + lv.label + "</span>" : "") +
        '<div class="list__time">' + util.esc(r.at || "") + "</div>" +
      "</div>";
    }).join("") + "</div>";
  }

  /* ---------------- 数据管理 ---------------- */
  function refreshExportBox() {
    document.getElementById("exportBox").value = store.exportJSON();
  }

  function exportData() {
    var json = store.exportJSON();
    try {
      var blob = new Blob([json], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "huiyin-backup.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      ui.toast("备份已下载：huiyin-backup.json", "mint");
    } catch (e) {
      ui.toast("下载被浏览器拦住了，请手动复制上面的 JSON", "amber");
    }
  }

  function importData() {
    var text = document.getElementById("importBox").value;
    if (!text || !text.replace(/^\s+|\s+$/g, "")) {
      ui.toast("先把要导入的 JSON 粘贴进来", "amber");
      return;
    }
    try {
      store.importJSON(text);
      ui.toast("导入成功，正在刷新页面", "mint");
      setTimeout(function () { location.reload(); }, 600);
    } catch (e) {
      ui.toast("导入失败：JSON 格式不对，请检查后再试", "rose");
    }
  }

  function loadDemo() {
    Echo.seed.fillDemo(true);
    ui.toast("已载入演示数据，正在刷新页面", "mint");
    setTimeout(function () { location.reload(); }, 600);
  }

  function resetData() {
    ui.confirm("清空全部本机数据？",
      "这会删掉投递记录、诊断历史、防坑检测记录、陪跑清单与全部情绪打卡，且无法恢复。确定要清空吗？",
      "确认清空", "rose").then(function (ok) {
        if (!ok) return;
        store.resetAll();
        ui.toast("已清空，回到一个干净的起点", "amber");
        setTimeout(function () { location.reload(); }, 600);
      });
  }

  /* ---------------- 主题切换 ---------------- */
  function renderThemeTabs() {
    var cur = ui.currentTheme();
    document.querySelectorAll("#themeTabs [data-theme-val]").forEach(function (b) {
      b.classList.toggle("is-on", b.getAttribute("data-theme-val") === cur);
      b.onclick = function () {
        ui.applyTheme(b.getAttribute("data-theme-val"));
        renderThemeTabs();
        ui.toast(b.getAttribute("data-theme-val") === "dark" ? "已切换到夜航主题" : "已切换到晨雾主题", "mint");
      };
    });
  }

  /* ---------------- 初始化 ---------------- */
  ui.mountNav("profile");
  renderProfileCard();
  renderForm();
  renderGoal();
  renderGrowMood();
  renderGrowFunnel();
  renderGrowDiag();
  renderGrowRadar();
  refreshExportBox();
  renderThemeTabs();

  document.getElementById("btnSave").onclick = saveForm;
  document.getElementById("btnExport").onclick = exportData;
  document.getElementById("btnImport").onclick = importData;
  document.getElementById("btnDemo").onclick = loadDemo;
  document.getElementById("btnReset").onclick = resetData;
})();
