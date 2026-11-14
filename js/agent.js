/* ==========================================================================
   回音 · 回音助手（Echo Agent）
   悬浮小机器人 + 可对话面板；本地规则引擎，无需联网、不依赖任何外部 API。
   数据来源：Echo.store（本机 localStorage），回答全部基于使用者自己的投递数据。
   ========================================================================== */
(function () {
  "use strict";
  if (!window.Echo || !Echo.store) return;

  var KEY = "echo.agent.log";
  var log = [];            // [{role:'bot'|'me', html:'...'}]
  var opened = false;
  var busy = false;

  /* ---------------- 基础工具 ---------------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmt(s) {
    return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
  }
  function saveLog() {
    try { sessionStorage.setItem(KEY, JSON.stringify(log.slice(-40))); } catch (e) {}
  }
  function loadLog() {
    try {
      var raw = sessionStorage.getItem(KEY);
      if (raw) log = JSON.parse(raw) || [];
    } catch (e) { log = []; }
  }

  function data() {
    var st = {}, rem = [], sp = { items: [] }, pf = {};
    try { st = Echo.store.stats(); } catch (e) {}
    try { rem = Echo.store.reminders(); } catch (e) {}
    try { sp = Echo.store.sprint(); } catch (e) {}
    try { pf = Echo.store.profile(); } catch (e) {}
    var apps = [];
    try { apps = Echo.store.applications(); } catch (e) {}
    return { st: st, rem: rem, sp: sp, pf: pf, apps: apps };
  }

  /* ---------------- 规则引擎 ---------------- */
  var RULES = [];

  function rule(name, words, build) {
    RULES.push({ name: name, words: words, build: build });
  }

  /* 1. 寒暄 / 自我介绍 */
  rule("hello", ["你好", "您好", "嗨", "在吗", "你是谁", "介绍", "什么用", "能干嘛", "会什么", "机器人"], function () {
    return {
      html: "我是**小回**，回音的陪跑助手。你可以直接问我：\n" +
        "· 我的投递情况怎么样\n" +
        "· 今天该做什么\n" +
        "· 哪几家该跟进了\n" +
        "· 这段话术靠谱吗（把招聘描述粘给我）\n" +
        "我不联网，只用你本机记录的数据回答，也不会替你做决定——只帮你把下一步看清楚。",
      chips: ["我的投递情况", "今天该做什么", "哪几家该跟进", "这段话术靠谱吗"]
    };
  });

  /* 2. 数据概览 */
  rule("overview", ["数据", "情况", "概览", "怎么样", "进度", "统计", "多少", "投了几", "回音了几", "成绩", "表现"], function () {
    var d = data(), st = d.st;
    if (!st.total) {
      return {
        html: "你的台账现在还是空的，所以我还看不出什么。\n先去**投递台账**记一笔吧，哪怕只有一家——有了第一条，后面的进度、回音率、跟进提醒才会跑起来。\n如果你想先看看成品长什么样，可以在「我的 → 演示数据」里一键填充。",
        chips: ["怎么用这个工具", "投什么岗位好"],
        actions: [{ label: "去记一笔", href: "tracker.html" }, { label: "看演示数据", href: "profile.html" }]
      };
    }
    var gap = st.weekGoal - st.thisWeek;
    var verdict = st.replyRate >= 20
      ? "回音率处在正常偏上的区间，说明简历和岗位的匹配方向没跑偏。"
      : st.replyRate >= 10
        ? "回音率偏低但在常见范围内，更像是投递量或匹配度的问题，不是「你不行」。"
        : "回音率明显偏低，先别急着否定自己——通常是岗位选得太宽、或简历关键词没对上 JD。";
    return {
      html: "按你登记的 **" + st.total + "** 条投递：\n" +
        "· 已产生回音 **" + st.replied + "** 家，回音率 **" + st.replyRate + "%**\n" +
        "· 本周投了 **" + st.thisWeek + "** 家，周目标 " + st.weekGoal + " 家" + (gap > 0 ? "，还差 **" + gap + "** 家" : "，已经达成了") + "\n" +
        "· 正在等消息的有 **" + st.waiting + "** 家" + (st.avgReply != null ? "，平均首响 **" + st.avgReply + "** 天" : "") + "\n\n" +
        "**我的判断**：" + verdict,
      chips: ["哪几家该跟进", "今天该做什么", "回音率多少算正常"],
      actions: [{ label: "打开台账", href: "tracker.html" }, { label: "看同伴数据", href: "wall.html" }]
    };
  });

  /* 3. 今天做什么 */
  rule("today", ["今天", "做什么", "任务", "清单", "待办", "安排", "计划", "三件事"], function () {
    var d = data(), todo = (d.sp.items || []).filter(function (t) { return !t.done; });
    var doneN = (d.sp.items || []).filter(function (t) { return t.done; }).length;
    var out = "";
    if (!todo.length && !doneN) {
      out = "本周清单还是空的。要不要现在定三件小事？比如：\n1. 挑 2 家匹配度高的岗位投出去\n2. 把简历里的项目改成「动词＋结果＋数字」\n3. 给上周投的两家发一封跟进";
    } else {
      out = "本周清单完成 **" + doneN + "** 项，还剩 **" + todo.length + "** 项：\n";
      todo.slice(0, 4).forEach(function (t, i) { out += (i + 1) + ". " + t.text + "\n"; });
      if (todo.length) out += "\n建议从**最不费劲的那件**开始——先动起来比先想清楚重要。";
      else out += "\n清单已经清空了，今天可以只做一件让自己舒服的事。";
    }
    if (d.rem.length) out += "\n\n另外，有 **" + d.rem.length + "** 家投递到了该跟进的时间，别忘了。";
    return {
      html: out,
      chips: ["哪几家该跟进", "我的投递情况", "简历怎么改"],
      actions: [{ label: "去每周陪跑", href: "sprint.html" }]
    };
  });

  /* 4. 跟进提醒 */
  rule("follow", ["跟进", "催", "要不要问", "多久", "没动静", "等消息", "催一下", "发消息"], function () {
    var d = data(), rem = d.rem;
    if (!rem.length) {
      return {
        html: "目前没有到期该跟进的投递。\n一般节奏是：投出后 **7 天**没有回音，可以发一封简短的跟进；**14 天**还没有动静，就当作「无回音」归档，把精力挪到新岗位上——这不代表你被否定，只是招聘方没预算回每封信。",
        chips: ["今天该做什么", "怎么提高回音率"]
      };
    }
    var out = "有 **" + rem.length + "** 家到了跟进节点：\n";
    rem.slice(0, 4).forEach(function (r) {
      out += "· **" + r.company + "**（" + r.position + "）已 " + r.idle + " 天，建议" + (r.level === "high" ? "直接跟进或归档" : "发一封短跟进") + "\n";
    });
    out += "\n跟进别写小作文，三句话就够：我是谁、投的哪个岗、补充一条最近的新进展（新做的项目 / 新学的技能），然后一句「如需补充材料我随时可以发」。";
    return {
      html: out,
      chips: ["帮我写跟进要点", "今天该做什么", "我的投递情况"],
      actions: [{ label: "去台账处理", href: "tracker.html" }]
    };
  });

  /* 5. 回音率是否正常 */
  rule("replyrate", ["回音率", "正常", "算高", "算低", "多少算", "几成", "回复率"], function () {
    var d = data(), st = d.st;
    var head = st.total
      ? "你现在是 **" + st.replyRate + "%**（" + st.total + " 投 / " + st.replied + " 回）。\n\n"
      : "";
    return {
      html: head +
        "**参考区间**：实习投递的回音率普遍不高，10%–30% 都算常见，第一次找实习的同学大多落在偏低一端。\n\n" +
        "**判断方法**：\n" +
        "1. 低于 10%：先看岗位匹配——JD 里的硬技能词，简历里有没有原样出现；\n" +
        "2. 10%–30%：属于正常波动，重点是把**投递量**和**跟进节奏**稳住；\n" +
        "3. 高于 30%：简历没问题，接下来该练面试。\n\n" +
        "**一句话**：回音率是「简历 × 岗位」的匹配结果，不是对你的评价。",
      chips: ["怎么提高回音率", "简历怎么改", "看同伴数据"],
      actions: [{ label: "看同伴进度墙", href: "wall.html" }]
    };
  });

  /* 6. 提高回音率 */
  rule("improve", ["提高", "提升", "改进", "怎么改", "优化", "没回音怎么办"], function () {
    return {
      html: "按性价比排序，先做前两条就够：\n" +
        "1. **换岗位而不是换简历**：同一份简历，投匹配度 80% 的岗比投 40% 的岗，回音率能差一倍；\n" +
        "2. **让关键词对上 JD**：JD 写「SQL、A/B 测试」，简历里就要出现这两个词，机器筛简历只看这个；\n" +
        "3. **收窄投递范围**：3 个方向以内，每个方向一版简历，别用同一份投所有岗；\n" +
        "4. **控制节奏**：每周 5 家、持续 4 周，比一天海投 20 家有效得多。\n\n" +
        "想更具体的话，把 JD 和简历粘到「简历诊断」，它会告诉你缺哪几项。",
      chips: ["简历怎么改", "投什么岗位好", "回音率多少算正常"],
      actions: [{ label: "去简历诊断", href: "diagnose.html" }]
    };
  });

  /* 7. 简历 */
  rule("resume", ["简历", "诊断", "评分", "修改简历", "写得不好"], function () {
    return {
      html: "简历这件事，三个最常见的坑：\n" +
        "1. **只写做了什么，不写结果**：「负责社群运营」→「3 个月把社群从 200 人做到 1200 人，周活跃 35%」；\n" +
        "2. **技能栏写成形容词**：「熟悉数据分析」不如「能用 SQL 取数、Python 做清洗」；\n" +
        "3. **一份简历投所有岗**：匹配度低于 60% 的岗，改简历比投出去更省时间。\n\n" +
        "把目标 JD 和简历贴到「简历诊断」，会按匹配度、技能覆盖、硬门槛、表达结构四个维度打分，缺口项能一键加进本周清单。",
      chips: ["怎么提高回音率", "投什么岗位好"],
      actions: [{ label: "去做简历诊断", href: "diagnose.html" }]
    };
  });

  /* 8. 岗位方向 */
  rule("jobs", ["投什么", "岗位", "方向", "选什么", "适合", "渠道", "在哪投"], function () {
    var d = data(), pf = d.pf, ch = d.st.channels || {};
    var top = Object.keys(ch).sort(function (a, b) { return ch[b] - ch[a]; })[0];
    var out = "";
    if (pf.targetRole) out += "你的目标写的是「**" + pf.targetRole + "**」。\n";
    if (top) out += "目前用得最多的渠道是「**" + top + "**」（" + ch[top] + " 条）。\n\n";
    else out += "\n";
    out += "选岗的一个简单办法：把 JD 拆成「硬门槛 / 技能 / 加分项」三列，硬门槛不满足的直接跳过，技能对上 60% 以上就可以投，加分项用来排序。\n" +
      "另外，同一家公司不要同时投三个岗，HR 后台看得到。";
    return {
      html: out,
      chips: ["怎么提高回音率", "简历怎么改", "看同伴数据"],
      actions: [{ label: "改我的目标岗位", href: "profile.html" }]
    };
  });

  /* 9. 防坑 / 话术检测 */
  rule("scam", ["靠谱", "骗", "收费", "押金", "培训", "刷单", "贷款", "中介", "套路", "真假", "检测", "风险"], function (q) {
    var hits = scan(q);
    if (hits.length) {
      var out = "这段描述里我看到了 **" + hits.length + "** 处风险信号：\n";
      hits.forEach(function (h) { out += "· 【" + h.level + "】**" + h.tag + "**：" + h.why + "\n"; });
      out += "\n**建议**：先不要交任何费用、不要签任何分期协议、不要脱离平台转到私人微信谈钱。正规实习不会向学生收钱。";
      return {
        html: out,
        chips: ["还有哪些常见套路", "今天该做什么"],
        actions: [{ label: "去防坑雷达细看", href: "radar.html" }]
      };
    }
    return {
      html: "常见的坑有这几类，看到就直接退出：\n" +
        "1. **任何收费**：押金、体检费、服装费、工牌费；\n" +
        "2. **培训贷**：先培训后上岗、分期付款、包就业；\n" +
        "3. **刷单垫付**：先垫钱再返现；\n" +
        "4. **包 Offer**：内推费、保录名额；\n" +
        "5. **脱离平台**：一上来就让你加私人微信、扫码进群。\n\n" +
        "把整段招聘描述或聊天记录粘给我，我帮你逐条对一遍。",
      chips: ["这段话术靠谱吗", "还有哪些常见套路"],
      actions: [{ label: "打开防坑雷达", href: "radar.html" }]
    };
  });

  /* 10. 情绪支持 */
  rule("emotion", ["焦虑", "难受", "崩溃", "烦", "压力", "自我怀疑", "是不是我不行", "不适合", "失望", "想放弃", "睡不着", "害怕", "很差"], function () {
    var d = data(), st = d.st;
    var line = st.total
      ? "你一共投了 " + st.total + " 家，有 " + st.waiting + " 家还在等消息——" +
        (st.replied ? "已经有 " + st.replied + " 家给过回应了，" : "") +
        "剩下那些没有回音的，绝大多数是因为岗位早就招满或者根本没在看，不是对你个人的否定。"
      : "还没开始投的时候焦虑，其实是最难受的——因为脑子里全是想象出来的失败。";
    return {
      html: "这种状态我理解，找工作最难的不是被拒，是一直没有消息的那种悬着。\n\n" + line +
        "\n\n今天可以先只做一件很小的、能立刻完成的事：改一条简历描述、投一家最想去的岗、或者给已经投过的一家发封跟进。\n" +
        "**完成一件小的，比想清楚全部更有用。**",
      chips: ["看同伴数据", "今天该做什么", "我的投递情况"],
      actions: [{ label: "看看同伴进度墙", href: "wall.html" }, { label: "记一次情绪打卡", href: "wall.html" }]
    };
  });

  /* 11. 工具怎么用 / 项目介绍 */
  rule("howto", ["怎么用", "功能", "这个工具", "这个网站", "项目", "回音是什么", "有什么用"], function () {
    return {
      html: "回音是一个「投递陪跑」的小工具，一共六块：\n" +
        "· **今日总览**：今天该做什么，一眼看到；\n" +
        "· **投递台账**：投了哪些、到哪一步、该不该跟进；\n" +
        "· **简历诊断**：JD 和简历对一遍，缺什么一目了然；\n" +
        "· **防坑雷达**：识别收费、培训贷这类套路；\n" +
        "· **每周陪跑**：把大目标拆成能勾掉的小事；\n" +
        "· **同伴进度墙**：看看同年级的人是什么水平，校准预期。\n\n" +
        "我就在右下角，随时可以问我数据、跟进、简历、防坑，或者只是想找人说两句。",
      chips: ["我的投递情况", "今天该做什么", "简历怎么改"],
      actions: [{ label: "先看今日总览", href: "index.html" }]
    };
  });

  /* 12. 隐私 */
  rule("privacy", ["隐私", "数据", "上传", "安全", "会不会泄露", "存在哪", "联网"], function () {
    return {
      html: "两点说明：\n" +
        "1. 你的投递记录、简历文本、情绪打卡**只存在这台设备的浏览器里**，不上传服务器，也不经过任何第三方；\n" +
        "2. 我不联网，回答是靠本地规则加上你台账里的数据算出来的，所以偶尔会显得笨一点——但你写的任何内容都不会离开这台电脑。\n\n" +
        "想备份可以在「我的」里导出 JSON，换设备再导入。",
      chips: ["怎么用这个工具", "我的投递情况"],
      actions: [{ label: "去我的 · 数据管理", href: "profile.html" }]
    };
  });

  /* 13. 面试行动清单（吸收牛客 AI 模拟面试、Apply4Me「提醒→行动清单」） */
  rule("interview", ["面试", "面经", "怎么答", "自我介绍", "紧张", "模拟", "准备面试", "面试题"], function () {
    var d = data(), list = (d.apps || []).filter(function (a) {
      return a.status === "interview" || a.status === "final";
    });
    var out = "";
    if (list.length) {
      out = "你目前在推进的面试有 **" + list.length + "** 场：\n";
      list.slice(0, 3).forEach(function (a) {
        out += "· **" + a.company + "**（" + a.position + "）" + (a.interviewAt ? "，时间 " + a.interviewAt : "") +
          " → 重点练「项目深挖」那一组\n";
      });
      out += "\n";
    }
    out += "面试前 2 天，把这 **12 题**过一遍就够：\n\n" +
      "**A. 必答题（4）**\n" +
      "1. 60 秒自我介绍：专业年级 → 一个和岗位强相关的项目 → 为什么投这家\n" +
      "2. 为什么选这个岗位：把 JD 里的关键词说回来，别只说「感兴趣」\n" +
      "3. 你的优缺点：缺点要带「正在改」的证据\n" +
      "4. 职业规划：1–3 年版本即可，别编十年大计\n\n" +
      "**B. 项目深挖（4）——用 STAR 答**\n" +
      "5. 这个项目你具体负责什么（S/T）\n" +
      "6. 最难的一次问题怎么解决的（A）\n" +
      "7. 结果是什么数字（R，没有数字就补一个可量化的）\n" +
      "8. 重来一次你会怎么做得更好（反思题，必考）\n\n" +
      "**C. 场景行为题（4）**\n" +
      "9. 团队意见冲突，你怎么办\n" +
      "10. 多任务赶工，你怎么排优先级\n" +
      "11. 被批评 / 做错了，你什么反应\n" +
      "12. 为什么我们该选你（一句话版：技能＋结果＋意愿）\n\n" +
      "最后准备 **2 个反问**：这个岗位半年内最重要的一件事是什么；团队里做得最好的人有什么共同点。\n" +
      "把「我要表现好」换成「我要问清楚这份工作是什么」，会松很多。";
    return {
      html: out,
      chips: ["简历怎么改", "今天该做什么", "Offer 怎么对比"],
      actions: [{ label: "打开台账看面试", href: "tracker.html" }]
    };
  });

  /* 14. Offer 对比（吸收 JobFlo 的 Offer 并排比较） */
  rule("offer", ["offer", "Offer", "对比", "选哪家", "两个offer", "怎么选", "哪家好", "薪资", "纠结"], function () {
    var d = data(), offs = (d.apps || []).filter(function (a) {
      return /offer|录取|通过/i.test(a.status || "");
    });
    var out = "";
    if (offs.length) {
      out = "台账里已有 **" + offs.length + "** 条通过/Offer 记录：\n";
      offs.slice(0, 3).forEach(function (a) { out += "· " + a.company + "（" + a.position + "）\n"; });
      out += "\n";
    }
    out += "别只看月薪，按这 **5 维各打 1–5 分**再比：\n\n" +
      "1. **钱**：总包（月薪×月数＋奖金），再除以每周实际工时算时薪\n" +
      "2. **成长**：有没有人带、业务是不是核心、平台背书\n" +
      "3. **城市**：到手薪资减房租和生活成本，再比\n" +
      "4. **团队**：面试时对方聊得细不细，往往预示入职后的耐心\n" +
      "5. **风险**：试用期规则、违约金、实习转正的口头承诺要落到纸面\n\n" +
      "给每条 Offer 各做一张小表，**总分相近时选成长分最高的**——第一份实习的工资差距，几个月就会被成长速度抹平。";
    return {
      html: out,
      chips: ["面试怎么准备", "简历怎么改", "这段话术靠谱吗"],
      actions: [{ label: "去台账记录 Offer", href: "tracker.html" }]
    };
  });

  /* 15. 兜底 */
  function fallback(q) {
    return {
      html: "这个问题我暂时答不好——我是按固定规则回答的本地小助手，不是通用大模型。\n" +
        "不过下面这些我都能答：投递进度、回音率、今天做什么、该跟进哪几家、简历怎么改、面试 12 题清单、Offer 对比、话术是否靠谱。\n" +
        "如果是招聘描述，直接把文本粘给我就行。",
      chips: ["我的投递情况", "今天该做什么", "这段话术靠谱吗", "回音率多少算正常"]
    };
  }

  /* ---------------- 风险扫描 ---------------- */
  function scan(text) {
    var t = String(text || "");
    var dict = [
      { tag: "收费类", level: "高危", k: ["押金", "保证金", "服装费", "工牌费", "体检费", "培训费", "交费", "收费", "报名费"], why: "正规实习不向学生收取任何费用" },
      { tag: "培训贷", level: "高危", k: ["培训贷", "分期", "贷款", "先培训", "包就业", "学费"], why: "「先培训后上岗＋分期」是典型培训贷结构" },
      { tag: "刷单垫付", level: "高危", k: ["刷单", "垫付", "返现", "做任务返"], why: "任何要求先垫钱再返现的兼职都是骗局" },
      { tag: "包过承诺", level: "高危", k: ["包offer", "包Offer", "保录", "内推费", "付费内推", "保过"], why: "付费保 Offer 属于违规承诺，几乎都是收割" },
      { tag: "脱离平台", level: "中危", k: ["加微信", "私人微信", "扫码进群", "加qq", "加QQ", "私聊转账"], why: "正规流程在招聘平台内完成，转到私域谈钱要警惕" },
      { tag: "门槛异常", level: "中危", k: ["不限学历", "无需经验", "日结", "急招", "高薪轻松", "月入过万"], why: "门槛极低却承诺高回报，通常与实际不符" }
    ];
    var out = [];
    dict.forEach(function (d) {
      var hit = d.k.filter(function (k) { return t.indexOf(k) >= 0; });
      if (hit.length) out.push({ tag: d.tag, level: d.level, why: d.why + "（命中：" + hit.join("、") + "）" });
    });
    return out;
  }

  /* ---------------- 匹配 ---------------- */
  function answer(q) {
    var best = null, bestScore = 0;
    RULES.forEach(function (r) {
      var score = 0;
      r.words.forEach(function (w) { if (q.indexOf(w) >= 0) score += w.length >= 3 ? 2 : 1; });
      if (score > bestScore) { bestScore = score; best = r; }
    });
    if (q.length >= 18 && scan(q).length) {
      var hit = RULES.filter(function (r) { return r.name === "scam"; })[0];
      if (hit) return hit.build(q);
    }
    if (best && bestScore > 0) return best.build(q);
    return fallback(q);
  }

  /* ---------------- 视图 ---------------- */
  var el = {};

  function msgOf(role, html) {
    if (role === "me") {
      return '<div class="msg msg--me"><div class="msg__b">' + fmt(html) + "</div></div>";
    }
    return '<div class="msg msg--bot"><div class="msg__ava">' + FACE_SMALL + "</div>" +
      '<div class="msg__b">' + fmt(html) + "</div></div>";
  }

  function pushMsg(role, html) {
    log.push({ role: role, html: html });
    saveLog();
    var wrap = document.createElement("div");
    wrap.innerHTML = msgOf(role, html);
    el.body.appendChild(wrap.firstChild);
    el.body.scrollTop = el.body.scrollHeight;
  }

  function showTyping() {
    var t = document.createElement("div");
    t.className = "msg msg--bot";
    t.id = "echoTyping";
    t.innerHTML = '<div class="msg__ava">' + FACE_SMALL + '</div><div class="msg__b msg__b--typing"><i></i><i></i><i></i></div>';
    el.body.appendChild(t);
    el.body.scrollTop = el.body.scrollHeight;
  }
  function hideTyping() {
    var t = document.getElementById("echoTyping");
    if (t) t.remove();
  }

  function renderChips(chips, actions) {
    el.chips.innerHTML = "";
    (chips || []).forEach(function (c) {
      var b = document.createElement("button");
      b.className = "achip";
      b.type = "button";
      b.textContent = c;
      b.onclick = function () { send(c); };
      el.chips.appendChild(b);
    });
    (actions || []).forEach(function (a) {
      var link = document.createElement("a");
      link.className = "achip achip--go";
      link.href = a.href;
      link.textContent = a.label + " →";
      el.chips.appendChild(link);
    });
  }

  function reply(q) {
    var r = answer(q);
    pushMsg("bot", r.html);
    renderChips(r.chips, r.actions);
  }

  function send(text) {
    var q = String(text || "").trim();
    if (!q || busy) return;
    pushMsg("me", q);
    el.input.value = "";
    el.chips.innerHTML = "";
    busy = true;
    showTyping();
    setTimeout(function () {
      hideTyping();
      busy = false;
      reply(q);
    }, 380 + Math.min(700, q.length * 18));
  }

  /* 机器人头像（内联 SVG） */
  var FACE_SMALL = '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="4.4" r="1.9" fill="currentColor"/>' +
    '<path d="M16 6.4V9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
    '<rect x="6" y="9" width="20" height="16" rx="6.4" fill="currentColor"/>' +
    '<circle cx="12.2" cy="16" r="2" fill="#0A0E13"/><circle cx="19.8" cy="16" r="2" fill="#0A0E13"/>' +
    '<path d="M13 21c1.4 1.2 4.6 1.2 6 0" stroke="#0A0E13" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>';

  var BOT_ICON = '<svg class="echo-bot__svg" viewBox="0 0 48 48" aria-hidden="true">' +
    '<circle class="echo-bot__led" cx="24" cy="5.6" r="2.6" fill="currentColor"/>' +
    '<path d="M24 8.4V13" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>' +
    '<rect x="8.5" y="13" width="31" height="24" rx="9.5" fill="currentColor"/>' +
    '<g class="echo-bot__eyes"><circle cx="18.6" cy="24" r="3.2" fill="var(--bg)"/><circle cx="29.4" cy="24" r="3.2" fill="var(--bg)"/></g>' +
    '<path d="M19.6 30.4c1.8 1.7 7 1.7 8.8 0" stroke="var(--bg)" stroke-width="2" stroke-linecap="round" fill="none"/>' +
    "</svg>";

  function injectCss() {
    var css = [
      "/* ---------- 回音助手（Echo Agent） ---------- */",
      ".echo-bot{position:fixed;right:16px;bottom:calc(var(--tab-h) + 18px);z-index:120;width:58px;height:58px;border:0;border-radius:50%;",
      "background:linear-gradient(150deg,var(--accent),var(--accent-2));color:rgba(8,18,20,.86);cursor:pointer;padding:0;",
      "display:grid;place-items:center;box-shadow:0 12px 28px rgba(0,0,0,.38),0 0 0 1px rgba(255,255,255,.12) inset;",
      "transition:transform .24s var(--ease),box-shadow .24s var(--ease);}",
      ".echo-bot:hover{transform:translateY(-3px) scale(1.03);}",
      ".echo-bot:active{transform:scale(.97);}",
      ".echo-bot__svg{width:34px;height:34px;filter:drop-shadow(0 1px 0 rgba(255,255,255,.25));}",
      ".echo-bot__eyes{transform-origin:24px 24px;animation:echoBlink 4.6s infinite;}",
      "@keyframes echoBlink{0%,92%,100%{transform:scaleY(1);}95%{transform:scaleY(.08);}}",
      ".echo-bot__led{animation:echoLed 2.4s ease-in-out infinite;}",
      "@keyframes echoLed{0%,100%{opacity:1;}50%{opacity:.35;}}",
      ".echo-bot__pulse{position:absolute;inset:-6px;border-radius:50%;border:1px solid var(--accent-line);animation:echoPulse 2.8s ease-out infinite;pointer-events:none;}",
      "@keyframes echoPulse{0%{transform:scale(.86);opacity:.9;}70%{transform:scale(1.22);opacity:0;}100%{opacity:0;}}",
      ".echo-bot__tag{position:absolute;right:66px;bottom:6px;white-space:nowrap;background:var(--bg-2);border:1px solid var(--line);",
      "color:var(--text-2);font-size:12px;padding:6px 10px;border-radius:var(--r-pill);box-shadow:var(--sh-1);",
      "opacity:0;transform:translateX(6px);transition:opacity .3s var(--ease),transform .3s var(--ease);pointer-events:none;}",
      ".echo-bot__tag.is-on{opacity:1;transform:none;}",
      ".echo-bot__dot{position:absolute;top:2px;right:2px;width:11px;height:11px;border-radius:50%;background:var(--danger);",
      "border:2px solid var(--bg);display:none;}",
      ".echo-bot.is-new .echo-bot__dot{display:block;}",
      /* 面板 */
      ".echo-card{position:fixed;right:16px;bottom:calc(var(--tab-h) + 86px);z-index:121;width:min(356px,calc(100vw - 32px));",
      "max-height:min(490px,64vh);display:flex;flex-direction:column;background:var(--bg-2);border:1px solid var(--line);",
      "border-radius:20px;box-shadow:var(--sh-3);overflow:hidden;transform-origin:100% 100%;",
      "opacity:0;transform:translateY(10px) scale(.96);pointer-events:none;transition:opacity .22s var(--ease),transform .22s var(--ease);}",
      ".echo-card.is-open{opacity:1;transform:none;pointer-events:auto;}",
      ".echo-card__head{display:flex;align-items:center;gap:9px;padding:12px 14px;border-bottom:1px solid var(--line-2);",
      "background:linear-gradient(180deg,var(--accent-soft),transparent);}",
      ".echo-card__ava{width:32px;height:32px;border-radius:11px;display:grid;place-items:center;flex:none;",
      "background:var(--accent-soft);color:var(--accent);border:1px solid var(--accent-line);}",
      ".echo-card__ava svg{width:20px;height:20px;}",
      ".echo-card__name{font-size:13.5px;font-weight:750;letter-spacing:-.01em;}",
      ".echo-card__sub{font-size:10.5px;color:var(--muted);display:flex;align-items:center;gap:5px;margin-top:2px;}",
      ".echo-card__sub i{width:5px;height:5px;border-radius:50%;background:var(--success);display:inline-block;}",
      ".echo-card__x{margin-left:auto;width:28px;height:28px;border-radius:9px;border:1px solid var(--line);background:var(--glass-2);",
      "color:var(--text-2);cursor:pointer;display:grid;place-items:center;font-size:14px;line-height:1;}",
      ".echo-card__body{flex:1;overflow-y:auto;padding:12px 12px 6px;display:flex;flex-direction:column;gap:9px;",
      "-webkit-overflow-scrolling:touch;scroll-behavior:smooth;}",
      ".msg{display:flex;gap:7px;align-items:flex-start;max-width:100%;animation:msgIn .22s var(--ease);}",
      "@keyframes msgIn{from{opacity:0;transform:translateY(5px);}to{opacity:1;transform:none;}}",
      ".msg--me{justify-content:flex-end;}",
      ".msg__ava{width:24px;height:24px;flex:none;border-radius:8px;background:var(--accent-soft);color:var(--accent);",
      "display:grid;place-items:center;}",
      ".msg__ava svg{width:16px;height:16px;}",
      ".msg__b{font-size:12.4px;line-height:1.62;padding:9px 11px;border-radius:13px;max-width:calc(100% - 32px);",
      "background:var(--glass-2);border:1px solid var(--line-2);color:var(--text);word-break:break-word;}",
      ".msg__b b{color:var(--accent);font-weight:700;}",
      ".msg--me .msg__b{background:var(--accent-soft);border-color:var(--accent-line);border-bottom-right-radius:5px;}",
      ".msg--bot .msg__b{border-bottom-left-radius:5px;}",
      ".msg__b--typing{display:flex;gap:4px;align-items:center;padding:12px 13px;}",
      ".msg__b--typing i{width:5px;height:5px;border-radius:50%;background:var(--muted);animation:typeDot 1.1s infinite;}",
      ".msg__b--typing i:nth-child(2){animation-delay:.16s;}.msg__b--typing i:nth-child(3){animation-delay:.32s;}",
      "@keyframes typeDot{0%,60%,100%{opacity:.28;transform:translateY(0);}30%{opacity:1;transform:translateY(-2px);}}",
      /* 快捷问题 */
      ".echo-card__chips{display:flex;gap:6px;flex-wrap:wrap;padding:6px 12px 8px;max-height:96px;overflow-y:auto;}",
      ".achip{font:inherit;font-size:11.5px;padding:6px 10px;border-radius:var(--r-pill);border:1px solid var(--line);",
      "background:var(--glass-2);color:var(--text-2);cursor:pointer;white-space:nowrap;transition:.18s var(--ease);text-decoration:none;}",
      ".achip:hover{color:var(--accent);border-color:var(--accent-line);background:var(--accent-soft);text-decoration:none;}",
      ".achip--go{color:var(--accent);border-color:var(--accent-line);}",
      /* 输入 */
      ".echo-card__input{display:flex;gap:7px;padding:9px 11px;border-top:1px solid var(--line-2);background:var(--bg-2);}",
      ".echo-card__input input{flex:1;min-width:0;font:inherit;font-size:12.4px;padding:9px 11px;border-radius:11px;",
      "border:1px solid var(--line);background:var(--glass-2);color:var(--text);outline:none;}",
      ".echo-card__input input::placeholder{color:var(--muted);}",
      ".echo-card__input input:focus{border-color:var(--accent-line);}",
      ".echo-card__send{flex:none;width:38px;height:38px;border-radius:11px;border:0;cursor:pointer;display:grid;place-items:center;",
      "background:linear-gradient(150deg,var(--accent),var(--accent-2));color:#08161A;}",
      ".echo-card__send svg{width:17px;height:17px;}",
      "@media (min-width:640px){.echo-bot{right:calc(50vw - 280px + 16px);}.echo-card{right:calc(50vw - 280px + 16px);}}",
      "@media (max-height:640px){.echo-card{max-height:70vh;}}"
    ].join("\n");
    var s = document.createElement("style");
    s.id = "echoAgentStyle";
    s.textContent = css;
    document.head.appendChild(s);
  }

  function mount() {
    injectCss();

    var bot = document.createElement("button");
    bot.className = "echo-bot is-new";
    bot.type = "button";
    bot.setAttribute("aria-label", "打开回音助手");
    bot.innerHTML = '<span class="echo-bot__pulse"></span>' + BOT_ICON +
      '<span class="echo-bot__dot"></span><span class="echo-bot__tag">有问题问我</span>';
    document.body.appendChild(bot);

    var card = document.createElement("div");
    card.className = "echo-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", "回音助手对话");
    card.innerHTML =
      '<div class="echo-card__head">' +
        '<div class="echo-card__ava">' + FACE_SMALL + "</div>" +
        '<div><div class="echo-card__name">小回 · 回音助手</div>' +
        '<div class="echo-card__sub"><i></i>在线 · 只读取本机数据</div></div>' +
        '<button class="echo-card__x" type="button" aria-label="收起">✕</button>' +
      "</div>" +
      '<div class="echo-card__body"></div>' +
      '<div class="echo-card__chips"></div>' +
      '<div class="echo-card__input">' +
        '<input type="text" maxlength="600" placeholder="问我：回音率正常吗 / 今天做什么" aria-label="输入问题">' +
        '<button class="echo-card__send" type="button" aria-label="发送">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12h13M12 5.5l6.5 6.5-6.5 6.5"/></svg>' +
        "</button>" +
      "</div>";
    document.body.appendChild(card);

    el.bot = bot;
    el.card = card;
    el.body = card.querySelector(".echo-card__body");
    el.chips = card.querySelector(".echo-card__chips");
    el.input = card.querySelector(".echo-card__input input");
    el.tag = bot.querySelector(".echo-bot__tag");

    loadLog();
    if (log.length) {
      log.forEach(function (m) {
        var w = document.createElement("div");
        w.innerHTML = msgOf(m.role, m.html);
        el.body.appendChild(w.firstChild);
      });
      el.body.scrollTop = el.body.scrollHeight;
      renderChips(["我的投递情况", "今天该做什么", "哪几家该跟进"]);
    } else {
      pushMsg("bot", "嗨，我是**小回**。\n你的投递记录我都看得到——想知道进度、回音率、今天做什么，或者把一段招聘话术粘给我，我帮你看有没有坑。");
      renderChips(["我的投递情况", "今天该做什么", "这段话术靠谱吗", "回音率多少算正常"]);
    }

    function toggle(force) {
      opened = typeof force === "boolean" ? force : !opened;
      card.classList.toggle("is-open", opened);
      bot.classList.remove("is-new");
      tagHide();
      if (opened) setTimeout(function () { el.input.focus(); }, 200);
    }

    function tagHide() { el.tag.classList.remove("is-on"); }

    bot.addEventListener("click", function () { toggle(); });
    card.querySelector(".echo-card__x").addEventListener("click", function () { toggle(false); });
    card.querySelector(".echo-card__send").addEventListener("click", function () { send(el.input.value); });
    el.input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); send(el.input.value); }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && opened) toggle(false);
    });

    // 首次进入几秒后提示一次，不打扰
    setTimeout(function () {
      if (!opened && !sessionStorage.getItem("echo.agent.hinted")) {
        el.tag.classList.add("is-on");
        try { sessionStorage.setItem("echo.agent.hinted", "1"); } catch (e) {}
        setTimeout(tagHide, 6000);
      }
    }, 5200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
