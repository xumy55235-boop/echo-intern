/* ==========================================================================
   ui.js —— 公共 UI：主题 / 底部导航 / 页头 / Toast / 弹层 / 进度组件
   所有页面只写内容，导航由 mountNav(active, opts) 统一下发。
   ========================================================================== */
window.Echo = window.Echo || {};

(function () {
  "use strict";
  var util = Echo.util;

  /* ---------------- 主题 ---------------- */
  var THEME_KEY = "huiyin_theme";

  function applyTheme(name) {
    var t = name || "dark";
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* 忽略 */ }
    return t;
  }

  function currentTheme() {
    try { return localStorage.getItem(THEME_KEY) || "dark"; } catch (e) { return "dark"; }
  }

  // 尽早应用，避免白屏闪一下
  applyTheme(currentTheme());

  /* ---------------- 图标（24px 线性） ---------------- */
  var ICONS = {
    home: '<path d="M4 10.5 12 4l8 6.5"/><path d="M6 9.5V20h12V9.5"/><path d="M9.5 20v-5.5h5V20"/>',
    folder: '<path d="M4 7.5h6l2 2h8v9.5H4z"/><path d="M4 7.5V6h6l2 2"/>',
    target: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    check: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="m8 12 2.6 2.6L16 9.6"/>',
    user: '<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c.6-3.8 3.4-5.6 7-5.6s6.4 1.8 7 5.6"/>',
    back: '<path d="M15 5 8 12l7 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    arrow: '<path d="M5 12h13M13 6l6 6-6 6"/>',
    shield: '<path d="M12 3.5 19 6v6c0 4-3 7-7 8.5-4-1.5-7-4.5-7-8.5V6z"/><path d="m9 12 2 2 4-4"/>',
    users: '<circle cx="9" cy="9" r="3"/><path d="M3.5 19c.5-3 2.6-4.6 5.5-4.6s5 1.6 5.5 4.6"/><path d="M15.5 6.4a3 3 0 0 1 0 5.6M17 14.6c2.1.5 3.4 2 3.8 4.4"/>',
    bell: '<path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6z"/><path d="M10 19a2 2 0 0 0 4 0"/>',
    doc: '<path d="M6 3.5h8L18 7v13.5H6z"/><path d="M13.5 3.5V7H18"/><path d="M9 11h6M9 14.5h6M9 18h4"/>'
  };

  function icon(name, size) {
    var d = ICONS[name] || ICONS.arrow;
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"' +
      (size ? ' width="' + size + '" height="' + size + '"' : "") + ">" + d + "</svg>";
  }

  /* ---------------- 底部 5 Tab ---------------- */
  var TABS = [
    { key: "index",    file: "index.html",    label: "今日", icon: "home" },
    { key: "tracker",  file: "tracker.html",  label: "投递", icon: "folder" },
    { key: "diagnose", file: "diagnose.html", label: "诊断", icon: "target" },
    { key: "sprint",   file: "sprint.html",   label: "陪跑", icon: "check" },
    { key: "profile",  file: "profile.html",  label: "我的", icon: "user" }
  ];

  // 二级页面归属到某个 Tab
  var TAB_PARENT = { wall: "index", radar: "tracker" };

  function mountNav(active, opts) {
    opts = opts || {};
    var on = TAB_PARENT[active] || active;
    var pending = 0;
    try { pending = Echo.store.reminders().length; } catch (e) { pending = 0; }

    var host = document.getElementById("nav");
    if (host) {
      host.innerHTML = opts.back
        ? '<div class="topbar"><div class="topbar__in">' +
            '<a class="topbar__back" href="' + (opts.back === true ? "index.html" : opts.back) + '" aria-label="返回">' + icon("back") + "</a>" +
            '<span class="topbar__title">' + util.esc(opts.title || "") + "</span>" +
            '<span class="topbar__side">' + (opts.side || "") + "</span>" +
          "</div></div>"
        : "";
    }

    var old = document.getElementById("tabbar");
    if (old) old.remove();

    var bar = document.createElement("nav");
    bar.id = "tabbar";
    bar.className = "tabbar";
    bar.setAttribute("aria-label", "底部导航");
    bar.innerHTML = '<div class="tabbar__in">' + TABS.map(function (t) {
      var badge = (t.key === "tracker" && pending)
        ? '<span class="tabbar__dot">' + (pending > 9 ? "9+" : pending) + "</span>" : "";
      return '<a class="tabbar__item' + (t.key === on ? " is-on" : "") + '" href="' + t.file + '"' +
        (t.key === on ? ' aria-current="page"' : "") + ">" +
        icon(t.icon) + "<span>" + t.label + "</span>" + badge + "</a>";
    }).join("") + "</div>";
    document.body.appendChild(bar);

    // 页脚：移动端不再重复品牌信息，保持轻
    var ft = document.getElementById("foot");
    if (ft) ft.innerHTML = "";
  }

  /* ---------------- Toast ---------------- */
  function toastWrap() {
    var w = document.getElementById("toasts");
    if (!w) {
      w = document.createElement("div");
      w.id = "toasts";
      w.className = "toast-wrap";
      document.body.appendChild(w);
    }
    return w;
  }

  function toast(msg, tone) {
    var w = toastWrap();
    var el = document.createElement("div");
    el.className = "toast" + (tone ? " toast--" + tone : "");
    el.innerHTML = "<span>" + (tone === "mint" ? "✓" : tone === "rose" ? "!" : tone === "amber" ? "⚠" : "·") + "</span><span>" + util.esc(msg) + "</span>";
    w.appendChild(el);
    setTimeout(function () {
      el.style.transition = "opacity .22s, transform .22s";
      el.style.opacity = "0";
      el.style.transform = "translateY(6px)";
      setTimeout(function () { el.remove(); }, 240);
    }, 2600);
  }

  /* ---------------- 底部弹层 ---------------- */
  function modal(opts) {
    var mask = document.createElement("div");
    mask.className = "mask";
    var wide = opts.wide ? " modal--wide" : "";
    mask.innerHTML =
      '<div class="modal' + wide + '" role="dialog" aria-modal="true">' +
        '<div class="modal__head">' +
          '<div class="modal__title">' + util.esc(opts.title || "") + "</div>" +
          '<button class="modal__x" data-x="1" aria-label="关闭">✕</button>' +
        "</div>" +
        '<div class="modal__body">' + (opts.body || "") + "</div>" +
        '<div class="modal__foot">' + (opts.foot || "") + "</div>" +
      "</div>";
    document.body.appendChild(mask);
    function close() { mask.remove(); }
    mask.addEventListener("click", function (e) {
      if (e.target === mask || e.target.getAttribute("data-x")) close();
    });
    if (opts.onOpen) opts.onOpen(mask);
    return { el: mask, close: close };
  }

  function confirmBox(title, body, okText, tone) {
    return new Promise(function (resolve) {
      var m = modal({
        title: title,
        body: body,
        foot: '<button class="btn" data-no="1">取消</button>' +
              '<button class="btn ' + (tone === "rose" ? "btn--rose" : "btn--primary") + '" data-ok="1">' + (okText || "确定") + "</button>",
        onOpen: function (host) {
          host.querySelector("[data-no]").onclick = function () { m.close(); resolve(false); };
          host.querySelector("[data-ok]").onclick = function () { m.close(); resolve(true); };
        }
      });
    });
  }

  /* ---------------- 通用片段 ---------------- */
  function statusBadge(key, small) {
    var s = Echo.STATUS_MAP[key] || { label: key, tone: "line" };
    return '<span class="badge badge--' + s.tone + '"' + (small ? ' style="font-size:10px"' : "") + ">" +
      '<span class="dot"></span>' + s.label + "</span>";
  }

  function ring(pct, caption, size) {
    var p = util.clamp(Math.round(pct || 0), 0, 100);
    var r = 42, c = 2 * Math.PI * r, off = c * (1 - p / 100);
    var grad = '<defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#45B8A8"/><stop offset="100%" stop-color="#6FE0CE"/></linearGradient></defs>';
    return '<div class="ring' + (size === "sm" ? " ring--sm" : size === "lg" ? " ring--lg" : "") + '">' +
      '<svg viewBox="0 0 100 100" width="100%" height="100%">' + grad +
      '<circle class="ring__track" cx="50" cy="50" r="' + r + '"/>' +
      '<circle class="ring__bar" cx="50" cy="50" r="' + r + '" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/>' +
      "</svg>" +
      '<div class="ring__mid"><div><div class="ring__num">' + p + '%</div>' +
      (caption ? '<div class="ring__cap">' + util.esc(caption) + "</div>" : "") + "</div></div>" +
      "</div>";
  }

  function meter(pct, tone) {
    var p = util.clamp(Math.round(pct || 0), 0, 100);
    return '<div class="meter"><div class="meter__bar' + (tone ? " meter__bar--" + tone : "") + '" style="width:' + p + '%"></div></div>';
  }

  function empty(ico, title, desc, actionHTML) {
    return '<div class="empty"><div class="empty__ico">' + ico + "</div>" +
      '<div class="empty__t">' + util.esc(title) + "</div>" +
      '<div class="empty__d">' + util.esc(desc || "") + "</div>" +
      (actionHTML ? '<div class="mt-2">' + actionHTML + "</div>" : "") + "</div>";
  }

  function bars(data, opts) {
    opts = opts || {};
    var max = 1;
    data.forEach(function (d) { max = Math.max(max, d.value || 0); });
    var cols = data.map(function (d) {
      var h = Math.max(4, Math.round((d.value / max) * 84));
      var cls = "bars__bar" + (d.me ? " bars__bar--me" : (opts.soft ? " bars__bar--soft" : ""));
      return '<div class="bars__col">' +
        '<div class="bars__val">' + (d.display != null ? d.display : d.value) + "</div>" +
        '<div class="' + cls + '" style="height:' + h + 'px"></div>' +
        '<div class="bars__x">' + util.esc(d.label) + "</div>" +
      "</div>";
    }).join("");
    return '<div class="bars">' + cols + "</div>";
  }

  function humanDate(dateStr) {
    if (!dateStr) return "—";
    var d = util.daysAgo(dateStr);
    if (d === 0) return "今天";
    if (d === 1) return "昨天";
    if (d === 2) return "前天";
    if (d > 0 && d < 30) return d + " 天前";
    return dateStr;
  }

  function noteBox(tone, ico, title, body) {
    return '<div class="note' + (tone ? " note--" + tone : "") + ' note--ico">' +
      '<span class="ico">' + ico + "</span>" +
      "<span>" + (title ? '<span class="note__t">' + util.esc(title) + "</span>" : "") + body + "</span></div>";
  }

  /* 问候语 */
  function greeting() {
    var h = new Date().getHours();
    if (h < 5) return "夜深了";
    if (h < 11) return "早上好";
    if (h < 14) return "中午好";
    if (h < 18) return "下午好";
    return "晚上好";
  }

  function weekName() {
    return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][new Date().getDay()];
  }

  Echo.ui = {
    TABS: TABS, mountNav: mountNav, icon: icon,
    applyTheme: applyTheme, currentTheme: currentTheme,
    toast: toast, modal: modal, confirm: confirmBox,
    statusBadge: statusBadge, ring: ring, meter: meter, empty: empty, bars: bars,
    humanDate: humanDate, noteBox: noteBox, greeting: greeting, weekName: weekName
  };
})();
