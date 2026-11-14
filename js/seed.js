/* ==========================================================================
   seed.js —— 静态知识库 + 演示数据生成器
   全部内置在本文件里，不联网、不读外部文件；给各页面当作"经验数据"用。
      Echo.seed.skills        技能词典（含"怎么补"的建议）
      Echo.seed.radarRules   防坑雷达规则库
      Echo.seed.phrases       常见招聘话术词典
      Echo.seed.peers()       同伴匿名聚合数据（确定性生成，刷新不变）
      Echo.seed.peerPosts     同伴匿名动态文案池
      Echo.seed.moodTags      情绪标签
      Echo.seed.buildSprint() 每周陪跑清单生成器
      Echo.seed.fillDemo()    写入一套演示数据（首页 / 台账 / 诊断都有内容）
   ========================================================================== */
window.Echo = window.Echo || {};

(function () {
  "use strict";
  var util = Echo.util;

  /* ---------------- 1. 技能词典 ---------------- */
  var skills = [
    // 前端
    { name: "HTML/CSS", aliases: ["html", "css", "样式", "响应式", "flex", "grid"], family: "前端", weight: 3, how: "用 2 天把一个真实页面切成静态版：先做布局，再补响应式" },
    { name: "JavaScript", aliases: ["js", "javascript", "es6", "原生 js"], family: "前端", weight: 3, how: "精读 MDN 的数组方法与事件模型，然后手写一个 Todo + 表单校验" },
    { name: "Vue / React", aliases: ["vue", "react", "组件化", "hooks"], family: "前端", weight: 3, how: "跟官方教程做一个带列表/表单/弹窗的小项目，重点理解组件与状态" },
    { name: "小程序", aliases: ["微信小程序", "uniapp", "taro"], family: "前端", weight: 2, how: "照着官方文档做一版'课程表'小程序，跑通登录与云开发即可写进简历" },
    { name: "工程化", aliases: ["webpack", "vite", "git", "npm", "打包"], family: "前端", weight: 2, how: "把上面那个小项目用 Git 管理、用 Vite 打包后部署到静态托管" },
    // 后端
    { name: "Java", aliases: ["java", "spring", "springboot", "ssm"], family: "后端", weight: 3, how: "写一个带登录 + 增删改查接口的 Spring Boot 项目，配好 MySQL" },
    { name: "Python", aliases: ["python", "django", "flask", "fastapi"], family: "后端", weight: 3, how: "用 Flask/FastAPI 做一个接口服务，把数据落库并写单元测试" },
    { name: "数据库", aliases: ["mysql", "sql", "postgresql", "索引", "redis"], family: "后端", weight: 3, how: "把项目表结构画成 ER 图，练 20 道 SQL 题，理解索引与事务" },
    { name: "Linux / 部署", aliases: ["linux", "docker", "服务器", "nginx"], family: "后端", weight: 2, how: "用 Docker 把项目跑起来，再用反向代理挂上域名（本地也行）" },
    // 数据 / 算法
    { name: "SQL 取数", aliases: ["sql 查询", "hive", "数仓", "取数"], family: "数据", weight: 3, how: "找一份公开数据集，练连接、窗口函数、留存率几个典型题型" },
    { name: "Python 数据分析", aliases: ["pandas", "numpy", "matplotlib", "数据清洗"], family: "数据", weight: 3, how: "用 pandas 做一份完整分析：清洗 → 指标 → 可视化 → 结论" },
    { name: "指标体系", aliases: ["指标", "留存", "转化率", "漏斗", "abtest", "ab 测试"], family: "数据", weight: 3, how: "给一个小产品定义北极星指标 + 三级指标树，试着写在简历的项目里" },
    { name: "机器学习", aliases: ["机器学习", "模型", "sklearn", "pytorch", "算法"], family: "算法", weight: 2, how: "跑通一个经典竞赛 baseline（如房价预测），把特征工程写清楚" },
    // 产品 / 运营
    { name: "需求分析", aliases: ["需求分析", "用户调研", "访谈", "痛点"], family: "产品", weight: 3, how: "做 10 个真人访谈（问行为不问意愿），输出一页需求结论" },
    { name: "原型 / 文档", aliases: ["原型", "axure", "墨刀", "prd", "文档", "流程图"], family: "产品", weight: 3, how: "把一个想法写成 3 页 PRD + 可点击原型，作为作品集链接放简历" },
    { name: "数据分析意识", aliases: ["数据分析", "复盘", "看数据"], family: "产品", weight: 2, how: "给自己做的项目配一套数据看板，说明每个数字背后的决策" },
    { name: "内容 / 文案", aliases: ["文案", "内容", "新媒体", "公众号", "笔记"], family: "运营", weight: 2, how: "做一个小红书/公众号账号，连续更 10 篇，把数据截图放进作品集" },
    { name: "社群 / 活动", aliases: ["社群", "运营", "活动策划", "拉新", "用户增长"], family: "运营", weight: 2, how: "组织 1 次校园活动或社群运营，记录人数、留存、复盘结论" },
    { name: "商务 / 沟通", aliases: ["沟通", "协调", "组织", "学生工作", "社团"], family: "运营", weight: 1, how: "把社团 / 班委经历改写成'目标 - 动作 - 结果'三段式" },
    // 设计
    { name: "UI 视觉", aliases: ["ui", "视觉", "figma", "sketch", "设计"], family: "设计", weight: 3, how: "临摹 5 个优秀界面 + 做 1 套自己的组件库，导出作品集 PDF" },
    { name: "交互 / 体验", aliases: ["交互", "用户体验", "ux", "流程设计"], family: "设计", weight: 2, how: "挑一个现成 App 做体验走查，输出问题清单与改进稿" },
    // 通用
    { name: "英语能力", aliases: ["英语", "cet-6", "cet6", "四六级", "雅思", "托福"], family: "通用", weight: 2, how: "四六级分数写清时间；能读写英文文档就写'可阅读英文技术文档'" },
    { name: "办公工具", aliases: ["excel", "ppt", "word", "办公软件"], family: "通用", weight: 1, how: "用数据透视表做一份分析报告，投运营/产品岗时是加分项" },
    { name: "项目 / 实习经历", aliases: ["项目经历", "实习", "实践", "竞赛", "获奖"], family: "通用", weight: 3, how: "把每个项目按'背景 - 我的动作 - 量化结果'三行写完，缺结果就补数据" }
  ];

  /* ---------------- 2. 岗位族识别词 ---------------- */
  var roles = [
    { key: "前端", words: ["前端", "web", "h5", "vue", "react", "小程序", "页面"] },
    { key: "后端", words: ["后端", "服务端", "java", "python", "golang", "go 工程师", "接口", "架构"] },
    { key: "数据", words: ["数据", "分析", "bi", "数仓", "sql", "算法", "ai", "机器学习"] },
    { key: "产品", words: ["产品", "pm", "需求", "策划"] },
    { key: "运营", words: ["运营", "内容", "社群", "新媒体", "市场", "增长", "用户"] },
    { key: "设计", words: ["设计", "ui", "ux", "视觉", "交互"] },
    { key: "测试", words: ["测试", "qa", "质量"] }
  ];

  /* ---------------- 3. 防坑雷达规则库 ---------------- */
  // lv：风险等级权重（1 提示 / 2 警告 / 3 高危）
  var radarRules = [
    { id: "fee", lv: 3, label: "要求你先交钱", keys: ["押金", "培训费", "服装费", "体检费", "保证金", "报名费", "材料费", "服务费", "入职费", "资料费"],
      why: "正规企业招聘不收任何费用，任何名义的收费都违反劳动法（《劳动合同法》第九条）。" },
    { id: "loan", lv: 3, label: "诱导培训贷 / 分期", keys: ["培训贷", "分期付款", "助学贷款", "先学后付", "贷款", "学费分期", "包就业协议"],
      why: "常见套路：以'先培训后上岗'为名让你签网贷，最后岗位不兑现，债务由你承担。" },
    { id: "guarantee", lv: 3, label: "'包过 / 包 offer / 内推保录'承诺", keys: ["包过", "包 offer", "包offer", "保录", "保offer", "内推包", "百分百录用", "保证上岗", "无门槛"],
      why: "招聘结果由业务部门决定，任何'保证录取'的承诺都不可信，多为收费钩子。" },
    { id: "private", lv: 2, label: "要求加私人微信 / QQ 私聊，避开官方渠道", keys: ["加微信", "加qq", "添加qq", "私聊", "微信联系", "扫码加群"],
      why: "正规 HR 通常用企业邮箱或招聘平台内沟通；强制私聊是为了逃避平台留痕与投诉。" },
    { id: "email", lv: 2, label: "投递邮箱不是企业邮箱", keys: ["@qq.com", "@163.com", "@126.com", "@sina.com", "@foxmail.com", "@yeah.net"],
      why: "900 人以上企业一般使用自有域名邮箱；个人邮箱收简历难以核实主体真实性。" },
    { id: "vague", lv: 2, label: "薪资含糊 / 只写'面议'且岗位描述极短", keys: ["薪资面议", "待遇丰厚", "工资不限", "月入过万", "轻松月入", "高薪诚聘"],
      why: "真实岗位一般会写明区间；'月入过万 + 无门槛'常见于销售拉人或诈骗引流。" },
    { id: "volume", lv: 2, label: "大量招聘、当天入职、无门槛", keys: ["大量招聘", "紧急招聘", "当天入职", "即刻上岗", "学历不限", "专业不限", "无需经验", "应届生优先上"],
      why: "真正的实习岗位通常有明确专业/技能要求，'零门槛 + 高薪'是典型诱饵组合。" },
    { id: "task", lv: 3, label: "刷单 / 打字员 / 点赞返利类兼职", keys: ["刷单", "打字员", "点赞", "返利", "做任务", "代付", "垫付", "充值"],
      why: "这是典型网络诈骗剧本：先小额返现取信，再诱导大额垫付后跑路。" },
    { id: "id", lv: 3, label: "索要身份证 / 银行卡正反面照片或短信验证码", keys: ["身份证正反面", "银行卡号", "验证码", "手持身份证", "人脸识别"],
      why: "入职前索要这些信息，可能被用于网贷、洗钱或注册虚假账号。" },
    { id: "noclear", lv: 2, label: "查不到公司主体或与名称不符", keys: ["分公司直招", "总部直聘", "XX 科技集团", "人力资源有限公司", "劳务派遣", "中介"],
      why: "先在天眼查/爱企查搜全称，确认成立时间、注册资本、经营范围与招聘主体一致。" },
    { id: "unpaid", lv: 2, label: "长期无薪实习 / 试用期不付薪", keys: ["无薪实习", "实习期无薪", "试用期无工资", "只提供补贴", "免费实习"],
      why: "可接受的补贴与'完全无薪'是两件事，长期无薪实习要谨慎评估性价比。" },
    { id: "copyright", lv: 1, label: "要求先提交完整方案 / 作品源文件", keys: ["提交完整方案", "免费测试题", "提供源文件", "试稿", "无偿提供创意"],
      why: "正规笔试通常有明确边界与时限；要求提交可直接商用的成品，存在白嫖风险。" }
  ];

  /* ---------------- 4. 招聘话术词典（读起来像好话，其实要留心） ---------------- */
  var phrases = [
    { text: "「我们先培训，培训期间没有工资，转正后一起补」", tag: "留心", note: "多为培训贷或变相无偿用工，先问清是否有书面协议与费用条款。" },
    { text: "「先交 400 元服装费和工牌费，上班后退还」", tag: "高危", note: "收费即违规，正规企业不会让你先垫钱。" },
    { text: "「能力没问题，但需要你先签一份就业服务协议」", tag: "高危", note: "签之前务必看清是否包含分期付款、违约金条款。" },
    { text: "「实习期三个月，表现好可以转正，具体薪资面议」", tag: "留心", note: "面议岗位建议在面试前邮件确认薪资区间与转正条件。" },
    { text: "「我们公司刚成立，团队非常有活力」", tag: "提示", note: "先核实成立时间与是否为招聘主体本人，避免挂靠招聘。" },
    { text: "「简历通过后会有专人联系你，请保持微信畅通」", tag: "正常", note: "常规流程。若对方只肯用微信、不愿给公司邮箱，再提高警惕。" },
    { text: "「这个岗位不要求经验，只要能吃苦、愿意学」", tag: "留心", note: "要么是低价值岗位，要么是销售/客服类引流岗，问清日常工作内容。" },
    { text: "「入职需要提供身份证正反面和银行卡照片」", tag: "高危", note: "入职材料通常在录用后才收，且不会要银行卡照片与短信验证码。" }
  ];

  /* ---------------- 5. 同伴匿名聚合数据（确定性生成） ---------------- */
  function peers() {
    var rnd = util.rng(20261016);
    var sample = 168;                        // 同校同年级样本量
    var buckets = ["0 份", "1-2 份", "3-5 份", "6-9 份", "10-15 份", "16 份+"];
    var dist = [14, 26, 34, 46, 30, 18];     // 与 buckets 对应（合计 168）
    var industries = [
      { name: "互联网 / 软件", pct: 34 },
      { name: "金融 / 财会", pct: 17 },
      { name: "制造业 / 电子", pct: 14 },
      { name: "教育 / 培训", pct: 11 },
      { name: "快消 / 零售", pct: 9 },
      { name: "传媒 / 广告", pct: 8 },
      { name: "其他", pct: 7 }
    ];
    var stage = [
      { name: "还在投递中", pct: 46 },
      { name: "已拿到面试", pct: 29 },
      { name: "已进入终面", pct: 11 },
      { name: "已拿到 Offer", pct: 14 }
    ];
    var moodCurve = [];
    for (var i = 0; i < 7; i++) {
      moodCurve.push({ label: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"][i], level: Math.round((2.6 + rnd() * 1.6) * 10) / 10 });
    }
    return {
      school: Echo.store.profile().school || "同校",
      sample: sample,
      buckets: buckets,
      dist: dist,
      avgApps: 6.4,
      replyRate: 23,
      interviewRate: 29,
      avgFirstReply: 5.8,          // 天
      ghostRate: 41,
      industries: industries,
      stage: stage,
      moodCurve: moodCurve,
      updatedAt: "本周一更新（匿名聚合，样本 " + sample + " 人）",
      insight: "同校样本里，41% 的第一次投递至今没有回音 —— 没有回音是常态，不是你一个人的问题。"
    };
  }

  var peerPosts = [
    "第 12 份终于收到笔试通知了，前面全是已送达 😭 记录一下：简历里把'参与'改成'负责+数据'之后回音真的变多了。",
    "今天不刷邮箱了，改成每两天固定看一次。焦虑感确实降了，效率还高了。",
    "面完被问倒了两个问题，回来补了一晚上知识，第二次面试明显好很多。失败也是素材。",
    "同校同专业，已投 20 份 0 面试。看到进度墙里 41% 的人跟我一样，突然没那么崩溃了。",
    "把投递表按'7 天未回音就归档'清了一遍，看着清爽的表格，人也没那么慌。",
    "分享一个真实经验：投之前先花 10 分钟照 JD 改简历关键词，回音率肉眼可见提升。",
    "第一次进终面那天手抖，但讲完自己的项目细节后 HR 说'你对我们业务理解挺清晰'，有被肯定的感觉。",
    "被拒了 6 次之后我总结出：投递量重要，但精准度更重要。现在只投真正匹配的岗位。"
  ];

  var moodTags = [
    { level: 1, emoji: "😣", t: "很焦虑", d: "心里一直悬着，看不进书" },
    { level: 2, emoji: "😕", t: "有点慌", d: "会反复刷新邮箱" },
    { level: 3, emoji: "😐", t: "还行", d: "正常推进，按计划走" },
    { level: 4, emoji: "🙂", t: "挺稳", d: "今天有明确的小进展" },
    { level: 5, emoji: "😄", t: "有回音！", d: "收到了面试/笔试通知" }
  ];

  /* ---------------- 6. 每周陪跑清单生成器 ---------------- */
  function buildSprint(gaps, reminders) {
    var items = [];
    var g = (gaps || []).slice(0, 2);
    var follow = (reminders || []).slice(0, 3);

    // 固定动作：以"可控的小动作"替代"要找到实习"这个大目标
    items.push({ text: "精简 1 处简历表达：把「参与 / 负责」改成「动作 + 量化结果」", tag: "简历", kind: "resume", d: "对照诊断页的改写建议，20 分钟能改完一段" });
    items.push({ text: "选定 3 个目标岗位，逐条照 JD 对齐关键词后再投", tag: "投递", kind: "apply", d: "投得准比投得多更重要，回音率差异很明显" });

    follow.forEach(function (r, i) {
      items.push({
        text: "跟进「" + r.company + " · " + r.position + "」并记录进展", tag: "跟进", kind: "follow",
        d: r.text, appId: r.appId, order: i
      });
    });

    g.forEach(function (x) {
      items.push({ text: "补一个缺口：" + x.name + "（" + x.family + "）", tag: "补缺", kind: "gap", d: x.how });
    });

    items.push({ text: "给这周做一次 10 分钟复盘：哪一步有效，下周保留它", tag: "复盘", kind: "review", d: "把有效动作写进下周清单，别只记感受" });
    items.push({ text: "做 1 次 5 分钟情绪打卡，写下此刻最担心的一件事", tag: "情绪", kind: "mood", d: "把焦虑写成句子，它的破坏力会下降一半" });

    return items.map(function (t) {
      return { id: util.uid("t"), text: t.text, tag: t.tag, kind: t.kind, d: t.d || "", appId: t.appId || "", done: false, doneAt: "" };
    });
  }

  /* ---------------- 7. 演示数据 ---------------- */
  function demoApps() {
    var today = util.today();
    var raw = [
      { company: "云图科技", position: "前端开发实习生", channel: "实习僧", city: "武汉", salary: "150/天", status: "interview", back: 11, upd: 2, note: "一面聊了项目，等二面通知", jd: "1. 熟悉 HTML/CSS/JavaScript，了解 Vue 或 React；2. 有前端项目经验，能独立完成页面开发；3. 熟悉 Git 与工程化工具；4. 本科在读，每周到岗 4 天以上。" },
      { company: "启明数据", position: "数据分析实习生", channel: "BOSS 直聘", city: "武汉", salary: "180/天", status: "exam", back: 8, upd: 3, note: "笔试是 SQL + 业务题，已完成待结果", jd: "1. 熟练使用 SQL 进行数据提取与清洗；2. 掌握 Excel / Python 基础分析；3. 对指标体系、留存与转化有基本理解；4. 统计学、数学相关专业优先。" },
      { company: "星野文化", position: "内容运营实习生", channel: "公众号内推", city: "远程", salary: "120/天", status: "viewed", back: 9, upd: 6, note: "HR 加了微信问了下时间安排" , jd: "1. 负责新媒体内容策划与撰写；2. 有社群运营经验者优先；3. 熟练使用剪辑或设计工具加分。" },
      { company: "衡远咨询", position: "产品助理实习生", channel: "公司官网", city: "武汉", salary: "面议", status: "applied", back: 12, upd: 12, note: "投完没有回音", jd: "1. 参与需求调研与文档撰写；2. 会使用 Axure / 墨刀 做原型；3. 沟通表达能力强，能推动跨团队协作。" },
      { company: "landmark 教育", position: "市场推广实习生", channel: "招聘群", city: "武汉", salary: "底薪+提成", status: "ghosted", back: 21, upd: 18, note: "对方只让加微信，问薪资不回答，已归档", jd: "1. 无经验可，主要负责校区招生推广；2. 沟通能力强，抗压能力好；3. 提成丰厚，月入过万。" },
      { company: "海川智能", position: "测试开发实习生", channel: "牛客网", city: "杭州", salary: "200/天", status: "rejected", back: 16, upd: 5, note: "笔试挂了，反馈是编程题没写完", jd: "1. 熟悉 Python 或 Java；2. 了解接口测试与自动化测试框架；3. 计算机相关专业。" },
      { company: "拓新软件", position: "Java 后端实习生", channel: "实习僧", city: "武汉", salary: "160/天", status: "applied", back: 5, upd: 5, note: "刚投，等消息", jd: "1. 熟悉 Java 基础与 Spring Boot；2. 了解 MySQL 与 Redis；3. 有后端项目经验。" },
      { company: "光谷在线", position: "用户运营实习生", channel: "BOSS 直聘", city: "武汉", salary: "130/天", status: "applied", back: 3, upd: 3, note: "", jd: "1. 负责用户社群日常维护与活动执行；2. 会看基础数据报表；3. 有学生会/社团经历优先。" },
      { company: "经纬数科", position: "数据标注实习生", channel: "校园招聘会", city: "武汉", salary: "100/天", status: "offer", back: 20, upd: 1, note: "拿到 offer，薪资偏低，还在纠结", jd: "1. 按规范完成数据标注与质检；2. 耐心细致；3. 每周到岗 3 天。" }
    ];
    var all = ["云图科技|后端开发实习生|Java 基础扎实，熟悉 Spring Boot 与 MySQL；了解 Redis 者优先。|实习僧|武汉|160/天"];
    return raw.map(function (r) {
      var appliedAt = util.addDays(today, -r.back);
      var updatedAt = util.addDays(today, -r.upd);
      var a = {
        id: util.uid("app"), company: r.company, position: r.position, channel: r.channel,
        city: r.city, salary: r.salary, status: r.status, appliedAt: appliedAt, updatedAt: updatedAt,
        interviewAt: r.status === "interview" ? util.addDays(today, 2) + "T14:00" : "",
        replyAt: r.status === "applied" || r.status === "ghosted" ? "" : updatedAt,
        note: r.note, jd: r.jd, link: "", risk: null,
        history: [{ at: appliedAt, status: "applied", note: "创建记录" }]
      };
      if (r.status !== "applied") {
        a.history.push({ at: updatedAt, status: r.status, note: "状态更新为 " + (Echo.STATUS_MAP[r.status] || {}).label });
      }
      return a;
    });
  }

  function fillDemo(force) {
    var s = Echo.store.load();
    if (s.demo && !force) return false;
    s.applications = demoApps();
    s.demo = true;
    s.moods = [
      { at: util.today() + " 21:40", date: util.addDays(util.today(), -2), level: 1, tag: "焦虑", note: "第 12 份简历还是已送达" },
      { at: util.today() + " 22:10", date: util.addDays(util.today(), -1), level: 3, tag: "平稳", note: "改完简历感觉有点掌控感" },
      { at: util.today() + " 20:05", date: util.today(), level: 5, tag: "有回音", note: "收到笔试通知了！" }
    ];
    s.wall = { joined: true, posts: [] };
    s.sprint = { week: util.weekStart(), items: buildSprint(
      [{ name: "SQL 取数", family: "数据", how: "找一份公开数据集，练连接、窗口函数、留存率几个典型题型" },
       { name: "原型 / 文档", family: "产品", how: "把一个想法写成 3 页 PRD + 可点击原型" }],
      [
        { company: "衡远咨询", position: "产品助理实习生", text: "已 12 天未更新，建议发一封跟进邮件 / 私信 HR", appId: "" },
        { company: "星野文化", position: "内容运营实习生", text: "已 6 天未更新，建议发一封跟进邮件 / 私信 HR", appId: "" }
      ]), history: [
      { week: util.addDays(util.weekStart(), -7), done: 5, total: 8, rate: 63 },
      { week: util.addDays(util.weekStart(), -14), done: 6, total: 7, rate: 86 }
    ] };
    Echo.store.save();
    return true;
  }

  Echo.seed = {
    skills: skills, roles: roles, radarRules: radarRules, phrases: phrases,
    peers: peers, peerPosts: peerPosts, moodTags: moodTags,
    buildSprint: buildSprint, demoApps: demoApps, fillDemo: fillDemo
  };
})();
