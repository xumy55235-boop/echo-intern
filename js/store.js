/* ==========================================================================
   store.js —— 本地数据层（localStorage 单键存储，无后端、无网络）
   全局命名空间：window.Echo
      Echo.util   工具函数
      Echo.STATUS 投递状态字典
      Echo.store  数据读写 + 统计派生
   约定：所有页面脚本都通过 Echo.xxx 访问，不引用其它全局变量
   ========================================================================== */
window.Echo = window.Echo || {};

(function () {
  "use strict";

  var KEY = "huiyin_echo_v1";

  /* ---------------- 工具 ---------------- */
  var util = {
    uid: function (p) {
      return (p || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    },
    today: function () {
      return util.dateStr(new Date());
    },
    dateStr: function (d) {
      var x = (d instanceof Date) ? d : new Date(d);
      if (isNaN(x.getTime())) return "";
      var m = x.getMonth() + 1, day = x.getDate();
      return x.getFullYear() + "-" + (m < 10 ? "0" + m : m) + "-" + (day < 10 ? "0" + day : day);
    },
    nowStamp: function () {
      var d = new Date();
      var p = function (n) { return n < 10 ? "0" + n : "" + n; };
      return util.dateStr(d) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
    },
    /** 两个日期相差天数（正数表示 a 早于 b） */
    daysBetween: function (a, b) {
      var x = new Date(a), y = new Date(b);
      if (isNaN(x.getTime()) || isNaN(y.getTime())) return 0;
      return Math.round((y - x) / 86400000);
    },
    daysAgo: function (dateStr) {
      return util.daysBetween(dateStr, util.today());
    },
    /** 本周一（周一为一周起点） */
    weekStart: function (d) {
      var x = d ? new Date(d) : new Date();
      var wd = (x.getDay() + 6) % 7;          // 周一 = 0
      x.setDate(x.getDate() - wd);
      return util.dateStr(x);
    },
    addDays: function (dateStr, n) {
      var x = new Date(dateStr);
      x.setDate(x.getDate() + n);
      return util.dateStr(x);
    },
    clamp: function (n, lo, hi) { return Math.max(lo, Math.min(hi, n)); },
    pct: function (n, total) { return total > 0 ? Math.round((n / total) * 100) : 0; },
    esc: function (s) {
      return String(s == null ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    },
    /** 稳定伪随机（同一 seed 结果固定，用于生成"同伴数据"） */
    rng: function (seed) {
      var s = seed || 20261016;
      return function () {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
      };
    },
    uniq: function (arr) {
      var seen = {}, out = [];
      arr.forEach(function (x) { if (x && !seen[x]) { seen[x] = 1; out.push(x); } });
      return out;
    },
    sortBy: function (arr, fn, desc) {
      return arr.slice().sort(function (a, b) {
        var x = fn(a), y = fn(b);
        if (x === y) return 0;
        return (x > y ? 1 : -1) * (desc ? -1 : 1);
      });
    }
  };

  /* ---------------- 投递状态字典 ---------------- */
  var STATUS = [
    { key: "applied",   label: "已投递",  tone: "line",  stage: 1, followAfter: 7 },
    { key: "viewed",    label: "已查看",  tone: "cyan",  stage: 2, followAfter: 7 },
    { key: "exam",      label: "笔试",    tone: "brand", stage: 3, followAfter: 5 },
    { key: "interview", label: "面试中",  tone: "violet", stage: 4, followAfter: 5 },
    { key: "final",     label: "终面/HR", tone: "amber", stage: 5, followAfter: 4 },
    { key: "offer",     label: "Offer",   tone: "mint",  stage: 6, followAfter: 0 },
    { key: "rejected",  label: "已结束",  tone: "rose",  stage: 7, followAfter: 0 },
    { key: "ghosted",   label: "无回音",  tone: "line",  stage: 8, followAfter: 3 }
  ];
  var STATUS_MAP = {};
  STATUS.forEach(function (s) { STATUS_MAP[s.key] = s; });

  /* ---------------- 默认数据 ---------------- */
  function blank() {
    return {
      v: 1,
      createdAt: util.nowStamp(),
      profile: {
        name: "小周", school: "普通院校", major: "信息管理", grade: "大二",
        targetRole: "互联网实习（产品 / 运营 / 数据）", targetCity: "",
        weeklyGoal: 5, startDate: util.today()
      },
      applications: [],
      diagnoseRuns: [],
      radarRuns: [],
      sprint: { week: util.weekStart(), items: [], history: [] },
      moods: [],
      wall: { joined: true, posts: [] },
      demo: false
    };
  }

  /* ---------------- 读写 ---------------- */
  var cache = null;

  function load() {
    if (cache) return cache;
    try {
      var raw = localStorage.getItem(KEY);
      cache = raw ? JSON.parse(raw) : blank();
    } catch (e) {
      cache = blank();
    }
    // 容错：补齐缺失字段，避免旧数据导致页面报错
    var b = blank();
    Object.keys(b).forEach(function (k) {
      if (cache[k] === undefined || cache[k] === null) cache[k] = b[k];
    });
    if (!cache.sprint || typeof cache.sprint !== "object") cache.sprint = b.sprint;
    if (!cache.profile) cache.profile = b.profile;
    if (!Array.isArray(cache.applications)) cache.applications = [];
    return cache;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(cache));
    } catch (e) {
      console.warn("保存失败（localStorage 不可用）", e);
    }
    return cache;
  }

  /* ---------------- 派生的统计 ---------------- */
  function stats() {
    var apps = load().applications;
    var byStatus = {};
    STATUS.forEach(function (s) { byStatus[s.key] = 0; });
    apps.forEach(function (a) { byStatus[a.status] = (byStatus[a.status] || 0) + 1; });

    var total = apps.length;
    var replied = byStatus.viewed + byStatus.exam + byStatus.interview + byStatus.final + byStatus.offer + byStatus.rejected;
    var progressing = byStatus.exam + byStatus.interview + byStatus.final;
    var offer = byStatus.offer;
    var dead = byStatus.rejected + byStatus.ghosted;

    // 首次回音平均天数：取"已产生回音"的投递，用状态变更时间 - 投递时间
    var replyDays = [];
    apps.forEach(function (a) {
      if (a.status === "applied") return;
      var firstReply = a.appliedAt;
      (a.history || []).forEach(function (h) {
        if (h.status && h.status !== "applied" && h.status !== "ghosted") {
          if (!firstReply || h.at < firstReply) return;
          var d = util.daysBetween(a.appliedAt, h.at);
          if (d >= 0) { replyDays.push(d); firstReply = h.at; }
        }
      });
      if (a.replyAt) {
        var dd = util.daysBetween(a.appliedAt, a.replyAt);
        if (dd >= 0) replyDays.push(dd);
      }
    });
    var avgReply = replyDays.length
      ? Math.round(replyDays.reduce(function (s, x) { return s + x; }, 0) / replyDays.length * 10) / 10
      : null;

    // 本周投递数
    var ws = util.weekStart();
    var thisWeek = apps.filter(function (a) { return util.weekStart(a.appliedAt) === ws; }).length;
    var lastWeekStart = util.addDays(ws, -7);
    var lastWeek = apps.filter(function (a) { return util.weekStart(a.appliedAt) === lastWeekStart; }).length;

    // 渠道分布
    var channels = {};
    apps.forEach(function (a) { channels[a.channel || "未标注"] = (channels[a.channel || "未标注"] || 0) + 1; });

    return {
      total: total, byStatus: byStatus, replied: replied, progressing: progressing,
      offer: offer, dead: dead,
      replyRate: util.pct(replied, total),
      interviewRate: util.pct(byStatus.interview + byStatus.final + offer, total),
      avgReply: avgReply,
      thisWeek: thisWeek, lastWeek: lastWeek,
      weekGoal: load().profile.weeklyGoal || 5,
      weekProgress: util.pct(thisWeek, load().profile.weeklyGoal || 5),
      channels: channels,
      waiting: byStatus.applied + byStatus.viewed
    };
  }

  /* ---------------- 自动提醒（投递跟进） ---------------- */
  function reminders() {
    var out = [];
    load().applications.forEach(function (a) {
      var st = STATUS_MAP[a.status];
      if (!st || !st.followAfter) return;
      var idle = util.daysAgo(a.updatedAt || a.appliedAt);
      if (idle >= st.followAfter) {
        out.push({
          appId: a.id, company: a.company, position: a.position, status: a.status,
          idle: idle,
          level: idle >= st.followAfter * 2 ? "high" : "mid",
          text: idle >= st.followAfter * 2
            ? "已 " + idle + " 天没有动静，建议今天直接跟进或改为「无回音」归档"
            : "已 " + idle + " 天未更新，建议发一封跟进邮件 / 私信 HR"
        });
      }
    });
    return util.sortBy(out, function (r) { return -r.idle; }, false);
  }

  /* ---------------- 投递记录 CRUD ---------------- */
  function addApp(data) {
    var s = load();
    var now = util.today();
    var app = {
      id: util.uid("app"),
      company: (data.company || "").trim() || "未命名公司",
      position: (data.position || "").trim() || "未填写岗位",
      channel: data.channel || "其他",
      city: data.city || "",
      salary: data.salary || "",
      status: data.status || "applied",
      appliedAt: data.appliedAt || now,
      updatedAt: data.appliedAt || now,
      interviewAt: data.interviewAt || "",
      replyAt: "",
      note: data.note || "",
      jd: data.jd || "",
      link: data.link || "",
      risk: data.risk || null,
      history: [{ at: data.appliedAt || now, status: data.status || "applied", note: "创建记录" }]
    };
    s.applications.push(app);
    save();
    return app;
  }

  function updateApp(id, patch, historyNote) {
    var s = load();
    for (var i = 0; i < s.applications.length; i++) {
      if (s.applications[i].id !== id) continue;
      var a = s.applications[i];
      var statusChanged = patch.status && patch.status !== a.status;
      Object.keys(patch).forEach(function (k) { a[k] = patch[k]; });
      a.updatedAt = util.today();
      if (statusChanged) {
        if (!a.replyAt && patch.status !== "applied" && patch.status !== "ghosted") a.replyAt = util.today();
        a.history = a.history || [];
        a.history.push({ at: util.today(), status: patch.status, note: historyNote || ("状态更新为 " + (STATUS_MAP[patch.status] || {}).label) });
      }
      save();
      return a;
    }
    return null;
  }

  function removeApp(id) {
    var s = load();
    s.applications = s.applications.filter(function (a) { return a.id !== id; });
    save();
  }

  function findApp(id) {
    var out = null;
    load().applications.forEach(function (a) { if (a.id === id) out = a; });
    return out;
  }

  /* ---------------- 陪跑清单（按周） ---------------- */
  function sprint() {
    var s = load();
    var ws = util.weekStart();
    if (s.sprint.week !== ws) {
      // 跨周：归档上周完成率，清空清单（清单由本周重新生成）
      var items = s.sprint.items || [];
      if (items.length) {
        var done = items.filter(function (t) { return t.done; }).length;
        s.sprint.history = (s.sprint.history || []).concat([{
          week: s.sprint.week, done: done, total: items.length,
          rate: util.pct(done, items.length)
        }]).slice(-12);
      }
      s.sprint = { week: ws, items: [], history: s.sprint.history || [] };
      save();
    }
    return s.sprint;
  }

  function addSprintItem(text, tag, kind) {
    var sp = sprint();
    sp.items.push({ id: util.uid("t"), text: text, tag: tag || "自定义", kind: kind || "custom", done: false, doneAt: "" });
    save();
    return sp;
  }

  function toggleSprintItem(id) {
    var sp = sprint();
    sp.items.forEach(function (t) {
      if (t.id === id) { t.done = !t.done; t.doneAt = t.done ? util.today() : ""; }
    });
    save();
    return sp;
  }

  function removeSprintItem(id) {
    var sp = sprint();
    sp.items = sp.items.filter(function (t) { return t.id !== id; });
    save();
  }

  /* ---------------- 情绪打卡 ---------------- */
  function addMood(level, tag, note) {
    var s = load();
    s.moods = (s.moods || []).concat([{ at: util.nowStamp(), date: util.today(), level: level, tag: tag || "", note: note || "" }]).slice(-60);
    save();
  }

  function moodTrend(days) {
    var s = load(), n = days || 7, out = [];
    for (var i = n - 1; i >= 0; i--) {
      var d = util.addDays(util.today(), -i);
      var hit = s.moods.filter(function (m) { return m.date === d; });
      out.push({ date: d, level: hit.length ? hit[hit.length - 1].level : null });
    }
    return out;
  }

  /* ---------------- 导出 / 导入 / 重置 ---------------- */
  function exportJSON() { return JSON.stringify(load(), null, 2); }

  function importJSON(text) {
    var obj = JSON.parse(text);
    if (!obj || typeof obj !== "object") throw new Error("数据格式不正确");
    cache = obj;
    save();
    return true;
  }

  function resetAll() {
    cache = blank();
    save();
  }

  /* ---------------- 暴露 ---------------- */
  Echo.util = util;
  Echo.STATUS = STATUS;
  Echo.STATUS_MAP = STATUS_MAP;
  Echo.KEY = KEY;
  Echo.store = {
    load: load,
    save: save,
    blank: blank,
    stats: stats,
    reminders: reminders,
    profile: function () { return load().profile; },
    setProfile: function (patch) { var p = load().profile; Object.keys(patch).forEach(function (k) { p[k] = patch[k]; }); save(); return p; },
    applications: function () { return load().applications; },
    addApp: addApp, updateApp: updateApp, removeApp: removeApp, findApp: findApp,
    appsByStatus: function (k) { return load().applications.filter(function (a) { return a.status === k; }); },
    sprint: sprint, addSprintItem: addSprintItem, toggleSprintItem: toggleSprintItem, removeSprintItem: removeSprintItem,
    addMood: addMood, moodTrend: moodTrend, moods: function () { return load().moods || []; },
    diagnoseRuns: function () { return load().diagnoseRuns || []; },
    addDiagnoseRun: function (r) {
      var s = load();
      r.id = util.uid("dg"); r.at = util.nowStamp();
      s.diagnoseRuns = [r].concat(s.diagnoseRuns || []).slice(0, 20);
      save(); return r;
    },
    radarRuns: function () { return load().radarRuns || []; },
    addRadarRun: function (r) {
      var s = load();
      r.id = util.uid("rd"); r.at = util.nowStamp();
      s.radarRuns = [r].concat(s.radarRuns || []).slice(0, 20);
      save(); return r;
    },
    wallPosts: function () { return (load().wall || {}).posts || []; },
    addWallPost: function (text) {
      var s = load();
      s.wall = s.wall || { joined: true, posts: [] };
      s.wall.posts = [{
        at: util.nowStamp(), text: text,
        role: s.profile.grade || "大二", city: s.profile.targetCity || "同校"
      }].concat(s.wall.posts).slice(0, 20);
      save();
    },
    exportJSON: exportJSON, importJSON: importJSON, resetAll: resetAll,
    hasData: function () { return load().applications.length > 0; }
  };
})();
