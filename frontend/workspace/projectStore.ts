import type { DesignProject, ProjectFile } from "./models/project";
import { PROJECT_STORAGE_KEY } from "./models/project";

const starterFiles: ProjectFile[] = [
  {
    path: "index.html",
    language: "html",
    content: `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DesignBuddy Starter</title>
  <link rel="stylesheet" href="./src/styles.css">
</head>
<body>
  <main class="page-shell">
    <nav class="top-nav"><span class="brand">STUDIO<span> / DESIGNBUDDY</span></span><a href="#contact">联系我们</a></nav>
    <section class="hero">
      <p class="eyebrow">YOUR NEXT IDEA STARTS HERE</p>
      <h1>把一个想法，<br><span>变成真正的作品。</span></h1>
      <p class="intro">这是你的项目起点。编辑源码、调整样式，并在右侧实时预览每次变化。</p>
      <a class="primary-link" href="#features">探索设计 <span>↗</span></a>
    </section>
    <section class="feature-grid" id="features">
      <article><span class="number">01</span><h2>清晰的结构</h2><p>用简单、易读的页面结构组织内容。</p></article>
      <article><span class="number">02</span><h2>灵活的样式</h2><p>调整颜色、留白与排版，打造自己的视觉语言。</p></article>
      <article><span class="number">03</span><h2>实时反馈</h2><p>保存源码后即可在预览面板检查效果。</p></article>
    </section>
    <footer id="contact">MADE WITH DESIGNBUDDY <span>从草稿开始，不断打磨。</span></footer>
  </main>
  <script src="./src/main.js"></script>
</body>
</html>`
  },
  {
    path: "src/styles.css",
    language: "css",
    content: `:root { font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif; color: #1c2434; background: #f6f5f1; font-synthesis: none; text-rendering: optimizeLegibility; }
* { box-sizing: border-box; }
body { margin: 0; }
a { color: inherit; text-decoration: none; }
.page-shell { width: min(1120px, calc(100% - 48px)); margin: auto; }
.top-nav { height: 82px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #dcdedb; font-size: 13px; }
.brand { font-weight: 800; letter-spacing: .12em; } .brand span { color: #81877f; font-weight: 500; font-size: 10px; }
.top-nav a { padding: 10px 14px; border: 1px solid #d5d8d2; border-radius: 999px; }
.hero { padding: clamp(72px, 12vw, 140px) 0 90px; max-width: 790px; }
.eyebrow, .number { font-size: 11px; color: #60795f; letter-spacing: .16em; font-weight: 700; }
h1 { font-size: clamp(42px, 7vw, 78px); line-height: 1.08; letter-spacing: -.065em; margin: 20px 0 25px; }
h1 span { color: #758b6f; }
.intro { font-size: 16px; line-height: 1.9; color: #697269; max-width: 520px; }
.primary-link { display: inline-flex; gap: 22px; align-items: center; margin-top: 22px; padding: 14px 20px; color: white; background: #26372e; border-radius: 999px; font-size: 13px; }
.feature-grid { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid #dcdedb; border-bottom: 1px solid #dcdedb; }
.feature-grid article { padding: 28px 24px 34px 0; } .feature-grid article + article { padding-left: 24px; border-left: 1px solid #dcdedb; }
.feature-grid h2 { font-size: 18px; margin: 28px 0 10px; } .feature-grid p { color: #697269; font-size: 13px; line-height: 1.8; }
footer { display: flex; justify-content: space-between; gap: 16px; padding: 26px 0 36px; font-size: 10px; color: #788077; letter-spacing: .1em; }
@media (max-width: 640px) { .page-shell { width: calc(100% - 32px); } .feature-grid { grid-template-columns: 1fr; } .feature-grid article, .feature-grid article + article { padding: 20px 0; border-left: 0; } .hero { padding: 70px 0 60px; } footer { flex-direction: column; } }`
  },
  {
    path: "src/main.js",
    language: "javascript",
    content: `document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});`
  }
];


function filesForProject(name: string, prompt: string): ProjectFile[] {
  const key = (name + " " + prompt).toLocaleLowerCase();

  if (/(数据管理后台|数据后台|后台管理|dashboard|统计卡片|数据表格)/i.test(key)) {
    return [
      {
        path: "index.html",
        language: "html",
        content: `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>数据工作台</title><link rel="stylesheet" href="./src/styles.css">
</head>
<body>
  <div class="dashboard-shell">
    <aside class="sidebar"><div class="brand"><b>D</b><span>数据工作台</span></div><p class="nav-label">工作空间</p><a class="nav-item active" href="#overview">▦ 概览</a><a class="nav-item" href="#records">▤ 数据记录</a><a class="nav-item" href="#reports">◷ 报表分析</a><div class="sidebar-bottom">DESIGNBUDDY / WORKSPACE</div></aside>
    <main class="dashboard-main">
      <header class="topbar"><span>工作空间 / 概览</span><button>本周 · 10月 7日—13日</button></header>
      <section class="dashboard-content" id="overview"><p class="eyebrow">TUESDAY, OCTOBER 13</p><h1>早上好，欢迎回来。</h1><p class="muted">这是你的业务概览。你可以在代码模式中修改演示数据和页面样式。</p>
        <div class="stat-grid"><article><span>总收入</span><b>¥128,430</b><small>↗ 12.8% 较上周</small></article><article><span>活跃用户</span><b>8,249</b><small>↗ 8.2% 较上周</small></article><article><span>转化率</span><b>4.86%</b><small>↗ 1.4% 较上周</small></article><article><span>待处理任务</span><b>36</b><small class="neutral">需要关注</small></article></div>
        <section class="records" id="records"><div class="section-heading"><div><h2>最近记录</h2><p>演示数据 · 可编辑表格内容</p></div><input id="record-search" placeholder="搜索客户或项目…" aria-label="搜索数据记录"></div>
          <table><thead><tr><th>项目</th><th>负责人</th><th>状态</th><th>金额</th></tr></thead><tbody><tr><td>品牌官网改版</td><td>林安</td><td><i class="pill green">已完成</i></td><td>¥18,600</td></tr><tr><td>移动端体验优化</td><td>周宁</td><td><i class="pill blue">进行中</i></td><td>¥12,400</td></tr><tr><td>季度数据分析</td><td>陈一</td><td><i class="pill amber">待审核</i></td><td>¥8,900</td></tr><tr><td>客户门户设计</td><td>顾然</td><td><i class="pill green">已完成</i></td><td>¥21,000</td></tr></tbody></table>
        </section>
      </section>
    </main>
  </div>
  <script src="./src/main.js"></script>
</body>
</html>`
      },
      {
        path: "src/styles.css",
        language: "css",
        content: `:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#202735;background:#f6f7fb;font-synthesis:none}*{box-sizing:border-box}body{margin:0}.dashboard-shell{display:flex;min-height:100vh}.sidebar{position:relative;display:flex;flex-direction:column;width:220px;flex-shrink:0;padding:24px 14px;background:#202735;color:#f4f5f8}.brand{display:flex;align-items:center;gap:10px;padding:0 8px 30px;font-size:13px;font-weight:700}.brand b{display:grid;place-items:center;width:31px;height:31px;border-radius:10px;background:#8073f2}.nav-label{padding:0 10px;color:#818a9d;font-size:9px;text-transform:uppercase;letter-spacing:.14em}.nav-item{padding:12px 11px;margin:3px 0;border-radius:8px;color:#b7bdc9;text-decoration:none;font-size:11px}.nav-item.active{background:#363b4c;color:#fff}.sidebar-bottom{margin-top:auto;padding:14px 8px;color:#818a9d;font-size:8px;letter-spacing:.12em}.dashboard-main{min-width:0;flex:1}.topbar{display:flex;align-items:center;justify-content:space-between;height:58px;padding:0 30px;border-bottom:1px solid #e8eaf0;background:#fff;color:#858c99;font-size:10px}.topbar button{border:1px solid #e5e7ee;border-radius:7px;background:#fff;padding:8px 10px;font-size:10px}.dashboard-content{max-width:1080px;margin:auto;padding:34px 30px}.eyebrow{margin:0 0 8px;color:#897df0;font-size:9px;font-weight:700;letter-spacing:.15em}.dashboard-content h1{margin:0;font-size:27px;letter-spacing:-.04em}.muted,.section-heading p{color:#89909c;font-size:11px;line-height:1.7}.stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:25px 0}.stat-grid article{display:grid;gap:12px;padding:17px;border:1px solid #e9ebf0;border-radius:12px;background:white}.stat-grid article span{color:#868d9b;font-size:10px}.stat-grid article b{font-size:21px;letter-spacing:-.04em}.stat-grid article small{color:#319779;font-size:9px}.stat-grid article .neutral{color:#9b8a62}.records{padding:18px;border:1px solid #e8eaf0;border-radius:13px;background:#fff}.section-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:15px}.section-heading h2{margin:0;font-size:15px}.section-heading p{margin:4px 0 0}.section-heading input{width:180px;padding:9px 10px;border:1px solid #e3e6ed;border-radius:7px;font:inherit;font-size:10px}table{width:100%;border-collapse:collapse;text-align:left;font-size:10px}th{padding:11px 9px;border-bottom:1px solid #edf0f4;color:#9299a5;font-weight:500}td{padding:14px 9px;border-bottom:1px solid #f0f2f5}tr:last-child td{border-bottom:0}.pill{padding:5px 7px;border-radius:6px;font-style:normal;font-size:9px}.green{background:#e6f6ee;color:#26875e}.blue{background:#eaf1ff;color:#4d77c7}.amber{background:#fff4dc;color:#a67a27}@media(max-width:760px){.sidebar{width:150px;padding:17px 8px}.dashboard-content{padding:24px 15px}.stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.topbar{padding:0 15px}td,th{padding:10px 5px}}@media(max-width:520px){.sidebar{display:none}.section-heading{align-items:flex-start;flex-direction:column}.section-heading input{width:100%}table{font-size:9px}}`
      },
      {
        path: "src/main.js",
        language: "javascript",
        content: `const search = document.querySelector('#record-search');
if (search) {
  search.addEventListener('input', () => {
    const query = search.value.trim().toLocaleLowerCase();
    document.querySelectorAll('#records tbody tr').forEach((row) => {
      row.hidden = !row.textContent.toLocaleLowerCase().includes(query);
    });
  });
}`
      }
    ];
  }

  if (/(电商|商品|购物|产品详情|store|e-commerce|ecommerce)/i.test(key)) {
    return [
      {
        path: "index.html",
        language: "html",
        content: `<!doctype html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>日常精选</title><link rel="stylesheet" href="./src/styles.css"></head>
<body>
  <header class="shop-nav"><a class="shop-brand" href="#">FORME<span> OBJECTS FOR EVERYDAY</span></a><nav><a href="#shop">全部商品</a><a href="#story">品牌故事</a></nav><button class="cart-button" id="cart-button">购物袋 <b id="cart-count">0</b></button></header><p id="cart-notice" class="cart-notice" aria-live="polite"></p>
  <main><section class="shop-hero"><div><p class="eyebrow">THE EVERYDAY EDITION</p><h1>让日常，<br><em>值得被设计。</em></h1><p>精选质感生活物件，以克制的造型、耐用的材质和恰到好处的细节，陪伴每一天。</p><a href="#shop" class="shop-cta">探索精选 ↗</a></div><div class="hero-object"><span class="object-sun"></span><div class="vase"></div><div class="object-shadow"></div></div></section>
  <section class="shop-section" id="shop"><div class="shop-section-heading"><div><p class="eyebrow">CURATED FOR YOU</p><h2>本季精选</h2></div><span>01 — 04 / OBJECTS</span></div><div class="product-grid">
    <article class="product-card"><div class="product-art art-vase"><i></i></div><p>陶艺系列</p><h3>手作陶器花瓶</h3><b>¥ 269</b><button class="add-cart">加入购物袋 +</button></article>
    <article class="product-card"><div class="product-art art-lamp"><i></i></div><p>照明系列</p><h3>柔光桌面灯</h3><b>¥ 489</b><button class="add-cart">加入购物袋 +</button></article>
    <article class="product-card"><div class="product-art art-chair"><i></i></div><p>家居系列</p><h3>原木边几</h3><b>¥ 699</b><button class="add-cart">加入购物袋 +</button></article>
  </div></section>
  <section class="story-section" id="story"><span>FORM FOLLOWS FEELING</span><h2>少一点噪音，<br>多一点感受。</h2><p>好设计不必大声宣告自己。它在每天的使用中，慢慢成为生活的一部分。</p></section></main>
  <footer>FORME OBJECTS <span>DESIGNED FOR EVERYDAY LIVING</span></footer>
  <script src="./src/main.js"></script>
</body>
</html>`
      },
      {
        path: "src/styles.css",
        language: "css",
        content: `:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#2a2b27;background:#f7f6f1;font-synthesis:none}*{box-sizing:border-box}body{margin:0}.shop-nav{display:flex;align-items:center;justify-content:space-between;gap:20px;height:78px;padding:0 5.5%;border-bottom:1px solid #e6e4dc}.shop-brand{display:grid;gap:3px;color:#2a2b27;text-decoration:none;font-size:18px;font-weight:800;letter-spacing:.13em}.shop-brand span{font-size:8px;font-weight:500;letter-spacing:.15em;color:#898b80}.shop-nav nav{display:flex;gap:25px}.shop-nav nav a{color:#6e7067;text-decoration:none;font-size:10px}.cart-button{padding:10px 13px;border:1px solid #dcded4;border-radius:30px;background:transparent;font-size:10px}.cart-button b{display:inline-grid;place-items:center;width:17px;height:17px;margin-left:6px;border-radius:50%;background:#2b3b32;color:white}.cart-notice{position:fixed;z-index:5;top:84px;right:5.5%;margin:0;color:#586257;font-size:10px}.cart-notice:not(:empty){padding:10px 13px;border:1px solid #dcded4;border-radius:8px;background:#fff;box-shadow:0 8px 25px #00000010}.shop-hero{display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:30px;max-width:1120px;margin:auto;padding:70px 32px 84px}.eyebrow{margin:0 0 14px;color:#75806f;font-size:9px;font-weight:750;letter-spacing:.16em}.shop-hero h1{margin:0 0 22px;font-size:clamp(38px,5.5vw,66px);line-height:1.12;letter-spacing:-.06em}.shop-hero h1 em{color:#75836c;font-style:normal}.shop-hero p:not(.eyebrow){max-width:380px;color:#77796f;font-size:12px;line-height:1.9}.shop-cta{display:inline-block;margin-top:15px;padding:13px 18px;border-radius:30px;background:#2a3930;color:#fff;text-decoration:none;font-size:10px}.hero-object{position:relative;display:grid;place-items:center;height:320px;overflow:hidden;border-radius:5px;background:linear-gradient(135deg,#e7e0d0,#f1ede2 52%,#d3d7c5)}.object-sun{position:absolute;top:37px;right:52px;width:88px;height:88px;border-radius:50%;background:#e8c98e}.vase{position:relative;z-index:2;width:102px;height:170px;border-radius:35% 35% 27% 27% / 21% 21% 16% 16%;background:linear-gradient(100deg,#8d9b83,#d3d6c5 48%,#9fac91);box-shadow:inset -10px 0 20px #59685325}.vase:before{content:'';position:absolute;top:-15px;left:33px;width:36px;height:28px;border-radius:7px 7px 3px 3px;background:#a5b098}.object-shadow{position:absolute;bottom:55px;width:200px;height:22px;border-radius:50%;background:#52614f21;filter:blur(8px)}.shop-section{max-width:1120px;margin:auto;padding:0 32px 70px}.shop-section-heading{display:flex;align-items:end;justify-content:space-between;margin-bottom:20px}.shop-section-heading h2{margin:0;font-size:25px;letter-spacing:-.04em}.shop-section-heading>span{color:#92958a;font-size:9px;letter-spacing:.12em}.product-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.product-card>p{margin:13px 0 5px;color:#8b8d82;font-size:9px}.product-card h3{margin:0 0 10px;font-size:13px}.product-card>b{display:block;font-size:12px}.product-art{position:relative;display:grid;place-items:center;height:230px;overflow:hidden;background:#ede8dd}.product-art i{position:relative;display:block}.art-vase i{width:75px;height:115px;border-radius:35% 35% 25% 25%;background:linear-gradient(90deg,#829079,#ced0b9,#8a9a7f)}.art-lamp{background:#e8e9de}.art-lamp i{width:16px;height:80px;background:#d7aa6d}.art-lamp i:before{content:'';position:absolute;top:-33px;left:-38px;width:92px;height:43px;border-radius:45px 45px 9px 9px;background:#d3bf98}.art-lamp i:after{content:'';position:absolute;bottom:-8px;left:-27px;width:70px;height:13px;border-radius:50%;background:#b3b8a4}.art-chair{background:#e9e1d8}.art-chair i{width:100px;height:75px;border-radius:12px;background:#a86f4f;box-shadow:0 60px 0 -28px #835b43}.art-chair i:before{content:'';position:absolute;top:50px;left:12px;width:12px;height:80px;background:#77513c;transform:rotate(5deg)}.art-chair i:after{content:'';position:absolute;top:50px;right:12px;width:12px;height:80px;background:#77513c;transform:rotate(-5deg)}.add-cart{width:100%;margin-top:12px;padding:10px;border:1px solid #d9dcd2;background:transparent;color:#53564c;font-size:10px;cursor:pointer}.add-cart:hover{background:#28382e;color:#fff}.story-section{padding:65px 20px;text-align:center;background:#e7e9df}.story-section>span{font-size:9px;letter-spacing:.16em;color:#75806f}.story-section h2{font-size:37px;line-height:1.25;letter-spacing:-.05em}.story-section p{max-width:390px;margin:auto;color:#70776c;font-size:11px;line-height:1.9}footer{display:flex;justify-content:space-between;padding:25px 5.5%;font-size:9px;letter-spacing:.12em;color:#818479}footer span{font-size:8px}@media(max-width:650px){.shop-nav{height:66px;padding:0 16px}.shop-nav nav{display:none}.shop-hero{grid-template-columns:1fr;padding:46px 18px 55px}.hero-object{height:235px}.shop-section{padding:0 18px 50px}.product-grid{grid-template-columns:1fr}.product-art{height:230px}.shop-section-heading h2{font-size:21px}.story-section{padding:50px 20px}.story-section h2{font-size:30px}footer{padding:22px 18px}}@media(min-width:651px) and (max-width:850px){.product-art{height:180px}}`
      },
      {
        path: "src/main.js",
        language: "javascript",
        content: `let count = 0;
const countNode = document.querySelector('#cart-count');
document.querySelectorAll('.add-cart').forEach((button) => {
  button.addEventListener('click', () => {
    count += 1;
    if (countNode) countNode.textContent = String(count);
    button.textContent = '已加入 ✓';
    window.setTimeout(() => { button.textContent = '加入购物袋 +'; }, 900);
  });
});
document.querySelector('#cart-button')?.addEventListener('click', () => {
  const notice = document.querySelector('#cart-notice');
  if (notice) notice.textContent = count ? '购物袋中有 ' + count + ' 件演示商品。' : '购物袋还是空的。';
});`
      }
    ];
  }

  if (/(saas|价格方案|订阅|软件产品首页)/i.test(key)) {
    return [
      {
        path: "index.html",
        language: "html",
        content: `<!doctype html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Flowdesk · 工作流更简单</title><link rel="stylesheet" href="./src/styles.css"></head>
<body>
  <header class="saas-nav"><a class="logo" href="#">flowdesk<span>✳</span></a><nav><a href="#features">产品能力</a><a href="#pricing">价格方案</a><a href="#stories">客户案例</a></nav><a class="nav-cta" href="#pricing">免费开始 ↗</a></header>
  <main><section class="saas-hero"><div class="hero-copy"><p class="eyebrow"><i></i> THE WORKSPACE THAT WORKS</p><h1>把复杂工作，<br><span>变成简单流程。</span></h1><p>一个清晰的工作空间，让你的团队从重复事务中解放，把时间留给真正重要的事。</p><div class="hero-actions"><a href="#pricing" class="primary">开始免费使用 ↗</a><a href="#features" class="text-link">了解产品 ↓</a></div><div class="social-proof"><div class="avatars"><i>A</i><i>L</i><i>M</i></div><span><b>2,400+</b> 个团队正在使用</span></div></div><div class="saas-visual"><div class="visual-top"><span>项目进度</span><span class="live">● LIVE</span></div><div class="visual-number">84.6% <small>↗ 12.3%</small></div><div class="chart"><i style="height:27%"></i><i style="height:42%"></i><i style="height:34%"></i><i style="height:61%"></i><i style="height:49%"></i><i style="height:76%"></i><i style="height:65%"></i><i style="height:92%"></i></div><div class="visual-footer"><span>本周完成</span><b>128 项任务</b></div></div></section>
  <section class="saas-features" id="features"><p class="eyebrow">BUILT FOR FOCUS</p><h2>让每一步，都更有条理。</h2><div class="feature-grid"><article><span>↗</span><h3>自动化重复工作</h3><p>把固定步骤整理成流程，减少琐碎切换。</p></article><article><span>◈</span><h3>团队协作清晰可见</h3><p>统一查看进度、任务和下一步行动。</p></article><article><span>◎</span><h3>把数据变成洞察</h3><p>在同一个空间跟踪变化，及时调整方向。</p></article></div></section>
  <section class="pricing" id="pricing"><p class="eyebrow">SIMPLE PRICING</p><h2>从今天开始，做得更好。</h2><div class="price-grid"><article><p>STARTER</p><h3>免费版</h3><b>¥0 <small>/ 月</small></b><ul><li>3 个活跃项目</li><li>基础工作流</li><li>社区支持</li></ul><a href="#contact">选择方案 ↗</a></article><article class="featured"><p>FOR TEAMS</p><h3>团队版</h3><b>¥99 <small>/ 人 / 月</small></b><ul><li>无限项目</li><li>高级自动化</li><li>团队权限管理</li></ul><a href="#contact">开始试用 ↗</a></article></div></section>
  <section class="saas-bottom" id="stories"><span>WORK SMARTER, TOGETHER.</span><h2>你的下一个好想法，<br>从这里开始。</h2><a href="#pricing">探索 Flowdesk ↗</a></section></main><footer id="contact">FLOWDESK © 2026 <span>设计更好的工作方式。</span></footer>
  <script src="./src/main.js"></script>
</body>
</html>`
      },
      {
        path: "src/styles.css",
        language: "css",
        content: `:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#252639;background:#fbfaf8;font-synthesis:none}*{box-sizing:border-box}body{margin:0}.saas-nav{display:flex;align-items:center;justify-content:space-between;gap:24px;height:76px;padding:0 6%;border-bottom:1px solid #eeedf0;background:#fff}.logo{color:#29293d;text-decoration:none;font-size:19px;font-weight:800;letter-spacing:-.05em}.logo span{margin-left:5px;color:#7869e8}.saas-nav nav{display:flex;gap:27px}.saas-nav nav a{color:#747584;text-decoration:none;font-size:10px}.nav-cta{padding:11px 15px;border-radius:8px;background:#6e5be8;color:#fff;text-decoration:none;font-size:10px}.saas-hero{display:grid;grid-template-columns:1.1fr .9fr;align-items:center;gap:60px;max-width:1100px;margin:auto;padding:88px 30px 91px}.eyebrow{color:#8375e8;font-size:9px;font-weight:750;letter-spacing:.15em}.eyebrow i{display:inline-block;width:7px;height:7px;margin-right:5px;border-radius:50%;background:#8576f0}.hero-copy h1{margin:22px 0;font-size:clamp(40px,5.6vw,67px);line-height:1.12;letter-spacing:-.07em}.hero-copy h1 span{color:#7463e7}.hero-copy>p:not(.eyebrow){max-width:420px;color:#7c7e8e;font-size:12px;line-height:1.9}.hero-actions{display:flex;align-items:center;gap:20px;margin-top:26px}.primary,.text-link{font-size:10px;text-decoration:none}.primary{padding:14px 18px;border-radius:8px;background:#6e5be8;color:#fff;box-shadow:0 6px 14px #6e5be828}.text-link{color:#7c7e8e}.social-proof{display:flex;align-items:center;gap:10px;margin-top:31px;color:#9697a4;font-size:9px}.social-proof b{color:#4e5060}.avatars{display:flex}.avatars i{display:grid;place-items:center;width:24px;height:24px;margin-right:-6px;border:2px solid #fbfaf8;border-radius:50%;background:#d8d2ff;color:#5148a3;font-size:7px;font-style:normal}.avatars i:nth-child(2){background:#d3e8df;color:#3e755e}.avatars i:nth-child(3){background:#f5dfcd;color:#985e32}.saas-visual{padding:22px;border:1px solid #eceaf7;border-radius:15px;background:#fff;box-shadow:0 20px 60px #2d27500d;transform:rotate(1deg)}.visual-top,.visual-footer{display:flex;align-items:center;justify-content:space-between;color:#7a7d8d;font-size:10px}.live{color:#2caa82;font-size:8px}.visual-number{margin:17px 0 9px;font-size:33px;font-weight:750;letter-spacing:-.05em}.visual-number small{margin-left:7px;padding:4px 6px;border-radius:5px;background:#e8f8f2;color:#219a73;font-size:9px;letter-spacing:0}.chart{display:flex;align-items:end;gap:10px;height:155px;padding:12px 0;border-bottom:1px solid #f0f0f5;background:repeating-linear-gradient(to bottom,transparent 0,transparent 37px,#f1f1f7 38px)}.chart i{flex:1;border-radius:4px 4px 0 0;background:linear-gradient(180deg,#998cf5,#d7d2ff)}.chart i:nth-child(2n){background:linear-gradient(180deg,#bcb3fc,#e3dfff)}.visual-footer{margin-top:14px}.visual-footer b{color:#46495a}.saas-features,.pricing{max-width:1100px;margin:auto;padding:0 30px 78px;text-align:center}.saas-features h2,.pricing h2{margin:9px 0 28px;font-size:27px;letter-spacing:-.05em}.feature-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px;text-align:left}.feature-grid article{padding:21px;border:1px solid #eeedf3;border-radius:11px;background:#fff}.feature-grid article>span{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;background:#f0edff;color:#7362e6;font-size:17px}.feature-grid h3{margin:19px 0 8px;font-size:13px}.feature-grid p{margin:0;color:#878998;font-size:10px;line-height:1.8}.pricing{padding-bottom:80px}.price-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;max-width:660px;margin:auto;text-align:left}.price-grid article{padding:22px;border:1px solid #e8e7ef;border-radius:13px;background:#fff}.price-grid article>p{color:#8c8b9d;font-size:9px;letter-spacing:.15em}.price-grid h3{font-size:15px}.price-grid article>b{display:block;margin:14px 0;font-size:27px}.price-grid small{color:#888b98;font-size:9px;font-weight:400}.price-grid ul{padding-left:17px;color:#737686;font-size:10px;line-height:2.2}.price-grid a{display:block;margin-top:18px;padding:12px;border:1px solid #e6e4f1;border-radius:8px;color:#6e5be8;text-align:center;text-decoration:none;font-size:10px}.price-grid .featured{border-color:#bfb6ff;box-shadow:0 10px 30px #6554df12}.price-grid .featured a{background:#6e5be8;color:#fff}.saas-bottom{padding:58px 20px;text-align:center;background:#f0edff}.saas-bottom>span{color:#8a7ce8;font-size:9px;letter-spacing:.17em}.saas-bottom h2{font-size:34px;letter-spacing:-.05em;line-height:1.25}.saas-bottom a{display:inline-block;padding:12px 16px;border-radius:8px;background:#6e5be8;color:#fff;text-decoration:none;font-size:10px}footer{display:flex;justify-content:space-between;padding:25px 6%;color:#9293a0;font-size:9px;letter-spacing:.1em}footer span{letter-spacing:0}@media(max-width:760px){.saas-nav{height:64px;padding:0 16px}.saas-nav nav{display:none}.saas-hero{grid-template-columns:1fr;gap:28px;padding:56px 18px}.hero-copy h1{font-size:43px}.saas-visual{transform:none}.saas-features,.pricing{padding:0 18px 50px}.feature-grid{grid-template-columns:1fr}.price-grid{grid-template-columns:1fr}.saas-features h2,.pricing h2{font-size:23px}.saas-bottom h2{font-size:29px}footer{padding:22px 16px;gap:12px;flex-wrap:wrap}}`
      },
      {
        path: "src/main.js",
        language: "javascript",
        content: `document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});`
      }
    ];
  }

  return starterFiles.map((file) => ({ ...file }));
}


function readProjects(): DesignProject[] {
  try {
    const raw = window.localStorage.getItem(PROJECT_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is DesignProject =>
      Boolean(item && typeof item.id === "string" && typeof item.name === "string" && Array.isArray(item.files))
    );
  } catch {
    return [];
  }
}

function writeProjects(projects: DesignProject[]): void {
  try {
    window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(projects));
  } catch {
    throw new Error("无法保存项目到本机存储。请检查浏览器存储空间或隐私设置。");
  }
}

export function listProjects(): DesignProject[] {
  return readProjects().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getProject(id: string): DesignProject | undefined {
  return readProjects().find((project) => project.id === id);
}

export function createProject(prompt: string, name?: string): DesignProject {
  const trimmed = prompt.trim();
  const projectName = (name?.trim() || trimmed.slice(0, 36) || "未命名设计项目").replace(/[\r\n\t]+/g, " ");
  const now = new Date().toISOString();
  const project: DesignProject = {
    id: crypto.randomUUID(),
    name: projectName.length > 48 ? projectName.slice(0, 48) + "…" : projectName,
    prompt: trimmed,
    files: filesForProject(projectName, trimmed),
    createdAt: now,
    updatedAt: now,
    status: "draft",
  };
  writeProjects([project, ...readProjects()]);
  return project;
}

export function updateProject(project: DesignProject): DesignProject {
  const updated = { ...project, updatedAt: new Date().toISOString() };
  const projects = readProjects();
  const index = projects.findIndex((item) => item.id === project.id);
  if (index < 0) projects.unshift(updated);
  else projects[index] = updated;
  writeProjects(projects);
  return updated;
}

export function removeProject(id: string): void {
  writeProjects(readProjects().filter((project) => project.id !== id));
  localStorage.removeItem(`designbuddy.conversation.v1.${id}`);
  sessionStorage.removeItem(`designbuddy.conversation.pending.${id}`);
}
