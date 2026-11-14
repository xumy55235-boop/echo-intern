/* ==========================================================================
   回音 · 空灵叠层视觉层（fx.js）
   纯 CSS 叠层 + 微交互，为手机端小程序 web-view 做性能护栏：
   - 动画只动 transform / opacity（GPU 合成层）
   - 光晕用超大径向渐变代替 filter: blur（大模糊在低端安卓会掉帧）
   - 3D 悬浮只在桌面指针设备启用（hover:none 的手机不会触发）
   - prefers-reduced-motion 时全部关闭动画
   ========================================================================== */
(function () {
  "use strict";

  var reduceMotion = false;
  try {
    reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {}

  function injectStyle() {
    var css = [
      "/* ---------- 空灵叠层（Aurora Layers） ---------- */",
      ".fx-aurora{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;}",
      ".fx-blob{position:absolute;border-radius:50%;opacity:.5;will-change:transform;}",
      ".fx-blob--1{width:min(72vw,420px);height:min(72vw,420px);left:-16vw;top:-14vh;",
      "background:radial-gradient(circle at 34% 32%,rgba(46,196,182,.34),rgba(46,196,182,.10) 42%,transparent 70%);",
      "animation:fxDrift1 68s ease-in-out infinite alternate;}",
      ".fx-blob--2{width:min(80vw,460px);height:min(80vw,460px);right:-24vw;top:12vh;",
      "background:radial-gradient(circle at 60% 40%,rgba(126,106,255,.30),rgba(126,106,255,.08) 44%,transparent 72%);",
      "animation:fxDrift2 84s ease-in-out infinite alternate;}",
      ".fx-blob--3{width:min(64vw,380px);height:min(64vw,380px);left:24vw;bottom:-22vh;",
      "background:radial-gradient(circle at 50% 50%,rgba(56,189,248,.22),rgba(56,189,248,.06) 46%,transparent 72%);",
      "animation:fxDrift3 76s ease-in-out infinite alternate;}",
      "@keyframes fxDrift1{from{transform:translate3d(0,0,0) scale(1);}to{transform:translate3d(9vw,7vh,0) scale(1.12);}}",
      "@keyframes fxDrift2{from{transform:translate3d(0,0,0) scale(1.06);}to{transform:translate3d(-8vw,-6vh,0) scale(.94);}}",
      "@keyframes fxDrift3{from{transform:translate3d(0,0,0) scale(.95);}to{transform:translate3d(-7vw,-5vh,0) scale(1.1);}}",
      /* 星点两层：渐变点阵，只做透明度呼吸 */
      ".fx-stars{position:absolute;inset:0;opacity:.8;animation:fxBreathe 9s ease-in-out infinite alternate;}",
      ".fx-stars--a{background-image:radial-gradient(1.3px 1.3px at 12% 22%,rgba(255,255,255,.5),transparent 55%),",
      "radial-gradient(1px 1px at 38% 64%,rgba(255,255,255,.38),transparent 55%),",
      "radial-gradient(1.6px 1.6px at 64% 14%,rgba(255,255,255,.42),transparent 55%),",
      "radial-gradient(1px 1px at 84% 46%,rgba(255,255,255,.34),transparent 55%),",
      "radial-gradient(1.2px 1.2px at 22% 86%,rgba(255,255,255,.3),transparent 55%),",
      "radial-gradient(1.5px 1.5px at 74% 82%,rgba(255,255,255,.36),transparent 55%);}",
      ".fx-stars--b{background-image:radial-gradient(1px 1px at 28% 38%,rgba(255,255,255,.32),transparent 55%),",
      "radial-gradient(1.4px 1.4px at 56% 78%,rgba(255,255,255,.3),transparent 55%),",
      "radial-gradient(1px 1px at 90% 24%,rgba(255,255,255,.4),transparent 55%),",
      "radial-gradient(1.2px 1.2px at 8% 58%,rgba(255,255,255,.28),transparent 55%),",
      "radial-gradient(1.5px 1.5px at 46% 8%,rgba(255,255,255,.4),transparent 55%);",
      "animation-delay:4.5s;}",
      "@keyframes fxBreathe{from{opacity:.45;}to{opacity:.95;}}",
      /* 内容浮在叠层之上 */
      ".fx-aurora + #nav,.fx-aurora ~ main,.fx-aurora ~ #foot{position:relative;z-index:1;}",
      "main.wrap,.fx-aurora ~ main{position:relative;z-index:1;}",
      "/* 卡片玻璃微光：内描边高光，不做模糊以保性能 */",
      ".fx-on .card,.fx-on .fold,.fx-on .statstrip{",
      "box-shadow:0 10px 30px rgba(4,14,18,.42),0 0 0 1px rgba(255,255,255,.055) inset,0 1px 0 rgba(255,255,255,.07) inset;}",
      ".fx-on .card--glass{background:linear-gradient(160deg,rgba(255,255,255,.075),rgba(255,255,255,.028));}",
      "/* hero 标题的层叠深度（多层细阴影模拟 3D 层） */",
      ".fx-depth{text-shadow:0 1px 0 rgba(126,106,255,.28),0 2px 0 rgba(126,106,255,.16),",
      "0 4px 10px rgba(126,106,255,.30),0 8px 26px rgba(46,196,182,.22);}",
      "/* 底部导航玻璃浮层增强 */",
      ".fx-on .tabbar{backdrop-filter:blur(18px) saturate(150%);-webkit-backdrop-filter:blur(18px) saturate(150%);",
      "box-shadow:0 -1px 0 rgba(255,255,255,.06),0 -12px 32px rgba(4,14,18,.34);}",
      "/* 入场动画（交错上浮） */",
      ".fx-on .fx{opacity:0;transform:translate3d(0,16px,0);transition:opacity .6s cubic-bezier(.22,.61,.36,1),transform .6s cubic-bezier(.22,.61,.36,1);}",
      ".fx-on .fx.fx-in{opacity:1;transform:none;}",
      "/* 桌面 3D 悬浮（仅指针设备） */",
      "@media (hover:hover) and (pointer:fine){",
      ".fx-tilt{transform-style:preserve-3d;will-change:transform;transition:transform .35s cubic-bezier(.22,.61,.36,1),box-shadow .35s cubic-bezier(.22,.61,.36,1);}",
      ".fx-tilt:hover{box-shadow:0 22px 46px rgba(4,14,18,.5),0 0 0 1px rgba(255,255,255,.09) inset,0 1px 0 rgba(255,255,255,.1) inset;}",
      "}",
      /* 低功耗模式：省电开关可全局降级（供小程序端配置） */
      ".fx-low .fx-blob,.fx-low .fx-stars{animation:none!important;}",
      "@media (prefers-reduced-motion: reduce){",
      ".fx-blob,.fx-stars,.fx{animation:none!important;transition:none!important;opacity:1!important;transform:none!important;}",
      "}"
    ].join("\n");

    var s = document.createElement("style");
    s.id = "fxStyle";
    s.textContent = css;
    document.head.appendChild(s);
  }

  function mountLayers() {
    var layer = document.createElement("div");
    layer.className = "fx-aurora";
    layer.setAttribute("aria-hidden", "true");
    layer.innerHTML =
      '<div class="fx-blob fx-blob--1"></div>' +
      '<div class="fx-blob fx-blob--2"></div>' +
      '<div class="fx-blob fx-blob--3"></div>' +
      '<div class="fx-stars fx-stars--a"></div>' +
      '<div class="fx-stars fx-stars--b"></div>';
    document.body.insertBefore(layer, document.body.firstChild);

    // 内容锚点：让 main 浮在叠层之上
    var main = document.querySelector("main.wrap") || document.querySelector("main");
    if (main && getComputedStyle(main).position === "static") {
      main.style.position = "relative";
      main.style.zIndex = "1";
    }
  }

  function applyDepth() {
    var titles = document.querySelectorAll(".ph__title, h1.ph__title");
    titles.forEach(function (t) { t.classList.add("fx-depth"); });
  }

  /* 入场动画 */
  function revealOnScroll() {
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll(".card,.statstrip,.fold,.ph").forEach(function (el) {
        el.classList.add("fx-in");
      });
      return;
    }
    var targets = document.querySelectorAll(".card,.statstrip,.fold");
    targets.forEach(function (el, i) {
      el.classList.add("fx");
      el.style.transitionDelay = Math.min(i * 55, 260) + "ms";
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("fx-in");
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.06, rootMargin: "0px 0px -4% 0px" });
    targets.forEach(function (el) { io.observe(el); });
  }

  /* 桌面 3D 倾斜 */
  function enableTilt() {
    var fine = false;
    try { fine = window.matchMedia("(hover:hover) and (pointer:fine)").matches; } catch (e) {}
    if (!fine || reduceMotion) return;

    var cards = document.querySelectorAll(".card");
    cards.forEach(function (card) {
      card.classList.add("fx-tilt");
      card.addEventListener("mousemove", function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform =
          "perspective(900px) rotateX(" + (-py * 3.2).toFixed(2) + "deg) rotateY(" + (px * 3.2).toFixed(2) + "deg) translateY(-2px)";
      });
      card.addEventListener("mouseleave", function () { card.style.transform = ""; });
    });
  }

  function boot() {
    injectStyle();
    mountLayers();
    applyDepth();
    document.documentElement.classList.add("fx-on");
    if (!reduceMotion) {
      revealOnScroll();
      enableTilt();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
