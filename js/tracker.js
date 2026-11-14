/* ==========================================================================
   tracker.js —— 投递台账：看板 / 列表 / 新建编辑 / 详情 / 跟进提醒 / 小图表
   数据全部经 Echo.store 读写；除 Echo.* 外不新建全局变量。
   ========================================================================== */
(function () {
  "use strict";
  var util = Echo.util, ui = Echo.ui, store = Echo.store;

  var CHANNELS = ["实习僧", "BOSS 直聘", "牛客网", "公司官网", "公众号内推", "校园招聘会", "招聘群", "其他"];
  var TONE_VAR = {
    line: "var(--muted)", cyan: "var(--cyan)", brand: "var(--accent)",
    violet: "var(--violet)", amber: "var(--warn)", mint: "var(--success)", rose: "var(--danger)"
  };

  var state = { q: "", ch: "", st: "", sort: "time", view: "board" };
  var dragId = null;

  function byId(id) { return document.getElementById(id); }
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }

  /* ---------------- 数据筛选 ---------------- */
  function filtered() {
    var q = (state.q || "").trim().toLowerCase();
    var ch = state.ch || "";
    var st = state.st || "";
    var out = store.applications().filter(function (a) {
      if (ch && (a.channel || "未标注") !== ch) return false;
      if (st && a.status !== st) return false;
      if (!q) return true;
      var hay = ((a.company || "") + " " + (a.position || "") + " " + (a.note || "")).toLowerCase();
      return hay.indexOf(q) >= 0;
    });
    if (state.sort === "idle") {
      out = util.sortBy(out, function (a) { return util.daysAgo(a.appliedAt); }, true);
    } else {
      out = util.sortBy(out, function (a) { return a.appliedAt; }, true);
    }
    return out;
  }

  /* ---------------- 顶部统计 ---------------- */
  function renderStats() {
    var s = store.stats();
    var avg = (s.avgReply == null) ? "—" : s.avgReply;
    var cells = [
      { label: "累计投递", value: s.total, unit: "份", cls: "" },
      { label: "回音率", value: s.replyRate, unit: "%", cls: "is-accent" },
      { label: "平均首响", value: avg, unit: s.avgReply == null ? "" : "天", cls: "" },
      { label: "面试转化", value: s.interviewRate, unit: "%", cls: "is-gold" }
    ];
    byId("stats").innerHTML = cells.map(function (c) {
      return '<div class="statstrip__cell ' + c.cls + '">' +
        '<div class="statstrip__label">' + c.label + "</div>" +
        '<div class="statstrip__value">' + c.value +
          (c.unit ? "<small>" + c.unit + "</small>" : "") + "</div>" +
      "</div>";
    }).join("");
  }

  /* ---------------- 阶段筛选 chips ---------------- */
  function renderStageChips() {
    var s = store.stats(), host = byId("stageChips");
    var chips = ['<button class="chip' + (state.st === "" ? " is-on" : "") + '" data-st="">全部 <b>' + s.total + "</b></button>"];
    Echo.STATUS.forEach(function (st) {
      var n = s.byStatus[st.key] || 0;
      if (!n) return;
      chips.push('<button class="chip' + (state.st === st.key ? " is-on" : "") + '" data-st="' + st.key + '">' +
        st.label + " <b>" + n + "</b></button>");
    });
    host.innerHTML = chips.join("");
    each(host.querySelectorAll("[data-st]"), function (b) {
      b.onclick = function () {
        state.st = b.getAttribute("data-st");
        renderAll();
      };
    });
  }

  /* ---------------- 看板视图 ---------------- */
  function cardHTML(a, rem) {
    var days = util.daysAgo(a.appliedAt);
    var meta = ['<span class="badge badge--line">' + util.esc(a.channel || "未标注") + "</span>"];
    if (a.city) meta.push("<span>" + util.esc(a.city) + "</span>");
    if (a.salary) meta.push("<span>" + util.esc(a.salary) + "</span>");
    meta.push("<span>已投 " + days + " 天</span>");

    var alert = "";
    if (rem) {
      alert = '<div class="tk__alert' + (rem.level === "high" ? " tk__alert--rose" : "") + '">' +
        (rem.level === "high" ? "滞留 " + rem.idle + " 天，今天就得催" : "滞留 " + rem.idle + " 天，该跟进了") +
        "</div>";
    }

    return '<div class="tk" draggable="true" data-id="' + a.id + '">' +
      '<div class="tk__co" data-act="open">' + util.esc(a.company) + "</div>" +
      '<div class="tk__pos" data-act="open">' + util.esc(a.position) + "</div>" +
      '<div class="tk__meta">' + meta.join("") + "</div>" +
      alert +
      '<div class="tk__acts">' +
        '<button class="mini-btn" data-act="edit">编辑</button>' +
        '<button class="mini-btn" data-act="follow">跟进 +1</button>' +
        '<button class="mini-btn" data-act="del">删除</button>' +
      "</div>" +
    "</div>";
  }

  function renderBoard(apps) {
    var host = byId("boardView");
    var grouped = {};
    Echo.STATUS.forEach(function (s) { grouped[s.key] = []; });
    apps.forEach(function (a) {
      if (grouped[a.status]) grouped[a.status].push(a);
      else grouped.applied.push(a);
    });
    var remMap = {};
    store.reminders().forEach(function (r) { remMap[r.appId] = r; });

    var cols = Echo.STATUS.map(function (s) {
      var list = grouped[s.key] || [];
      var body = list.map(function (a) { return cardHTML(a, remMap[a.id]); }).join("");
      if (!body) {
        body = '<div class="empty" style="padding:22px 6px"><div class="empty__d">把卡片拖到这一列，就会进入这个状态</div></div>';
      }
      return '<div class="col" data-status="' + s.key + '">' +
        '<div class="col__head">' +
          '<span class="dot" style="color:' + (TONE_VAR[s.tone] || "var(--muted)") + '"></span>' +
          '<span class="col__name">' + s.label + "</span>" +
          '<span class="col__n">' + list.length + "</span>" +
        "</div>" +
        body +
      "</div>";
    }).join("");

    host.innerHTML = '<div class="board">' + cols + "</div>";
    bindBoard();
  }

  function clearDragStyles() {
    var host = byId("boardView");
    if (!host) return;
    each(host.querySelectorAll(".tk"), function (c) { c.classList.remove("is-drag"); });
    each(host.querySelectorAll(".col"), function (c) { c.classList.remove("is-over"); });
  }

  function bindBoard() {
    var host = byId("boardView");

    each(host.querySelectorAll(".tk"), function (card) {
      var id = card.getAttribute("data-id");

      card.addEventListener("dragstart", function (e) {
        dragId = id;
        card.classList.add("is-drag");
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "move";
          try { e.dataTransfer.setData("text/plain", id); } catch (err) { /* 某些浏览器限制，忽略 */ }
        }
      });

      card.addEventListener("dragend", function () {
        dragId = null;
        clearDragStyles();
      });

      card.addEventListener("click", function (e) {
        var act = e.target && e.target.getAttribute ? e.target.getAttribute("data-act") : null;
        if (act === "edit") { e.stopPropagation(); openForm(id); return; }
        if (act === "follow") { e.stopPropagation(); bumpFollow(id); return; }
        if (act === "del") { e.stopPropagation(); removeWithConfirm(id); return; }
        openDetail(id);
      });
    });

    each(host.querySelectorAll(".col"), function (col) {
      col.addEventListener("dragover", function (e) {
        e.preventDefault();
        col.classList.add("is-over");
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      });
      col.addEventListener("dragleave", function () { col.classList.remove("is-over"); });
      col.addEventListener("drop", function (e) {
        e.preventDefault();
        col.classList.remove("is-over");
        var id = dragId || (e.dataTransfer ? e.dataTransfer.getData("text/plain") : "");
        var status = col.getAttribute("data-status");
        if (!id) return;
        var app = store.findApp(id);
        if (!app || app.status === status) return;
        store.updateApp(id, { status: status }, "从看板拖拽更新");
        var label = (Echo.STATUS_MAP[status] || {}).label || status;
        ui.toast("「" + app.company + "」已移到「" + label + "」", "mint");
        renderAll();
      });
    });
  }

  /* ---------------- 列表视图 ---------------- */
  function renderList(apps) {
    var host = byId("listView");
    var remMap = {};
    store.reminders().forEach(function (r) { remMap[r.appId] = r; });
    var rows = apps.map(function (a) {
      var days = util.daysAgo(a.appliedAt);
      var rem = remMap[a.id];
      return '<div class="trow" data-id="' + a.id + '">' +
        '<div class="trow__main">' +
          '<div class="trow__co">' + util.esc(a.company) + "</div>" +
          '<div class="trow__pos">' + util.esc(a.position) + "</div>" +
          '<div class="trow__meta">' + ui.statusBadge(a.status, true) +
            '<span>' + util.esc(a.channel || "未标注") + "</span>" +
            (a.city ? "<span>" + util.esc(a.city) + "</span>" : "") +
            "<span>投于 " + ui.humanDate(a.appliedAt) + "</span>" +
          "</div>" +
          (rem ? '<div class="trow__alert' + (rem.level === "high" ? " trow__alert--rose" : "") + '">' +
            (rem.level === "high" ? "滞留 " + rem.idle + " 天，今天就得催" : "滞留 " + rem.idle + " 天，该跟进了") + "</div>" : "") +
        "</div>" +
        '<div class="trow__side">' +
          '<span class="trow__days">' + days + " 天</span>" +
          '<span class="trow__days">' + (a.salary ? util.esc(a.salary) : "") + "</span>" +
        "</div>" +
      "</div>";
    }).join("");

    host.innerHTML = rows || ui.empty("○", "没有符合条件的记录", "换个关键词，或把筛选放宽一点。");

    each(host.querySelectorAll(".trow"), function (tr) {
      tr.addEventListener("click", function () { openDetail(tr.getAttribute("data-id")); });
    });
  }

  /* ---------------- 该跟进了 ---------------- */
  function renderReminders() {
    var host = byId("reminders");
    var rs = store.reminders();
    if (!rs.length) {
      host.innerHTML = '<div class="note note--mint note--ico"><span class="ico">✓</span><span>' +
        '<span class="note__t">暂时没有该催的</span>' +
        "所有记录都在跟进周期里，先按自己的节奏投新的就好。" +
        "</span></div>";
      return;
    }
    host.innerHTML = '<div class="list">' + rs.map(function (r) {
      var tone = r.level === "high" ? "rose" : "amber";
      return '<div class="list__item">' +
        '<div class="list__ico" style="background:var(--' + tone + '-soft);color:var(--' + tone + ')">' +
          (r.level === "high" ? "!" : "·") + "</div>" +
        '<div style="min-width:0">' +
          '<div class="list__t">' + util.esc(r.company) + " · " + util.esc(r.position) +
            ' <span class="badge badge--' + tone + '">滞留 ' + r.idle + " 天</span></div>" +
          '<div class="list__d">' + util.esc(r.text) + "</div>" +
          '<div class="row mt-1" style="gap:6px">' +
            '<button class="mini-btn" data-id="' + r.appId + '" data-st="viewed">已在跟进</button>' +
            '<button class="mini-btn" data-id="' + r.appId + '" data-st="ghosted">归档为无回音</button>' +
          "</div>" +
        "</div>" +
      "</div>";
    }).join("") + "</div>";

    each(host.querySelectorAll("[data-st]"), function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-id");
        var st = b.getAttribute("data-st");
        var app = store.findApp(id);
        if (!app) return;
        store.updateApp(id, { status: st }, st === "viewed" ? "已在跟进" : "归档为无回音");
        var label = (Echo.STATUS_MAP[st] || {}).label || st;
        ui.toast("「" + app.company + "」已更新为「" + label + "」", st === "ghosted" ? "amber" : "mint");
        renderAll();
      });
    });
  }

  /* ---------------- 两个小图表 ---------------- */
  function renderWeekBars() {
    var host = byId("weekBars");
    var apps = store.applications();
    var base = util.weekStart();
    var data = [];
    for (var i = 7; i >= 0; i--) {
      var ws = util.addDays(base, -7 * i);
      var we = util.addDays(ws, 7);
      var n = apps.filter(function (a) { return a.appliedAt >= ws && a.appliedAt < we; }).length;
      data.push({ label: ws.slice(5).replace("-", "/"), value: n, display: n, me: i === 0 });
    }
    host.innerHTML = ui.bars(data);
  }

  function renderChannelChart() {
    var host = byId("channelDist");
    var ch = store.stats().channels;
    var arr = Object.keys(ch).map(function (k) { return { name: k, n: ch[k] }; });
    arr = util.sortBy(arr, function (x) { return x.n; }, true);
    if (!arr.length) {
      host.innerHTML = '<div class="empty" style="padding:18px 0"><div class="empty__d">还没有投递数据</div></div>';
      return;
    }
    var top = arr[0].n || 1;
    host.innerHTML = '<div class="funnel">' + arr.map(function (x) {
      return '<div class="funnel__row">' +
        '<div class="funnel__name">' + util.esc(x.name) + "</div>" +
        '<div class="funnel__bar"><div class="funnel__fill" style="width:' + util.pct(x.n, top) + '%"></div></div>' +
        '<div class="funnel__n">' + x.n + "</div>" +
      "</div>";
    }).join("") + "</div>" +
      '<div class="field-note">渠道多没关系，重点是找出「哪个渠道真的会回你」。</div>';
  }

  /* ---------------- 历史时间线 ---------------- */
  function timelineHTML(app) {
    var hist = (app.history || []).slice().reverse();
    if (!hist.length) {
      return '<div class="empty" style="padding:16px 0"><div class="empty__d">还没有时间线记录</div></div>';
    }
    return '<div class="timeline">' + hist.map(function (h, i) {
      return '<div class="timeline__item' + (i === 0 ? " is-now" : "") + '">' +
        '<div class="list__t">' + util.esc(h.note || "状态更新") + "</div>" +
        '<div class="list__d" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">' +
          util.esc(h.at || "") + (h.status ? ui.statusBadge(h.status, true) : "") +
        "</div>" +
      "</div>";
    }).join("") + "</div>";
  }

  /* ---------------- 数据操作辅助 ---------------- */
  function addHistory(id, note) {
    var app = store.findApp(id);
    if (!app) return;
    app.history = app.history || [];
    app.history.push({ at: util.today(), status: app.status, note: note });
    app.updatedAt = util.today();
    store.save();
  }

  function bumpFollow(id) {
    var app = store.findApp(id);
    if (!app) return;
    addHistory(id, "跟进：主动催了一次，等对方回音");
    ui.toast("已记下这次跟进，别怕催，HR 也需要被提醒", "mint");
    renderAll();
  }

  function removeWithConfirm(id) {
    var app = store.findApp(id);
    if (!app) return;
    ui.confirm("删除这条投递？",
      "「" + util.esc(app.company) + " · " + util.esc(app.position) + "」的记录和它的时间线会被一起删掉，删除后找不回来。",
      "删除", "rose").then(function (ok) {
        if (!ok) return;
        store.removeApp(id);
        ui.toast("已删除这条记录", "amber");
        renderAll();
      });
  }

  /* ---------------- 新建 / 编辑弹窗 ---------------- */
  function openForm(id) {
    var editing = !!id;
    var app = editing ? store.findApp(id) : null;
    if (editing && !app) return;

    var v = {
      company: app ? app.company : "",
      position: app ? app.position : "",
      channel: app ? app.channel : CHANNELS[0],
      city: app ? app.city : "",
      salary: app ? app.salary : "",
      status: app ? app.status : "applied",
      appliedAt: app ? app.appliedAt : util.today(),
      interviewAt: app ? (app.interviewAt || "") : "",
      link: app ? (app.link || "") : "",
      jd: app ? (app.jd || "") : "",
      note: app ? (app.note || "") : ""
    };

    var channelOpts = util.uniq(CHANNELS.concat([v.channel])).map(function (c) {
      return '<option value="' + util.esc(c) + '"' + (c === v.channel ? " selected" : "") + ">" + util.esc(c) + "</option>";
    }).join("");
    var statusOpts = Echo.STATUS.map(function (s) {
      return '<option value="' + s.key + '"' + (s.key === v.status ? " selected" : "") + ">" + s.label + "</option>";
    }).join("");

    var body = '<div class="form-grid">' +
      '<div class="field"><label class="label">公司 <span class="hint">必填</span></label>' +
        '<input class="input" id="fCompany" placeholder="例：云图科技" value="' + util.esc(v.company) + '"></div>' +
      '<div class="field"><label class="label">岗位 <span class="hint">必填</span></label>' +
        '<input class="input" id="fPosition" placeholder="例：前端开发实习生" value="' + util.esc(v.position) + '"></div>' +
      '<div class="field"><label class="label">渠道</label>' +
        '<select class="select" id="fChannel">' + channelOpts + "</select></div>" +
      '<div class="field"><label class="label">城市</label>' +
        '<input class="input" id="fCity" placeholder="例：武汉 / 远程" value="' + util.esc(v.city) + '"></div>' +
      '<div class="field"><label class="label">薪资</label>' +
        '<input class="input" id="fSalary" placeholder="例：150/天" value="' + util.esc(v.salary) + '"></div>' +
      '<div class="field"><label class="label">状态</label>' +
        '<select class="select" id="fStatus">' + statusOpts + "</select></div>" +
      '<div class="field"><label class="label">投递日期</label>' +
        '<input class="input" type="date" id="fDate" value="' + util.esc(v.appliedAt) + '"></div>' +
      '<div class="field"><label class="label">面试时间 <span class="hint">有安排再填</span></label>' +
        '<input class="input" type="datetime-local" id="fInterview" value="' + util.esc(v.interviewAt) + '"></div>' +
      '<div class="field"><label class="label">岗位链接</label>' +
        '<input class="input" id="fLink" placeholder="https://…" value="' + util.esc(v.link) + '"></div>' +
      '<div class="field span-2"><label class="label">岗位 JD <span class="hint">把招聘页的要求粘进来，之后复盘用得上</span></label>' +
        '<textarea class="textarea" id="fJD" placeholder="把岗位要求原文粘进来…">' + util.esc(v.jd) + "</textarea></div>" +
      '<div class="field span-2"><label class="label">备注</label>' +
        '<textarea class="textarea" id="fNote" placeholder="例：HR 说本周出结果 / 已加微信…">' + util.esc(v.note) + "</textarea></div>" +
    "</div>";

    if (editing) {
      body += '<div class="mt-2"><div class="label">这条投递的时间线</div>' + timelineHTML(app) + "</div>";
    }

    var ref = ui.modal({
      title: editing ? "编辑投递 · " + app.company : "新建投递记录",
      wide: true,
      body: body,
      foot: '<button class="btn" data-cancel="1">取消</button>' +
            '<button class="btn btn--primary" data-save="1">' + (editing ? "保存修改" : "保存记录") + "</button>",
      onOpen: function (host) {
        host.querySelector("[data-cancel]").onclick = function () { ref.close(); };
        host.querySelector("[data-save]").onclick = function () { submitForm(ref, id, editing); };
        var first = host.querySelector("#fCompany");
        if (first) first.focus();
      }
    });
  }

  function submitForm(ref, id, editing) {
    var host = ref.el;
    function val(sel) {
      var el = host.querySelector(sel);
      return el ? String(el.value || "").trim() : "";
    }
    var company = val("#fCompany");
    var position = val("#fPosition");
    if (!company || !position) {
      ui.toast("公司和岗位都填一下，不然以后想不起来投的是哪家", "amber");
      return;
    }
    var patch = {
      company: company,
      position: position,
      channel: val("#fChannel"),
      city: val("#fCity"),
      salary: val("#fSalary"),
      status: val("#fStatus"),
      appliedAt: val("#fDate") || util.today(),
      interviewAt: val("#fInterview"),
      link: val("#fLink"),
      jd: val("#fJD"),
      note: val("#fNote")
    };
    if (editing) {
      store.updateApp(id, patch);
      ui.toast("已更新「" + company + "」的记录", "mint");
    } else {
      store.addApp(patch);
      ui.toast("已记下「" + company + " · " + position + "」，安心等它回音", "mint");
    }
    ref.close();
    renderAll();
  }

  /* ---------------- 详情弹窗 ---------------- */
  function openDetail(id) {
    var app = store.findApp(id);
    if (!app) return;
    var days = util.daysAgo(app.appliedAt);

    var rem = null;
    store.reminders().forEach(function (r) { if (r.appId === id) rem = r; });

    var rows = [
      ["状态", ui.statusBadge(app.status)],
      ["渠道", util.esc(app.channel || "未标注")],
      ["城市", util.esc(app.city || "—")],
      ["薪资", util.esc(app.salary || "—")],
      ["投递日期", util.esc(app.appliedAt) + "（" + ui.humanDate(app.appliedAt) + "）"],
      ["滞留天数", days + " 天"]
    ];
    if (app.interviewAt) {
      rows.push(["面试时间", util.esc(String(app.interviewAt).replace("T", " "))]);
    }
    rows.push(["岗位链接", app.link ? '<a href="' + util.esc(app.link) + '" target="_blank">' + util.esc(app.link) + "</a>" : "—"]);

    var body = '<dl class="kv">' + rows.map(function (r) {
      return "<dt>" + r[0] + "</dt><dd>" + r[1] + "</dd>";
    }).join("") + "</dl>";

    if (rem) {
      body += '<div class="mt-2">' +
        ui.noteBox(rem.level === "high" ? "rose" : "amber", "!", "该跟进了", util.esc(rem.text)) + "</div>";
    }
    if (app.jd) {
      body += '<div class="mt-2"><div class="label">岗位 JD</div>' +
        '<div class="quote" style="white-space:pre-wrap">' + util.esc(app.jd) + "</div></div>";
    }
    if (app.note) {
      body += '<div class="mt-2"><div class="label">备注</div><div class="note">' + util.esc(app.note) + "</div></div>";
    }
    body += '<div class="mt-3"><div class="label">跟进时间线</div>' + timelineHTML(app) + "</div>";
    body += '<div class="mt-2"><label class="label">添加一条跟进记录 <span class="hint">例：今天发了跟进邮件 / 约到二面</span></label>' +
      '<div class="row" style="gap:8px">' +
        '<div style="flex:1;min-width:160px"><input class="input" id="fuText" placeholder="写一句发生了什么…"></div>' +
        '<button class="btn btn--primary" id="fuAdd">记录</button>' +
      "</div></div>";

    var ref = ui.modal({
      title: app.company + " · " + app.position,
      wide: true,
      body: body,
      foot: '<button class="btn btn--danger-ghost" data-del="1">删除</button>' +
            '<span class="spacer"></span>' +
            '<button class="btn" data-edit="1">编辑</button>' +
            '<button class="btn btn--primary" data-close="1">关闭</button>',
      onOpen: function (host) {
        host.querySelector("[data-close]").onclick = function () { ref.close(); };
        host.querySelector("[data-edit]").onclick = function () { ref.close(); openForm(id); };
        host.querySelector("[data-del]").onclick = function () { ref.close(); removeWithConfirm(id); };
        var addBtn = host.querySelector("#fuAdd");
        var inp = host.querySelector("#fuText");
        addBtn.onclick = function () { addFollow(id, host, ref); };
        if (inp) {
          inp.addEventListener("keydown", function (e) {
            if (e.key === "Enter") { e.preventDefault(); addFollow(id, host, ref); }
          });
        }
      }
    });
  }

  function addFollow(id, host, ref) {
    var inp = host.querySelector("#fuText");
    var text = inp ? String(inp.value || "").trim() : "";
    if (!text) { ui.toast("先写一句发生了什么吧", "amber"); return; }
    addHistory(id, "跟进：" + text);
    ui.toast("已记下这条跟进", "mint");
    ref.close();
    openDetail(id);
    renderAll();
  }

  /* ---------------- 空状态 / 总渲染 ---------------- */
  function renderEmpty(onCreate) {
    var box = byId("emptyBox");
    box.innerHTML = ui.empty("○", "还没有投递记录",
      "投出去的那些去了哪儿、什么时候该催，先记下第一份，之后就有据可依了。",
      '<div class="row" style="justify-content:center">' +
        '<button class="btn btn--primary" data-new="1">＋ 新建第一条投递</button>' +
        '<button class="btn" data-demo="1">载入演示数据看看</button>' +
      "</div>");
    each(box.querySelectorAll("[data-new]"), function (b) { b.onclick = onCreate; });
    each(box.querySelectorAll("[data-demo]"), function (b) {
      b.onclick = function () {
        Echo.seed.fillDemo(true);
        ui.toast("已载入演示数据，先看看这套流程长什么样", "mint");
        location.reload();
      };
    });
  }

  function renderAll() {
    renderStats();
    var total = store.stats().total;
    var ledger = byId("ledger");
    var side = byId("sideArea");
    var box = byId("emptyBox");
    var filters = byId("filters");

    if (!total) {
      ledger.style.display = "none";
      side.style.display = "none";
      filters.style.display = "none";
      byId("ledgerSub").textContent = "记录一次，跟进就有依据。";
      renderEmpty(function () { openForm(null); });
      return;
    }

    box.innerHTML = "";
    ledger.style.display = "";
    side.style.display = "";
    filters.style.display = "";
    renderStageChips();

    var apps = filtered();
    byId("ledgerSub").textContent = "共 " + total + " 份" +
      (apps.length === total ? "，全部都在这里。" : " · 当前显示 " + apps.length + " 份");

    var bv = byId("boardView");
    var lv = byId("listView");

    if (!apps.length) {
      var msg = ui.empty("○", "没有符合条件的记录", "换个关键词，或把筛选放宽一点。",
        '<button class="btn btn--sm" data-reset="1">清除筛选</button>');
      bv.innerHTML = msg;
      lv.innerHTML = msg;
      each(document.querySelectorAll("[data-reset]"), function (b) {
        b.onclick = function () {
          state.q = ""; state.ch = ""; state.st = "";
          byId("q").value = "";
          byId("selChannel").value = "";
          renderAll();
        };
      });
    } else {
      renderBoard(apps);
      renderList(apps);
    }

    bv.style.display = state.view === "board" ? "" : "none";
    lv.style.display = state.view === "list" ? "" : "none";

    renderReminders();
    renderWeekBars();
    renderChannelChart();
  }

  /* ---------------- 工具条 / 初始化 ---------------- */
  function buildChannels() {
    var sel = byId("selChannel");
    var extra = util.uniq(store.applications().map(function (a) { return a.channel || "未标注"; }));
    var list = util.uniq(CHANNELS.concat(extra));
    var opts = ['<option value="">全部渠道</option>'];
    list.forEach(function (c) {
      opts.push('<option value="' + util.esc(c) + '">' + util.esc(c) + "</option>");
    });
    sel.innerHTML = opts.join("");
  }

  function bindToolbar() {
    byId("q").addEventListener("input", function (e) { state.q = e.target.value; renderAll(); });
    byId("selChannel").addEventListener("change", function (e) { state.ch = e.target.value; renderAll(); });
    byId("selSort").addEventListener("change", function (e) { state.sort = e.target.value; renderAll(); });
    each(document.querySelectorAll("#viewTabs .seg__btn"), function (tab) {
      tab.addEventListener("click", function () {
        state.view = tab.getAttribute("data-view");
        each(document.querySelectorAll("#viewTabs .seg__btn"), function (x) {
          x.classList.toggle("is-on", x === tab);
        });
        renderAll();
      });
    });
    byId("btnNew").addEventListener("click", function () { openForm(null); });
  }

  ui.mountNav("tracker");
  buildChannels();
  bindToolbar();
  renderAll();
})();

