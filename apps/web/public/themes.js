/* 主题预设：舞台 / 幻灯片 / 墨色 / 正文 / 强调色。
 *
 * 后端 core.library 也读这一份（`library.themes`），所以主题目录是「一处定义、
 * 两边使用」，不再只是 index.html 里的一个常量。
 */
export const THEMES = [
  { name: 'Pearl', stage: '#e9e9f1', slide: '#f9f9fd', ink: '#1a1a23', body: '#33333d', link: '#2b4bd8' },
  { name: 'Vortex', stage: '#181819', slide: '#090909', ink: '#ededee', body: '#b7b7bd', link: '#8fb0ff' },
  { name: 'Clementa', stage: '#d9c1a1', slide: '#f9efd7', ink: '#492117', body: '#5a4630', link: '#c2622a' },
  { name: 'Stratos', stage: 'radial-gradient(ellipse at 26% 96%,#3a2b6d 0%,rgba(58,43,109,0) 62%),linear-gradient(160deg,#14141c,#08080d)', slide: '#11141f', ink: '#f0f3f9', body: '#a9b4cc', link: '#7ea6ff' },
  { name: 'Nova', stage: 'linear-gradient(150deg,#e2eefc 0%,#a8ccf2 34%,#7fb0e6 58%,#d6e6fa 100%)', slide: '#ffffff', ink: '#16365c', body: '#3c5578', link: '#2b6fd8' },
  { name: 'Twilight', stage: 'linear-gradient(150deg,#f2cfdc 0%,#d9b8e6 52%,#b9cbe6 100%)', slide: '#fff9f5', ink: '#425e76', body: '#5c7186', link: '#c76a9a' },
  { name: 'Coral Glow', stage: '#e7b2bd', slide: '#ffffff', ink: '#914a56', body: '#7d4a52', link: '#c04a68' },
  { name: 'Mercury', stage: 'linear-gradient(150deg,#c3d5e6,#7d8fa9 62%,#9fb2c6)', slide: '#ffffff', ink: '#414348', body: '#5c5f66', link: '#2b5bd8' },
  { name: 'Ashrose', stage: 'linear-gradient(150deg,#d3c8cd,#a9a4ae 58%,#e7dfe2)', slide: '#ffffff', ink: '#6d6d6d', body: '#7b7377', link: '#a86b86' },
  { name: 'Spectrum', stage: 'linear-gradient(115deg,#ffd9e8 0%,#e6e4ff 26%,#d6f4ff 52%,#dcffe9 74%,#fff3d0 100%)', slide: '#eaf2f8', ink: '#3764f1', body: '#2f3f60', link: '#3764f1' },
  { name: 'Chisel', stage: '#f6f1ee', slide: '#ffffff', ink: '#1d1a17', body: '#46403a', link: '#8a6a3a' },
  { name: 'Stardust', stage: '#050505', slide: '#0a0a0a', ink: '#ffffff', body: '#f0a35e', link: '#f0a35e' },
  { name: 'Seafoam', stage: '#d0f3eb', slide: '#ffffff', ink: '#2d3765', body: '#46527f', link: '#2d6fb8' },
  { name: 'Nebulae', stage: 'radial-gradient(ellipse at 74% 24%,#241551 0%,rgba(36,21,81,0) 62%),linear-gradient(160deg,#0d0a16,#05050a)', slide: '#0b0b0f', ink: '#ffffff', body: '#cdd6ff', link: '#70edff' },
  { name: 'Creme', stage: '#d8c8b3', slide: '#f8f5ee', ink: '#3f3a30', body: '#55503f', link: '#8a6a3a' },
  { name: 'Lux', stage: '#1a3a39', slide: '#132d2c', ink: '#ffffff', body: '#ffd4b6', link: '#ffd4b6' },
  { name: 'Consultant', stage: '#eeeeef', slide: '#ffffff', ink: '#15283e', body: '#3c4a5c', link: '#2b4bd8' },
  { name: 'Marine', stage: 'radial-gradient(ellipse at 84% 12%,#2b3b8f 0%,rgba(43,59,143,0) 62%),linear-gradient(160deg,#12193a,#080c1e)', slide: '#0c1022', ink: '#ffffff', body: '#b9c4e6', link: '#8aa6ff' },
]
