/* ==========================================================================
   sprint.js —— 每周陪跑清单：把「找到实习」拆成本周能完成的几件小动作
   清单读写全部走 Echo.store；本页不做全局变量，只挂 Echo.*
   ========================================================================== */
(function () {
  "use strict";
  var util = Echo.util, ui = Echo.ui, store = Echo.store;

  var TAGS = ["全部", "简历", "投递", "跟进", "补缺", "复盘", "情绪", "自定义"];
  var TAG_TONE = {
    "简历": "brand", "投递": "cyan", "跟进": "amber",
    "补缺": "violet", "复盘": "mint", "情绪": "rose", "自定义": "line"
  };
  var WEEK_NAME = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  var MOOD_EMOJI = ["", "😣", "😕", "😐", "🙂", "😄"];

  var curTag = "全部";

  /* ---------------- 动作优先顺序：跟进 → 投递 → 补缺 ---------------- */
  function kindRank(kind) {
    if (kind === "follow") return 0;
    if (kind === "apply") return 1;
    if (kind === "gap") return 2;
    return 3;
  }

  function tagBadge(tag) {
    return '<span class="badge badge--' + (TAG_TONE[tag] || "line") + '">' + util.esc(tag) + "</span>";
  }

  /* ---------------- 生成本周清单 ---------------- */
  function generate() {
    // 缺口取最近一次简历诊断留下的 gaps；没有诊断记录就传空数组，清单照样能生成
    var runs = store.diagnoseRuns();
    var gaps = (runs[0] && runs[0].gaps) ? runs[0].gaps : [];
    var rems = store.reminders();
    // 这里要说明一点：store.load() 返回的是内存里的同一个对象引用，
    // 所以直接改 sp.items 再 store.save() 就等于持久化了，不需要重新赋值回去。
    var sp = store.sprint();
    sp.items = Echo.seed.buildSprint(gaps, rems);
    store.save();
    ui.toast("本周清单已生成：" + sp.items.length + " 件可控的小事", "mint");
    renderAll();
  }

  /* ---------------- 顶部：完成度 + 鼓励 ---------------- */
  function encourage(rate) {
    if (rate >= 100) return "本周清单全部完成 —— 你已经做完了所有能控制的部分，剩下的交给时间。";
    if (rate >= 70) return "就差最后几件了。挑一件 20 分钟能收尾的，今天顺手清掉，别留到周日晚上。";
    if (rate >= 40) return "过半就在眼前，今天再勾掉一件，进度条会明显往前走一格。";
    if (rate > 0) return "已经开好头了，不算晚。今天只盯最容易的那一件，做完收工。";
    return "从最容易的那一件开始 —— 做完第一个勾，状态自己就起来了。";
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
    if (!active[d]) d = util.addDays(d, -1);
    while (active[d]) { n++; d = util.addDays(d, -1); }
    return n;
  }

  function renderTop() {
    var host = document.getElementById("sprintTop");
    var items = store.sprint().items;
    var streak = streakDays();
    document.getElementById("streak").textContent = streak > 0 ? "连续 " + streak + " 天" : "今天开始也算";

    if (!items.length) {
      host.innerHTML = ui.empty("✓", "本周清单还没生成",
        "根据你的诊断缺口和待跟进投递，自动排成 6-8 件今天能动手的小事。",
        '<button class="btn btn--primary" id="btnGen">生成本周清单</button>');
      document.getElementById("btnGen").onclick = generate;
      return;
    }
    var done = items.filter(function (t) { return t.done; }).length;
    var rate = util.pct(done, items.length);
    host.innerHTML =
      '<div class="today__in">' +
        '<div class="today__main">' +
          '<div class="today__eyebrow">本周完成度</div>' +
          '<div class="today__title">已完成 ' + done + " / " + items.length + " 项</div>" +
          '<div class="today__desc">' + util.esc(encourage(rate)) + "</div>" +
          '<div class="today__acts">' +
            '<a class="btn btn--primary btn--sm" href="#today3">看今天做什么</a>' +
            '<a class="btn btn--sm" href="diagnose.html">补简历缺口</a>' +
          "</div>" +
        "</div>" +
        '<div class="today__ring">' + ui.ring(rate, "本周") + "</div>" +
      "</div>" +
      '<div class="today__foot">' + (streak > 0 ? "已经连续 " + streak + " 天有动作" : "今天动一下，连续天数就开始计了") +
        " · 完成率不等于能力，只代表这周你对自己有交代。" + "</div>";
  }

  /* ---------------- 标签筛选 ---------------- */
  function renderFilter() {
    var host = document.getElementById("filter");
    var items = store.sprint().items;
    if (!items.length) { host.innerHTML = ""; return; }
    host.innerHTML = TAGS.map(function (t) {
      return '<span class="chip' + (t === curTag ? " is-on" : "") + '" data-tag="' + t + '">' + t + "</span>";
    }).join("");
    host.querySelectorAll(".chip").forEach(function (el) {
      el.onclick = function () {
        curTag = el.getAttribute("data-tag");
        renderFilter();
        renderList();
      };
    });
  }

  /* ---------------- 本周清单条目 ---------------- */
  function renderList() {
    var host = document.getElementById("list");
    var items = store.sprint().items;

    document.getElementById("btnGenTop").style.display = items.length ? "none" : "";

    if (!items.length) {
      host.innerHTML = ui.empty("◌", "本周清单还没生成",
        "先列出来，再一件件做。空白不代表你落后，只是还没开始安排。",
        '<button class="btn btn--primary" id="btnGenList">生成本周清单</button>');
      document.getElementById("btnGenList").onclick = generate;
      return;
    }

    var shown = curTag === "全部" ? items : items.filter(function (t) { return t.tag === curTag; });
    if (!shown.length) {
      host.innerHTML = ui.empty("○", "这一类暂时没有动作",
        "换个标签看看，或者自己加一条 —— 空白不代表你落后。", "");
      return;
    }

    host.innerHTML = shown.map(function (t) {
      return '<div class="task' + (t.done ? " is-done" : "") + '">' +
        '<button class="task__box" data-t="' + t.id + '" aria-label="完成">✓</button>' +
        '<div style="flex:1;min-width:0">' +
          '<div class="task__t">' + util.esc(t.text) + "</div>" +
          (t.d ? '<div class="task__d">' + util.esc(t.d) + "</div>" : "") +
        "</div>" +
        '<div class="task__side">' +
          (t.appId ? '<a class="mini-btn" href="tracker.html" style="text-decoration:none">去跟进</a>' : "") +
          tagBadge(t.tag) +
          '<button class="mini-btn" data-del="' + t.id + '">删除</button>' +
        "</div>" +
      "</div>";
    }).join("");

    host.querySelectorAll("[data-t]").forEach(function (el) {
      el.onclick = function () {
        var willDone = !el.parentNode.classList.contains("is-done");
        store.toggleSprintItem(el.getAttribute("data-t"));
        renderAll();
        if (willDone) ui.toast("勾掉一件，今天又往前走了一步", "mint");
      };
    });

    host.querySelectorAll("[data-del]").forEach(function (el) {
      el.onclick = function () {
        store.removeSprintItem(el.getAttribute("data-del"));
        ui.toast("已删除这条动作，清单本来就该你来定", "amber");
        renderAll();
      };
    });
  }

  /* ---------------- 添加自定义动作 ---------------- */
  function addItem() {
    var input = document.getElementById("newText");
    var text = (input.value || "").replace(/^\s+|\s+$/g, "");
    if (!text) { ui.toast("先写一句你具体想做的动作，比如「给上周投的 3 家各发一封跟进邮件」", "amber"); return; }
    store.addSprintItem(text, "自定义", "custom");
    input.value = "";
    curTag = "全部";
    ui.toast("已加入本周清单", "mint");
    renderAll();
  }

  /* ---------------- 今天先做这三件 ---------------- */
  function renderToday3() {
    var host = document.getElementById("today3");
    var items = store.sprint().items;

    if (!items.length) {
      host.innerHTML = ui.empty("◌", "清单还没生成",
        "生成本周清单后，这里会自动排好今天最该动的三件事。", "");
      return;
    }

    var todo = items.filter(function (t) { return !t.done; });
    todo.sort(function (a, b) { return kindRank(a.kind) - kindRank(b.kind); });
    todo = todo.slice(0, 3);

    if (!todo.length) {
      host.innerHTML = ui.noteBox("mint", "✓", "今天没有待办了",
        "本周清单已经全部完成。不用再找事情把自己填满，休息也是一种进度。");
      return;
    }

    host.innerHTML = '<div class="list">' + todo.map(function (t, i) {
      return '<div class="list__item">' +
        '<div class="list__ico" style="background:var(--accent-soft);color:var(--accent);font-weight:800">' + (i + 1) + "</div>" +
        '<div style="flex:1;min-width:0">' +
          '<div class="list__t">' + util.esc(t.text) + "</div>" +
          '<div class="list__d">' + util.esc(t.d || "在上面的清单里点方框勾选即可") + "</div>" +
        "</div>" +
        tagBadge(t.tag) +
      "</div>";
    }).join("") + "</div>" +
      '<div class="field-note mt-1">只做这三件，今天就算达标 —— 其他的先别管。</div>';
  }

  /* ---------------- 历史周完成率 ---------------- */
  function renderHistory() {
    var host = document.getElementById("history");
    var h = store.sprint().history || [];
    if (!h.length) {
      host.innerHTML = ui.empty("◷", "还没有历史周记录",
        "这一周过完，下周开始就能看到每周完成率的对比。", "");
      return;
    }
    var data = h.map(function (x) {
      var r = x.rate || util.pct(x.done || 0, x.total || 0);
      return { label: String(x.week || "").slice(5), value: r, display: r + "%" };
    });
    var last = h[h.length - 1];
    host.innerHTML = ui.bars(data) +
      '<div class="field-note">上一周完成 ' + (last.done || 0) + " / " + (last.total || 0) +
      " 项 —— 看趋势就好，别拿满分要求自己。</div>";
  }

  /* ---------------- 日拱一卒（本周 7 天） ---------------- */
  function renderWeek7() {
    var host = document.getElementById("week7");
    var items = store.sprint().items;
    var today = util.today();
    var mon = util.weekStart();
    var html = "";
    for (var i = 0; i < 7; i++) {
      var d = util.addDays(mon, i);
      var isToday = d === today;
      var doneTexts = items.filter(function (t) { return t.done && t.doneAt === d; })
        .map(function (t) { return t.text; });
      var body = doneTexts.length
        ? doneTexts.map(function (x) {
            return '<div style="color:var(--success);font-weight:650">✓ ' + util.esc(x) + "</div>";
          }).join("")
        : '<span style="color:var(--muted)">' +
          (isToday ? "今天还没勾选任何一件 —— 从最容易的开始" : "这天没有完成记录") + "</span>";
      html += '<div class="day-slot"' +
        (isToday ? ' style="background:var(--accent-soft);border-radius:10px;padding-left:10px;padding-right:10px"' : "") + ">" +
        '<div class="day-slot__time">' + WEEK_NAME[i] + " " + d.slice(5) + (isToday ? "<br>今天" : "") + "</div>" +
        '<div style="flex:1;min-width:0;font-size:12.4px">' + body + "</div>" +
      "</div>";
    }
    host.innerHTML = html;
  }

  /* ---------------- 情绪打卡 ---------------- */
  function renderMoodHint() {
    var tags = Echo.seed.moodTags;
    var today = store.moods().filter(function (m) { return m.date === util.today(); });
    var host = document.getElementById("moodHint");
    if (!today.length) { host.innerHTML = "今天还没打卡 —— 记一句，比硬扛着管用"; return; }
    var last = tags[today[today.length - 1].level - 1] || tags[2];
    host.innerHTML = "今天已打卡：" + last.emoji + " " + last.t + "（共 " + today.length + " 次）";
  }

  function renderMoodBar() {
    var trend = store.moodTrend(7);
    var data = trend.map(function (d) {
      return {
        label: d.date.slice(5),
        value: d.level ? d.level * 20 : 4,
        display: d.level ? MOOD_EMOJI[d.level] : "·"
      };
    });
    document.getElementById("moodBar").innerHTML =
      '<div class="card__desc" style="margin-bottom:2px">最近 7 天情绪（越靠上状态越稳）</div>' +
      ui.bars(data, { soft: true });
  }

  function renderMoods() {
    var host = document.getElementById("moods");
    var tags = Echo.seed.moodTags;
    host.innerHTML = tags.map(function (t) {
      return '<div class="mood" data-lv="' + t.level + '">' +
        '<div class="mood__e">' + t.emoji + "</div>" +
        '<div class="mood__t">' + t.t + "</div>" +
        '<div class="mood__d">' + t.d + "</div>" +
      "</div>";
    }).join("");
    host.querySelectorAll(".mood").forEach(function (el) {
      el.onclick = function () {
        var lv = parseInt(el.getAttribute("data-lv"), 10);
        var t = Echo.seed.moodTags[lv - 1];
        store.addMood(lv, t.t, "");
        ui.toast("已记下此刻的心情：" + t.emoji + " " + t.t, lv <= 2 ? "amber" : "mint");
        renderMoodHint();
        renderMoodBar();
      };
    });
  }

  /* ---------------- 统一渲染 ---------------- */
  function renderAll() {
    renderTop();
    renderFilter();
    renderList();
    renderToday3();
    renderHistory();
    renderWeek7();
  }

  // 初始化
  ui.mountNav("sprint");
  renderAll();
  renderMoods();
  renderMoodHint();
  renderMoodBar();

  document.getElementById("btnGenTop").onclick = generate;
  document.getElementById("btnAdd").onclick = addItem;
  document.getElementById("newText").addEventListener("keydown", function (e) {
    if (e.key === "Enter") addItem();
  });
})();
