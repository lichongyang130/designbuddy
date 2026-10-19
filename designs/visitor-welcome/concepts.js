window.WELCOME_CONCEPTS = [
 {id:1,name:'经典留白',tag:'最贴近参考',category:'经典',title:'欢迎使用 DesignBuddy',desc:'让灵感变成设计。',eyebrow:'WELCOME TO YOUR CREATIVE SPACE',note:'保留参考图的左右对半、大留白和单一主入口。'},
 {id:2,name:'暖白书页',tag:'',category:'经典',title:'把灵感，<br>写成下一页。',desc:'从一个想法开始，选择你的创作方式。',eyebrow:'A NEW CHAPTER IN DESIGN',note:'奶油纸色、拱形画框与左对齐排版，温暖而安静。'},
 {id:3,name:'暗夜画廊',tag:'深色方向',category:'沉浸',title:'好设计，<br>不止于想象。',desc:'打开你的创作空间，让下一个想法发生。',eyebrow:'DESIGN BEYOND THE ORDINARY',note:'炭黑界面与荧光绿按钮，突出画作与登录入口。'},
 {id:4,name:'苔绿工作室',tag:'',category:'艺术',title:'在这里，<br>遇见新灵感。',desc:'给想法一点空间，给创作一个开始。',eyebrow:'MAKE ROOM FOR IDEAS',note:'画作左置、柔绿底色、自然拱形，形成亲近的工作室气质。'},
 {id:5,name:'紫色灵感',tag:'',category:'艺术',title:'让想象，<br>自由生长。',desc:'从灵感的第一步，到属于你的设计表达。',eyebrow:'A SPACE FOR YOUR NEXT IDEA',note:'淡紫渐变与倾斜白色画框，让第一次见面更轻盈。'},
 {id:6,name:'编辑部',tag:'',category:'经典',title:'灵感，<br>从此发生。',desc:'你的下一个设计故事，从这里开始。',eyebrow:'THE CREATIVE EDITION / 2026',note:'大字标题、锐利分栏与满版画作，强调编辑式品牌表达。'},
 {id:7,name:'沉浸画廊',tag:'',category:'沉浸',title:'把灵感，<br>带进现实。',desc:'在熟悉的画面里，找到新的创作起点。',eyebrow:'YOUR IDEAS, A NEW PERSPECTIVE',note:'全幅艺术背景搭配半透明登录卡片，营造沉浸式欢迎。'},
 {id:8,name:'极简圆窗',tag:'',category:'极简',title:'欢迎来到你的创作空间',desc:'一个想法，就是一个好的开始。',eyebrow:'A LITTLE INSPIRATION',note:'缩小画作至圆形视觉锚点，以中轴布局强化入口效率。'},
 {id:9,name:'横幅展映',tag:'',category:'极简',title:'下一件作品，<br>从这里开始。',desc:'让灵感变成设计。',eyebrow:'THE START OF SOMETHING NEW',note:'上部内容与操作并列，下部宽幅画作，适合大屏欢迎页。'},
 {id:10,name:'创作序章',tag:'',category:'极简',title:'你好，<br>未来的创作者。',desc:'先选择你的方式，再开启新的设计旅程。',eyebrow:'YOUR CREATIVE JOURNEY / 01',note:'左侧窄幅步骤轨道，清晰表达首次访问的引导关系。'},
 {id:11,name:'柔粉拼贴',tag:'',category:'艺术',title:'你的下一件作品，<br>值得一个好开始。',desc:'让灵感在这里汇合，让设计从现在开始。',eyebrow:'SOMETHING BEAUTIFUL STARTS HERE',note:'左侧大画作与独立白卡并置，保留艺术感和操作秩序。'},
 {id:12,name:'朱砂东方',tag:'',category:'艺术',title:'以灵感，<br>开启设计。',desc:'在留白之间，找到属于你的表达。',eyebrow:'留一点空间，给灵感。',note:'米纸底色、朱砂按钮和拱形画框，呈现含蓄的东方气质。'},
 {id:13,name:'蓝图实验室',tag:'',category:'艺术',title:'让好想法，<br>有迹可循。',desc:'从灵感到表达，开启你的设计工作台。',eyebrow:'IDEAS INTO POSSIBILITIES',note:'蓝色网格底纹与理性排版，让艺术与工具感取得平衡。'},
 {id:14,name:'漂浮窗口',tag:'',category:'极简',title:'属于你的，<br>灵感工作台。',desc:'把新的想法，放进新的创作空间。',eyebrow:'A QUIET SPACE TO CREATE',note:'雾蓝桌面中的悬浮双栏卡片，适合独立桌面客户端。'},
 {id:15,name:'柔光主推',tag:'推荐落地',category:'极简',title:'每个好设计，<br>都始于一个想法。',desc:'欢迎来到 DesignBuddy。选择你的方式，从这里开始。',eyebrow:'你的 AI 设计工作台',note:'成熟的产品化布局，主入口明确，自有模型入口独立成卡。'}
];

// Round two: one different new artwork per completed concept. Pending artwork is never substituted with an old or repeated image.
const artLabels=['蓝衣与金色花束','橄榄枝与静物','荧光蜂鸟','苔绿花园','紫色云端建筑','编辑式几何抽象','暮色山湖','金色花朵圆窗','松林湖光','温室序章','柔粉花卉静物','水墨山峦与白鹤','钴蓝立体环与银蓝球','雾蓝海岸灯塔','虹彩丝带与珍珠球体'];
window.WELCOME_CONCEPTS.forEach((c,i)=>{
 c.artState=i<15?'generated':'pending';
 c.art=i<15?'assets/art-'+String(c.id).padStart(2,'0')+'.webp':null;
 c.artLabel=i<15?artLabels[i]:'新主视觉待生成';
 if(i>=15)c.tag='待换图';
 if(c.id===5)c.tag='新图推荐';
});
