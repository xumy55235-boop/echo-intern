/* ==========================================================================
   index.js —— 今日：问候 / 本周目标 / 今天三件 / 待跟进 / 漏斗 / 同伴 / 防坑 / 情绪
   ========================================================================== */
(function () {
  "use strict";
  var util = Echo.util, ui = Echo.ui, store = Echo.store;

  /* ---------------- 日期与连续天数 ---------------- */
  function dateLabel() {
    var d = new Date();
    return (d.getMonth() + 1) + " 月 " + d.getDate() + " 日 · " + ui.weekName();
  }

  function streakDays() {
    var active = {};
    store.applications().forEach(function (a) {
      if (a.appliedAt) active[a.appliedAt] = 1;
      (a.history || []).forEach(function (h) { if (h.at) active[String(h.at).slice(0, 10)] = 1; });
    });
    store.moods().forEach(function (m) { if (m.date) active[m.date] = 1; });
    store.sprint().items.forEach(function (t) { if (t.doneAt) active[t.doneAt] = 1; });
    var d = util.today(), n = 0;
    if (!active[d]) d = util.addDays(d, -1);   // 今天还没动，但从昨天起连续也算
    while (active[d]) { n++; d = util.addDays(d, -1); }
    return n;
  }

  function renderHead() {
    var p = store.profile(), s = store.stats();
    var streak = streakDays();
    document.getElementById("greetDate").textContent = dateLabel();
    document.getElementById("greetTitle").innerHTML =
      ui.greeting() + "，" + util.esc(p.name || "同学");
    document.getElementById("streakBadge").textContent =
      streak > 0 ? "连续 " + streak + " 天有动作" : "今天开始也行";
    var pend = store.reminders().length;
    document.getElementById("greetSub").innerHTML =
      "本周已投 <b>" + s.thisWeek + "</b> 份，目标 " + s.weekGoal + " 份" +
      (pend ? " · 有 <b>" + pend + "</b> 份该跟进了" : " · 暂无需要跟进的投递") +
      (s.total ? "。" : "。先记下你的第一份投递，后面都会自动长出来。");
  }

  /* ---------------- 本周目标卡 ---------------- */
  function renderToday() {
    var s = store.stats();
    var host = document.getElementById("todayCard");
    var left = Math.max(0, s.weekGoal - s.thisWeek);
    var title, desc, cta;

    if (!s.total) {
      title = "先记下第一份投递";
      desc = "记录之后，漏斗、跟进提醒、同伴参照都会自动开始工作。";
      cta = '<a class="btn btn--primary" href="tracker.html">记录第一份投递</a>';
    } else if (left > 0) {
      title = "再投 " + left + " 份就达标";
      desc = "目标 " + s.weekGoal + " 份 · 已投 " + s.thisWeek + " 份 · 还剩 " +
        (7 - ((new Date().getDay() + 6) % 7)) + " 天";
      cta = '<a class="btn btn--primary" href="tracker.html">记录一次投递</a>' +
        '<a class="btn" href="sprint.html">今天做什么</a>';
    } else {
      title = "本周目标已达成";
      desc = "已投 " + s.thisWeek + " 份。接下来把精力放在跟进和面试准备上。";
      cta = '<a class="btn btn--primary" href="tracker.html">去看待跟进</a>' +
        '<a class="btn" href="diagnose.html">打磨简历</a>';
    }

    host.innerHTML =
      '<div class="today__in">' +
        '<div class="today__main">' +
          '<div class="today__eyebrow">本周投递目标</div>' +
          '<div class="today__title">' + util.esc(title) + "</div>" +
          '<div class="today__desc">' + util.esc(desc) + "</div>" +
        "</div>" +
        '<div class="today__ring">' + ui.ring(s.weekProgress, "本周") + "</div>" +
      "</div>" +
      '<div class="today__acts">' + cta + "</div>" +
      '<div class="today__foot">' +
        (s.total
          ? "回音率 " + s.replyRate + "%" +
            (s.avgReply != null ? " · 首次回音平均 " + s.avgReply + " 天" : "") +
            " · 拿到 Offer " + s.offer + " 个"
          : "同校样本里，41% 的人第一份投递至今没有回音 —— 没有回音是常态。") +
      "</div>";
  }

  /* ---------------- 指标条 ---------------- */
  function renderStats() {
    var s = store.stats();
    var cells = [
      { label: "累计投递", value: s.total, unit: "份", cls: "" },
      { label: "回音率", value: s.replyRate, unit: "%", cls: "is-accent" },
      { label: "推进中", value: s.progressing, unit: "个", cls: "" },
      { label: "本周", value: s.thisWeek + "/" + s.weekGoal, unit: "", cls: "is-gold" }
    ];
    document.getElementById("stats").innerHTML = cells.map(function (c) {
      return '<div class="statstrip__cell ' + c.cls + '">' +
        '<div class="statstrip__label">' + c.label + "</div>" +
        '<div class="statstrip__value">' + c.value +
        (c.unit ? "<small>" + c.unit + "</small>" : "") + "</div>" +
      "</div>";
    }).join("");
  }

  /* ---------------- 今天三件 ---------------- */
  function renderTodayTasks() {
    var items = store.sprint().items.filter(function (t) { return !t.done; }).slice(0, 3);
    var host = document.getElementById("todayTasks");
    if (!items.length) {
      var all = store.sprint().items.length;
      host.innerHTML = ui.empty("✓", all ? "今天的动作都做完了" : "还没有本周清单",
        all ? "剩下的时间留给自己，明天继续。" : "去陪跑页生成一份本周清单，从这里开始拆解。",
        '<a class="btn btn--primary btn--sm" href="sprint.html">' + (all ? "看看完整清单" : "生成本周清单") + "</a>");
      return;
    }
    host.innerHTML = items.map(function (t) {
      return '<div class="task" data-task="' + t.id + '">' +
        '<button class="task__box" data-tick="' + t.id + '" aria-label="标记完成">✓</button>' +
        '<div style="flex:1;min-width:0">' +
          '<div class="task__t">' + util.esc(t.text) + "</div>" +
          (t.d ? '<div class="task__d">' + util.esc(t.d) + "</div>" : "") +
        "</div>" +
        '<div class="task__side"><span class="badge badge--line">' + util.esc(t.tag || "自定义") + "</span></div>" +
      "</div>";
    }).join("");
    host.querySelectorAll("[data-tick]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        store.toggleSprintItem(btn.getAttribute("data-tick"));
        ui.toast("已完成一项，今天又往前走了一点", "mint");
        renderTodayTasks();
        renderHead();
      });
    });
  }

  /* ---------------- 待跟进 ---------------- */
  function renderReminders() {
    var list = store.reminders();
    var host = document.getElementById("reminders");
    var badge = document.getElementById("reminderCount");
    if (list.length) {
      badge.style.display = "";
      badge.textContent = list.length + " 份";
    } else {
      badge.style.display = "none";
    }
    if (!list.length) {
      host.innerHTML = ui.empty("◎", "所有投递都在节奏里", "没有超期未更新的记录。保持每 3-5 天看一次状态就好。");
      return;
    }
    host.innerHTML = list.slice(0, 3).map(function (r) {
      return '<div class="list__item">' +
        '<span class="list__ico">' + (r.level === "high" ? "!" : "·") + "</span>" +
        '<div style="flex:1;min-width:0">' +
          '<div class="list__t">' + util.esc(r.company) + " · " + util.esc(r.position) + "</div>" +
          '<div class="list__d">' + util.esc(r.text) + "</div>" +
        "</div>" +
        '<div class="rem-side">' +
          '<span class="list__time">' + r.idle + " 天</span>" +
          '<button class="mini-btn" data-follow="' + r.appId + '">催过了</button>' +
        "</div>" +
      "</div>";
    }).join("") +
      (list.length > 3 ? '<div class="field-note">还有 ' + (list.length - 3) + " 份待跟进，去台账里一起处理。</div>" : "");

    host.querySelectorAll("[data-follow]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        store.updateApp(btn.getAttribute("data-follow"), {});
        ui.toast("已记下这次跟进，周期重新计算", "mint");
        renderReminders();
        renderHead();
      });
    });
  }

  /* ---------------- 漏斗 ---------------- */
  function renderFunnel() {
    var s = store.stats(), b = s.byStatus;
    var rows = [
      { name: "已投递", n: s.total },
      { name: "有回音", n: s.replied },
      { name: "进笔试", n: b.exam + b.interview + b.final + b.offer },
      { name: "进面试", n: b.interview + b.final + b.offer },
      { name: "Offer", n: s.offer }
    ];
    var max = Math.max(1, s.total);
    document.getElementById("funnel").innerHTML = rows.map(function (r) {
      return '<div class="funnel__row">' +
        '<div class="funnel__name">' + r.name + "</div>" +
        '<div class="funnel__bar"><div class="funnel__fill" style="width:' +
          (s.total ? Math.round(r.n / max * 100) : 0) + '%"></div></div>' +
        '<div class="funnel__n">' + r.n + "</div>" +
      "</div>";
    }).join("");
    document.getElementById("funnelNote").textContent = s.total
      ? "回音率 " + s.replyRate + "% · 面试转化 " + s.interviewRate + "% · 已结束 " + s.dead + " 份"
      : "记录 2-3 份投递后，这里会显示每一步的流失情况。";
  }

  /* ---------------- 同伴参照 ---------------- */
  function renderPeer() {
    var p = Echo.seed.peers(), total = store.stats().total;
    var buckets = [0, 2, 5, 9, 15, 99];
    var idx = 0;
    for (var i = 0; i < buckets.length; i++) { if (total <= buckets[i]) { idx = i; break; } idx = i; }
    var below = 0;
    for (var j = 0; j < idx; j++) below += p.dist[j];
    var pct = Math.round((below + p.dist[idx] / 2) / p.sample * 100);

    document.getElementById("peerSummary").innerHTML =
      '<div class="note note--ico"><span class="ico">◎</span><span>' +
        "同校同年级 " + p.sample + " 人里，你大概排在前 <b>" + (100 - pct) + "%</b>。" +
        "其中约 41% 的人，至少有一份投递至今没有回音 —— 没回音是常态。" +
      "</span></div>";
    document.getElementById("peerBars").innerHTML = ui.bars(p.buckets.map(function (b, k) {
      return { label: b.replace(" 份", ""), value: p.dist[k], display: p.dist[k], me: k === idx };
    }), { soft: true });
  }

  /* ---------------- 防坑话术 ---------------- */
  function renderPhrases() {
    var picked = Echo.seed.phrases.filter(function (x) { return x.tag !== "正常"; }).slice(0, 2);
    document.getElementById("phraseList").innerHTML = picked.map(function (x) {
      var tone = x.tag === "高危" ? "rose" : x.tag === "留心" ? "amber" : "line";
      return '<div class="list__item">' +
        '<span class="list__ico">' + (tone === "rose" ? "!" : "?") + "</span>" +
        '<div style="flex:1;min-width:0">' +
          '<div class="list__t">' + util.esc(x.text) + "</div>" +
          '<div class="list__d">' + util.esc(x.note) + "</div>" +
        "</div>" +
        '<span class="badge badge--' + tone + '" style="flex:none">' + x.tag + "</span>" +
      "</div>";
    }).join("");
  }

  /* ---------------- 面试日历 ---------------- */
  function parseAt(s) {
    var d = new Date(String(s || "").replace(" ", "T"));
    return isNaN(d.getTime()) ? null : d;
  }

  function renderCalendar() {
    var now = new Date();
    var soon = [];
    store.applications().forEach(function (a) {
      if (!a.interviewAt) return;
      var d = parseAt(a.interviewAt);
      if (!d) return;
      if (d.getTime() < now.getTime() - 3600000) return;  // 已经过去的
      soon.push({ d: d, a: a });
    });
    soon.sort(function (x, y) { return x.d - y.d; });
    soon = soon.slice(0, 3);

    var card = document.getElementById("calendarCard");
    if (!soon.length) { card.style.display = "none"; return; }
    card.style.display = "";
    document.getElementById("calCount").style.display = "";
    document.getElementById("calCount").textContent = soon.length + " 场";

    document.getElementById("calendarList").innerHTML = '<div class="list">' + soon.map(function (x) {
      var d = x.d, a = x.a;
      var diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) -
        new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
      var when = diff === 0 ? "今天" : diff === 1 ? "明天" : diff + " 天后";
      var hh = ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
      return '<div class="list__item">' +
        '<div class="list__ico" style="background:var(--violet-soft);color:var(--violet);flex-direction:column;line-height:1.1;font-weight:800;font-size:10px">' +
          (d.getMonth() + 1) + "/" + d.getDate() + "</div>" +
        '<div style="flex:1;min-width:0">' +
          '<div class="list__t">' + util.esc(a.company) + " · " + util.esc(a.position) + "</div>" +
          '<div class="list__d">' + util.esc(a.city || "城市待确认") + " · " + hh + " · " + when + "</div>" +
        "</div>" +
        '<a class="mini-btn" href="tracker.html" style="flex:none;text-decoration:none">详情</a>' +
      "</div>";
    }).join("") + "</div>";
  }

  /* ---------------- 情绪打卡 ---------------- */
  function renderMoods() {
    var host = document.getElementById("moods");
    var today = store.moods().filter(function (m) { return m.date === util.today(); });
    host.innerHTML = Echo.seed.moodTags.map(function (m) {
      var on = today.length && today[today.length - 1].level === m.level;
      return '<button class="mood" data-mood="' + m.level + '" title="' + util.esc(m.d) + '"' +
        (on ? ' style="border-color:var(--accent);background:var(--accent-soft)"' : "") + ">" +
        '<div class="mood__e">' + m.emoji + "</div>" +
        '<div class="mood__t">' + m.t + "</div>" +
        '<div class="mood__d">' + m.d + "</div>" +
      "</button>";
    }).join("");
    document.getElementById("moodHint").textContent = today.length
      ? "今天已打卡：" + (function () {
          var t = Echo.seed.moodTags.filter(function (x) { return x.level === today[today.length - 1].level; })[0].t;
          return t + (/[。！？!?]$/.test(t) ? "" : "。");
        })() + "明天再来记一次，情绪曲线会连起来。"
      : "今天还没打卡，点一个最接近此刻的感受。";
    host.querySelectorAll("[data-mood]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var lv = Number(btn.getAttribute("data-mood"));
        var tag = (Echo.seed.moodTags.filter(function (x) { return x.level === lv; })[0] || {}).t || "";
        store.addMood(lv, tag, "");
        renderMoods();
        renderHead();
        ui.toast("已记录今天的感受", "mint");
      });
    });
  }

  /* ---------------- 首次使用 ---------------- */
  function renderFirstRun() {
    var host = document.getElementById("firstRun");
    if (store.hasData()) { host.innerHTML = ""; return; }
    host.innerHTML =
      '<div class="note note--amber note--ico mt-2">' +
        '<span class="ico">↗</span>' +
        '<span style="flex:1;min-width:0">' +
          '<span class="note__t">还没有你的数据</span>' +
          "可以先载入一套演示数据，把 7 个页面全部点亮；也可以从记录第一份投递开始。" +
          '<span class="row mt-2">' +
            '<button class="btn btn--primary btn--sm" id="btnDemo">载入演示数据</button>' +
            '<a class="btn btn--sm" href="tracker.html">从零开始</a>' +
          "</span>" +
        "</span>" +
      "</div>";
    document.getElementById("btnDemo").onclick = function () {
      Echo.seed.fillDemo(true);
      ui.toast("演示数据已载入", "mint");
      location.reload();
    };
  }

  renderFirstRun();
  renderHead();
  renderToday();
  renderStats();
  renderTodayTasks();
  renderReminders();
  renderCalendar();
  renderFunnel();
  renderPeer();
  renderPhrases();
  renderMoods();
  ui.mountNav("index");
})();
