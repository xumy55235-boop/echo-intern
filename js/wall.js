/* ==========================================================================
   wall.js —— 同伴进度墙
   1) 同校匿名聚合概览：样本量 / 平均投递 / 回音率 / 平均首次回音
   2) 「你在这里」：把自己的真实统计与同校平均横向对照（本页视觉核心）
   3) 本周投递份数分布 / 同校阶段分布 / 行业分布 / 同辈情绪曲线
   4) 匿名动态流：确定性样例 6 条 + 用户自己发的
   数据全部经 Echo.store / Echo.seed 读取，不联网、不外部资源。
   ========================================================================== */
(function () {
  "use strict";

  var util = Echo.util, ui = Echo.ui, store = Echo.store;
  var P = Echo.seed.peers();

  /* 折算口径：同校 avgApps 视为约 4 周的投递跨度，折算成"每周几份"（估算，非真实周统计） */
  var WEEK_WINDOW = 4;

  var TONES = ["ava--mint", "ava--amber", "ava--violet", "ava--rose"];
  var PEER_META = [
    { role: "大二", city: "武汉" },
    { role: "大三", city: "武汉" },
    { role: "大二", city: "成都" },
    { role: "大三", city: "西安" },
    { role: "大二", city: "南京" },
    { role: "大三", city: "武汉" }
  ];
  var TIMES = ["本周一", "2 天前", "昨天", "本周", "4 小时前", "上周末"];

  /* ---------------- 小工具 ---------------- */
  function cardHead(ico, cls, title, desc) {
    return '<div class="card__head">' +
      '<div class="card__ico' + (cls ? " " + cls : "") + '">' + ico + "</div>" +
      "<div>" +
        '<div class="card__title">' + util.esc(title) + "</div>" +
        '<div class="card__desc">' + desc + "</div>" +
      "</div></div>";
  }

  /* 把投递份数映射到 peers().buckets 的桶下标 */
  function bucketIndex(n) {
    if (n <= 0) return 0;
    if (n <= 2) return 1;
    if (n <= 5) return 2;
    if (n <= 9) return 3;
    if (n <= 15) return 4;
    return 5;
  }

  /* 用分布桶估算百分位：更低各档累加 + 本档按半数计入 */
  function percentile(n) {
    var idx = bucketIndex(n), below = 0, i;
    for (i = 0; i < idx; i++) below += P.dist[i];
    return { idx: idx, pct: util.pct(below + P.dist[idx] / 2, P.sample) };
  }

  /* 好坏判断：0 份=rose，低于同校均=amber，达到/超过=可保持 */
  function pickTone(mine, avg) {
    if (mine <= 0) return "rose";
    return mine >= avg ? "mint" : "amber";
  }

  function cmpBar(label, pct, tone, txt, strong) {
    return '<div style="display:grid;grid-template-columns:52px 1fr 86px;gap:9px;align-items:center;font-size:12px;margin-bottom:5px">' +
      '<span style="color:var(--muted)">' + label + "</span>" +
      '<div class="meter meter--thin"><div class="meter__bar' +
        (tone ? " meter__bar--" + tone : "") + '" style="width:' + pct + '%"></div></div>' +
      '<span style="text-align:right;' + (strong ? "font-weight:700" : "color:var(--muted)") + '">' + txt + "</span>" +
    "</div>";
  }

  function cmpRow(name, myTxt, myVal, avgTxt, avgVal, tone) {
    var scale = Math.max(myVal, avgVal, 0.001);
    var mp = util.clamp(Math.round(myVal / scale * 100), 0, 100);
    var ap = util.clamp(Math.round(avgVal / scale * 100), 0, 100);
    return '<div style="margin-bottom:15px">' +
      '<div class="row row--between" style="margin-bottom:6px">' +
        '<span style="font-size:12.6px;font-weight:700;color:var(--text-2)">' + name + "</span>" +
      "</div>" +
      cmpBar("你", mp, tone, myTxt, true) +
      cmpBar("同校均", ap, "", avgTxt, false) +
    "</div>";
  }

  /* 确定性打乱（同一 seed 结果固定，刷新顺序不变） */
  function pickPosts(pool, n, seed) {
    var rnd = util.rng(seed), idx = [], i, j, t;
    for (i = 0; i < pool.length; i++) idx.push(i);
    for (i = idx.length - 1; i > 0; i--) {
      j = Math.floor(rnd() * (i + 1));
      t = idx[i]; idx[i] = idx[j]; idx[j] = t;
    }
    return idx.slice(0, n).map(function (k) { return pool[k]; });
  }

  /* ---------------- 顶部：hero ---------------- */
  function renderHero() {
    document.getElementById("heroSub").innerHTML =
      "这是同校同年级「" + util.esc(P.school) + "」的匿名聚合进度：样本 " + P.sample + " 人，" +
      util.esc(String(P.updatedAt).replace(/（[^）]*）/g, "")) + "。看到室友拿到面试、群里有人晒 offer 就开始怀疑自己，很正常 ——" +
      "先看清「大家都这样」，再决定下一步。";
    document.getElementById("heroQuote").innerHTML = util.esc(P.insight);
  }

  /* ---------------- 四个数据卡 ---------------- */
  function renderStats() {
    var cells = [
      { label: "同校样本", value: P.sample, unit: "人", cls: "" },
      { label: "平均投递", value: P.avgApps, unit: "份", cls: "is-accent" },
      { label: "有回音", value: P.replyRate, unit: "%", cls: "" },
      { label: "平均首响", value: P.avgFirstReply, unit: "天", cls: "is-gold" }
    ];
    document.getElementById("peerStats").innerHTML = cells.map(function (c) {
      return '<div class="statstrip__cell ' + c.cls + '">' +
        '<div class="statstrip__label">' + c.label + "</div>" +
        '<div class="statstrip__value">' + c.value + "<small>" + c.unit + "</small></div>" +
      "</div>";
    }).join("");
  }

  /* ---------------- 「你在这里」对照卡 ---------------- */
  function renderYou() {
    var host = document.getElementById("youCard");
    var head = cardHead("◉", "card__ico--violet", "你在这里",
      "你台账里的真实统计，和同校平均并排放。");
    var s = store.stats();

    if (s.total === 0) {
      host.innerHTML = head + ui.empty("○", "你还没有投递记录",
        "先记下第一份投递，「你在这里」才有参照。一条就够，不用凑数。",
        '<a class="btn btn--primary btn--sm" href="tracker.html">去台账记一条</a>');
      return;
    }

    var weekAvg = Math.round((P.avgApps / WEEK_WINDOW) * 10) / 10;
    var per = percentile(s.total);

    var rows = "";
    rows += cmpRow("本周投递份数", s.thisWeek + " 份", s.thisWeek, weekAvg + " 份", weekAvg,
      pickTone(s.thisWeek, weekAvg));
    rows += cmpRow("有回音比例", s.replyRate + "%", s.replyRate, P.replyRate + "%", P.replyRate,
      pickTone(s.replyRate, P.replyRate));
    rows += cmpRow("已投递总量", s.total + " 份", s.total, P.avgApps + " 份", P.avgApps,
      pickTone(s.total, P.avgApps));

    var caliber = '<div class="field-note mt-1">口径说明：同校平均投递 ' + P.avgApps +
      " 份是累计值，按样本约 " + WEEK_WINDOW + " 周的投递跨度折算为每周约 " + weekAvg +
      " 份（这是估算，不是真实周统计）；回音率与总量则直接对齐同校平均值。</div>";

    var position = '<div class="card__body mt-2">你已投 <b>' + s.total +
      " 份</b>，按同校分布估算，比样本里约 <b>" + per.pct + "%</b> 的同学投得多（估算方式：你落在「" +
      P.buckets[per.idx] + "」这一档，取该档半数、加上更低各档的人数，再除以样本 " + P.sample + " 人）。</div>";

    var foot = "";
    if (s.avgReply != null) {
      foot = '<div class="field-note mt-1">你的首次回音平均 ' + s.avgReply +
        " 天，同校样本 " + P.avgFirstReply + " 天（天数越低越好）。</div>";
    }

    var note;
    if (s.replied === 0) {
      note = "同校样本里 " + P.ghostRate + "% 的人第一次投递至今没有回音 —— 没有回音是常态，不是你一个人的问题。";
    } else if (s.thisWeek >= weekAvg) {
      note = "这周你投了 " + s.thisWeek + " 份，已经接近或超过同校折算的每周 " + weekAvg + " 份，节奏在你手里，稳住就好。";
    } else {
      note = "投得少不丢人，投得准才是关键：花 10 分钟照 JD 改一次简历关键词，比硬凑数量更有用。";
    }
    var conclusion = '<div class="mt-2">' +
      ui.noteBox(s.replied > 0 ? "mint" : "", "◉", "先看一眼数据，再评价自己", note) + "</div>";

    host.innerHTML = head + rows + caliber + position + foot + conclusion;
  }

  /* ---------------- 本周投递份数分布 ---------------- */
  function renderWeek() {
    var host = document.getElementById("weekCard");
    var s = store.stats();
    var idx = bucketIndex(s.thisWeek);
    var data = P.buckets.map(function (b, i) {
      return { label: b, value: P.dist[i], me: i === idx };
    });
    var low = util.pct(P.dist[0] + P.dist[1], P.sample);

    host.innerHTML = cardHead("▥", "", "本周投递份数分布",
      "同校首投族「本周（周一起）投递份数」的匿名分布，绿色是你现在的位置。") +
      ui.bars(data) +
      '<div class="field-note mt-1">绿色 = 你（本周 ' + s.thisWeek + " 份，落在「" + P.buckets[idx] +
      "」这一档）。看的是本周节奏，不是累计量。</div>" +
      '<div class="mt-2">' +
      ui.noteBox("mint", "◇", "", "样本里本周投 0-2 份的同学约占 " + low +
        "% —— 断一两天再投很正常，别把「停一下」当成「我不行」。") + "</div>";
  }

  /* ---------------- 同校阶段分布 ---------------- */
  function renderStage() {
    var host = document.getElementById("stageCard");
    var rows = P.stage.map(function (st) {
      return '<div class="funnel__row">' +
        '<div class="funnel__name">' + util.esc(st.name) + "</div>" +
        '<div class="funnel__bar"><div class="funnel__fill" style="width:' + st.pct + '%"></div></div>' +
        '<div class="funnel__n">' + st.pct + "%</div>" +
      "</div>";
    }).join("");

    host.innerHTML = cardHead("▤", "card__ico--mint", "同校阶段分布",
      "同校样本现在各自走到哪一步（匿名聚合，四项合计 100%）。") +
      '<div class="funnel">' + rows + "</div>" +
      '<div class="field-note mt-2">' + P.stage[0].pct + "% 和你一样还在投递中，" + P.stage[1].pct +
      "% 已拿到面试，" + P.stage[P.stage.length - 1].pct +
      "% 已拿到 Offer —— 大多数人都在你这一段路上，拿到 Offer 的是少数。</div>";
  }

  /* ---------------- 行业 / 方向分布 ---------------- */
  function renderIndustry() {
    var host = document.getElementById("industryCard");
    var top = P.industries[0], second = P.industries[1];
    var rows = P.industries.map(function (it) {
      return '<div class="funnel__row">' +
        '<div class="funnel__name">' + util.esc(it.name) + "</div>" +
        '<div class="funnel__bar"><div class="funnel__fill" style="width:' + it.pct + '%"></div></div>' +
        '<div class="funnel__n">' + it.pct + "%</div>" +
      "</div>";
    }).join("");

    host.innerHTML = cardHead("◈", "card__ico--amber", "行业 / 方向分布",
      "同校样本投递方向的匿名占比（合计约 100%）。") +
      '<div class="funnel">' + rows + "</div>" +
      '<div class="field-note mt-2">样本里最集中的方向是「' + util.esc(top.name) + "」（" + top.pct +
      "%），其次是「" + util.esc(second.name) + "」（" + second.pct +
      "%）。方向越扎堆，简历与 JD 的对齐度就越关键。</div>";
  }

  /* ---------------- 同辈情绪曲线 ---------------- */
  function renderMood() {
    var host = document.getElementById("moodCard");
    var sum = 0, hi = P.moodCurve[0], lo = P.moodCurve[0];
    P.moodCurve.forEach(function (d) {
      sum += d.level;
      if (d.level > hi.level) hi = d;
      if (d.level < lo.level) lo = d;
    });
    var avg = Math.round(sum / P.moodCurve.length * 10) / 10;
    var data = P.moodCurve.map(function (d) {
      return { label: d.label, value: d.level * 20, display: d.level.toFixed(1) };
    });

    host.innerHTML = cardHead("♡", "card__ico--rose", "同辈情绪曲线",
      "同校样本最近 7 天匿名情绪打卡的平均分（1-5 分，越靠上越稳）。") +
      ui.bars(data) +
      '<div class="field-note mt-1">7 天均分 ' + avg + " 分，最高在「" + hi.label + "」（" + hi.level.toFixed(1) +
      "），最低在「" + lo.label + "」（" + lo.level.toFixed(1) +
      "）。</div>" +
      '<div class="field-note">情绪本来就会起落，样本曲线同样有低谷 —— 起落不代表你做得不好。</div>';
  }

  /* ---------------- 匿名动态流 ---------------- */
  function renderFeed() {
    var host = document.getElementById("feedList");
    var items = [];

    /* 自己的帖子：最新的在最前，标「我」 */
    store.wallPosts().forEach(function (p, i) {
      var at = (p.at || "").slice(0, 10);
      items.push({
        name: "我的匿名动态",
        tone: TONES[i % TONES.length],
        time: ui.humanDate(at),
        text: p.text,
        me: true
      });
    });

    /* 同校样例 6 条：确定性挑选，刷新顺序不变 */
    var picked = pickPosts(Echo.seed.peerPosts, 6, 20261016);
    picked.forEach(function (text, i) {
      var m = PEER_META[i % PEER_META.length];
      items.push({
        name: "匿名 · " + m.role + " · " + m.city,
        tone: TONES[(i + 1) % TONES.length],
        time: TIMES[i % TIMES.length],
        text: text,
        me: false
      });
    });

    host.innerHTML = items.map(function (it) {
      return '<div class="anon-row">' +
        '<div class="ava ' + it.tone + '">' + (it.me ? "我" : "匿") + "</div>" +
        '<div style="flex:1;min-width:0">' +
          '<div class="row" style="gap:8px">' +
            '<span class="list__t">' + util.esc(it.name) + "</span>" +
            (it.me ? '<span class="badge badge--brand">仅本机</span>' : '<span class="badge badge--line">同校</span>') +
            '<span class="list__time">' + util.esc(it.time) + "</span>" +
          "</div>" +
          '<div class="card__desc" style="color:var(--text-2)">' + util.esc(it.text) + "</div>" +
        "</div>" +
      "</div>";
    }).join("");

    document.getElementById("feedCount").textContent = items.length + " 条";
  }

  function bindFeed() {
    var input = document.getElementById("fdText");
    var btn = document.getElementById("fdSend");
    btn.onclick = function () {
      var v = (input.value || "").replace(/^\s+|\s+$/g, "");
      if (!v) {
        ui.toast("先写一句再发吧", "amber");
        input.focus();
        return;
      }
      store.addWallPost(v);
      input.value = "";
      ui.toast("已发布（只保存在你自己的浏览器里）", "mint");
      renderFeed();
    };
    input.onkeydown = function (e) {
      var key = e.key || e.keyCode;
      if (key === "Enter" || key === 13) btn.click();
    };
  }

  /* ---------------- 隐私与数据说明 ---------------- */
  function renderPrivacy() {
    document.getElementById("privacy").innerHTML = ui.noteBox("amber", "◇", "隐私与数据说明",
      "<b>本页同校数据为演示用的匿名聚合样例</b>（固定生成，不代表真实统计）；" +
      "<b>用户发帖只存在你自己的浏览器里</b>，不会上传、不连服务器。" +
      "真实版本必须做匿名化聚合、最小化采集，并明确写出隐私边界：" +
      "只展示「匿名 · 年级 · 城市」这类无法反推个人的字段，任何人都不应能通过本页定位到具体同学。");
  }

  /* ---------------- 初始化 ---------------- */
  ui.mountNav("wall", { back: "index.html", title: "同伴进度墙" });
  renderHero();
  renderStats();
  renderYou();
  renderWeek();
  renderStage();
  renderIndustry();
  renderMood();
  renderFeed();
  bindFeed();
  renderPrivacy();
})();

