/* DesignBuddy 图标系统 v2 · 墨白
 *
 * 统一规范
 *   网格    24 × 24，安全区 2.9 – 21.1（光学居中）
 *   描边    1.8（默认）／2.2（≤13px 小图标，用 .ic-xs 覆盖）
 *   端点    round cap / round join，转角半径随描边自然圆化
 *   风格    单色线性 + 极少量实心点（调色板颜料、三更多点、表情眼睛）
 *   颜色    一律 currentColor，可在任意上下文继承文字色
 *
 * 用法
 *   <svg class="ic" width="16" height="16" viewBox="0 0 24 24"><use href="#i-search"></use></svg>
 *   <svg class="ic ic-xs" ...>…</svg>           小尺寸加粗描边
 *   icons.html 是可视化的图标总览页，新增图标请同时更新 ICON_GROUPS。
 */
(function () {
  'use strict'

  var I = {
    /* ——— 图标栏 ——— */
    home: '<path d="M4.2 10.6 12 4l7.8 6.6v7.7a1.7 1.7 0 0 1-1.7 1.7h-3.3v-5.7H9.2V20H5.9a1.7 1.7 0 0 1-1.7-1.7z"/>',
    library: '<rect x="3.9" y="4.9" width="4" height="14.2" rx="1.5"/><rect x="10" y="4.9" width="4" height="14.2" rx="1.5"/><rect x="16.1" y="8.1" width="4" height="11" rx="1.5"/>',
    templates: '<rect x="3.6" y="4.6" width="16.8" height="14.8" rx="2.6"/><path d="M3.6 9.5h16.8M9.7 9.5v9.9"/>',
    theme: '<path d="M12 3.6c-4.7 0-8.4 3.7-8.4 8.4s3.7 8.4 8.4 8.4c1.3 0 2.2-.9 2.2-2.1 0-.6-.2-1-.5-1.4-.3-.4-.4-.7-.4-1.1 0-1.2 1-2.1 2.2-2.1h1.4c2.4 0 4.3-1.9 4.3-4.3 0-3.3-4-5.8-9.2-5.8z"/><circle cx="8.5" cy="10.7" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="8.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="10.7" r="1.1" fill="currentColor" stroke="none"/><circle cx="9.3" cy="14.7" r="1.1" fill="currentColor" stroke="none"/>',
    settings: '<path d="M9.75 5.48L10.40 2.94L13.60 2.94L14.25 5.48C14.51 5.57 14.77 5.68 15.02 5.80L17.28 4.46L19.54 6.72L18.20 8.98C18.32 9.23 18.43 9.49 18.52 9.75L21.06 10.40L21.06 13.60L18.52 14.25C18.43 14.51 18.32 14.77 18.20 15.02L19.54 17.28L17.28 19.54L15.02 18.20C14.77 18.32 14.51 18.43 14.25 18.52L13.60 21.06L10.40 21.06L9.75 18.52C9.49 18.43 9.23 18.32 8.98 18.20L6.72 19.54L4.46 17.28L5.80 15.02C5.68 14.77 5.57 14.51 5.48 14.25L2.94 13.60L2.94 10.40L5.48 9.75C5.57 9.49 5.68 9.23 5.80 8.98L4.46 6.72L6.72 4.46L8.98 5.80C9.23 5.68 9.49 5.57 9.75 5.48Z"/><circle cx="12" cy="12" r="3.1"/>',
    more: '<circle cx="5.4" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="18.6" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
    'user-plus': '<circle cx="9.6" cy="8.4" r="3.4"/><path d="M3.7 19.3c.8-3.3 3.1-5.1 5.9-5.1s5.1 1.8 5.9 5.1"/><path d="M18.4 6.3v4.8M20.8 8.7h-4.8"/>',
    feedback: '<path d="M20.4 12.3a2.8 2.8 0 0 1-2.8 2.8h-7.9l-4.5 3.3v-3.3h-.4a2.8 2.8 0 0 1-2.8-2.8V7.2a2.8 2.8 0 0 1 2.8-2.8h12.8a2.8 2.8 0 0 1 2.8 2.8z"/>',

    /* ——— 方向与基础 ——— */
    'chevron-down': '<path d="m6.4 9.4 5.6 5.6 5.6-5.6"/>',
    'chevron-up': '<path d="m6.4 14.6 5.6-5.6 5.6 5.6"/>',
    'chevron-left': '<path d="m14.6 6.4-5.6 5.6 5.6 5.6"/>',
    'chevron-right': '<path d="m9.4 6.4 5.6 5.6-5.6 5.6"/>',
    plus: '<path d="M12 5.4v13.2M5.4 12h13.2"/>',
    close: '<path d="m6.6 6.6 10.8 10.8M17.4 6.6 6.6 17.4"/>',
    search: '<circle cx="10.7" cy="10.7" r="6.5"/><path d="m15.5 15.5 4.2 4.2"/>',
    filter: '<path d="M4.4 5.4h15.2l-5.9 7v5.6l-3.4 1.7v-7.3z"/>',
    sort: '<path d="M7.6 5.6v12.2M4.6 14.8l3 3 3-3M16.4 18.4V6.2M13.4 9.2l3-3 3 3"/>',
    refresh: '<path d="M20.2 12a8.2 8.2 0 1 1-2.4-5.8"/><path d="M20.4 4.3v4.7h-4.7"/>',
    check: '<path d="m5.2 12.5 4.6 4.6L18.9 7.6"/>',
    square: '<rect x="4.2" y="4.2" width="15.6" height="15.6" rx="3.4"/>',
    'arrow-left': '<path d="M19.4 12H5.2"/><path d="m11.1 5.8-6 6.2 6 6.2"/>',
    send: '<path d="M20.5 4.1 4.1 10.8a.6.6 0 0 0 .1 1.1l6.1 2.2 2.2 6.1a.6.6 0 0 0 1.1.1z"/><path d="M20.5 4.1 10.3 14.1"/>',
    upload: '<path d="M12 15.3V4.1"/><path d="m7.7 8.5 4.3-4.4 4.3 4.4"/><path d="M4.7 15.9v3.1a1.7 1.7 0 0 0 1.7 1.7h11.2a1.7 1.7 0 0 0 1.7-1.7v-3.1"/>',
    import: '<path d="M12 4.1v11.2"/><path d="m7.7 11.1 4.3 4.4 4.3-4.4"/><path d="M4.7 15.9v3.1a1.7 1.7 0 0 0 1.7 1.7h11.2a1.7 1.7 0 0 0 1.7-1.7v-3.1"/>',
    paperclip: '<path d="M18.4 10.6 11.7 17.3a4.2 4.2 0 1 1-5.9-5.9l6.9-6.9a2.8 2.8 0 0 1 4 4l-6.9 6.9a1.4 1.4 0 0 1-2-2l6.2-6.2"/>',
    link: '<path d="M9.9 14.1a3.9 3.9 0 0 0 5.5 0l2.4-2.4a3.9 3.9 0 0 0-5.5-5.5l-1.3 1.3"/><path d="M14.1 9.9a3.9 3.9 0 0 0-5.5 0l-2.4 2.4a3.9 3.9 0 0 0 5.5 5.5l1.3-1.3"/>',
    pen: '<path d="M4.6 19.4h3.3L19.1 8.2a2.4 2.4 0 0 0-3.3-3.3L4.6 16.1z"/><path d="m14.3 6.4 3.3 3.3"/>',
    wand: '<path d="M4.8 19.2 13.7 10.3"/><path d="m17 4.6 1.1 3 3 1.1-3 1.1-1.1 3-1.1-3-3-1.1 3-1.1z"/>',
    eraser: '<g transform="rotate(-45 12 12)"><rect x="4.7" y="7.4" width="14.6" height="9.2" rx="2.6"/><path d="M11.9 7.4v9.2"/></g>',
    sliders: '<path d="M4 7.6h4.6M13 7.6h7M4 16.4h7M15.4 16.4h4.6"/><circle cx="11" cy="7.6" r="2.3"/><circle cx="13.4" cy="16.4" r="2.3"/>',
    sparkle: '<path d="m12 3.6 1.9 5.1 5.1 1.9-5.1 1.9-1.9 5.1-1.9-5.1L5 10.6l5.1-1.9z"/><path d="m17.9 15.3.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z"/>',
    'sparkle-solid': '<path d="m12 3.1 2.3 6.2 6.2 2.3-6.2 2.3L12 20.1l-2.3-6.2L3.5 11.6l6.2-2.3z" fill="currentColor" stroke="none"/>',

    /* ——— 导航与容器 ——— */
    folder: '<path d="M3.6 7.4a2 2 0 0 1 2-2h3.1a2 2 0 0 1 1.6.8l1.1 1.4h6.9a2 2 0 0 1 2 2v7.6a2 2 0 0 1-2 2H5.6a2 2 0 0 1-2-2z"/>',
    message: '<path d="M20.2 12.2a2.7 2.7 0 0 1-2.7 2.7h-7.7l-4.4 3.2v-3.2h-.3a2.7 2.7 0 0 1-2.7-2.7V7.3A2.7 2.7 0 0 1 5.1 4.6h12.4a2.7 2.7 0 0 1 2.7 2.7z"/><path d="M8.2 8.6h7.6M8.2 11.8h4.8"/>',
    panel: '<rect x="3.6" y="4.6" width="16.8" height="14.8" rx="2.6"/><path d="M9.7 4.6v14.8"/>',
    users: '<circle cx="9.3" cy="8.7" r="3.3"/><path d="M3.5 19.4c.6-3.2 2.9-5.1 5.8-5.1s5.2 1.9 5.8 5.1"/><circle cx="16.9" cy="9.7" r="2.4"/><path d="M15.9 15c2.5.3 4.1 1.9 4.6 4.4"/>',
    globe: '<circle cx="12" cy="12" r="8.2"/><path d="M3.9 12h16.2"/><path d="M12 3.8c2.4 2.3 3.6 5 3.6 8.2s-1.2 5.9-3.6 8.2c-2.4-2.3-3.6-5-3.6-8.2S9.6 6.1 12 3.8z"/>',
    code: '<path d="m9.3 8.3-4 3.7 4 3.7M14.7 8.3l4 3.7-4 3.7"/>',
    trash: '<path d="M4.4 7.3h15.2"/><path d="M9.4 7.3V5.7A1.7 1.7 0 0 1 11.1 4h1.8a1.7 1.7 0 0 1 1.7 1.7v1.6"/><path d="M6.4 7.3l.8 11.1a2 2 0 0 0 2 1.9h5.6a2 2 0 0 0 2-1.9l.8-11.1"/><path d="M10.3 11v5.4M13.7 11v5.4"/>',
    archive: '<rect x="3.6" y="4.8" width="16.8" height="4.5" rx="1.7"/><path d="M5.3 9.3v8.2a2 2 0 0 0 2 2h9.4a2 2 0 0 0 2-2V9.3"/><path d="M9.7 13h4.6"/>',
    clock: '<circle cx="12" cy="12" r="8.2"/><path d="M12 7.4V12l3.2 1.9"/>',
    user: '<circle cx="12" cy="8.4" r="3.4"/><path d="M4.7 19.4c.9-3.4 3.6-5.2 7.3-5.2s6.4 1.8 7.3 5.2"/>',
    apps: '<rect x="4.2" y="4.2" width="6.6" height="6.6" rx="1.9"/><rect x="13.2" y="4.2" width="6.6" height="6.6" rx="1.9"/><rect x="4.2" y="13.2" width="6.6" height="6.6" rx="1.9"/><rect x="13.2" y="13.2" width="6.6" height="6.6" rx="1.9"/>',
    grid: '<rect x="3.7" y="4.2" width="7" height="15.6" rx="2.2"/><rect x="13.3" y="4.2" width="7" height="7" rx="2.2"/><rect x="13.3" y="13.4" width="7" height="6.4" rx="2.2"/>',
    icons: '<rect x="4" y="4.4" width="6.4" height="6.4" rx="2"/><circle cx="16.4" cy="7.6" r="3.2"/><path d="m7.2 12.5 3.7 6.4H3.5z"/><rect x="13.2" y="13.2" width="6.4" height="6.4" rx="1.7"/>',
    layers: '<path d="m12 3.6 8.2 4.4L12 12.4 3.8 8z"/><path d="m3.8 12.2 8.2 4.4 8.2-4.4"/><path d="m3.8 16.2 8.2 4.4 8.2-4.4"/>',
    compass: '<circle cx="12" cy="12" r="8.2"/><path d="m15.7 8.3-2.1 5.3-5.3 2.1 2.1-5.3z"/>',
    layout: '<rect x="3.7" y="3.7" width="7" height="7" rx="2.2"/><rect x="13.3" y="3.7" width="7" height="4.8" rx="2.2"/><rect x="3.7" y="13.3" width="7" height="7" rx="2.2"/><rect x="13.3" y="10.8" width="7" height="9.5" rx="2.2"/>',
    list: '<path d="M9 6.9h11.2M9 12h11.2M9 17.1h11.2"/><circle cx="4.9" cy="6.9" r="1.1" fill="currentColor" stroke="none"/><circle cx="4.9" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="4.9" cy="17.1" r="1.1" fill="currentColor" stroke="none"/>',
    'dots-vertical': '<circle cx="12" cy="5.8" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="18.2" r="1.7" fill="currentColor" stroke="none"/>',
    circle: '<circle cx="12" cy="12" r="7.8"/>',
    shapes: '<path d="M12 4.2v15.6M4.2 12h15.6M6.6 6.6l10.8 10.8M17.4 6.6 6.6 17.4"/>',

    /* ——— 内容类型 ——— */
    image: '<rect x="3.6" y="5" width="16.8" height="14" rx="2.7"/><circle cx="8.7" cy="10" r="1.5"/><path d="m5.2 17.9 3.9-3.9a1.9 1.9 0 0 1 2.7 0l3 3 1.2-1.2a1.9 1.9 0 0 1 2.7 0l1.1 1.1"/>',
    presentation: '<rect x="3.4" y="4.6" width="17.2" height="11.4" rx="2.1"/><path d="M12 16v3.4M8.4 19.9h7.2"/>',
    doc: '<path d="M6.2 5.4a1.8 1.8 0 0 1 1.8-1.8h5.4l4.4 4.4v10.6a1.8 1.8 0 0 1-1.8 1.8H8a1.8 1.8 0 0 1-1.8-1.8z"/><path d="M13.2 3.8v4.4h4.4"/><path d="M9.2 12.6h5.6M9.2 16h3.8"/>',
    phone: '<rect x="6.9" y="3.4" width="10.2" height="17.2" rx="2.7"/><path d="M10.6 18h2.8"/>',
    carousel: '<rect x="3.6" y="5.4" width="13.4" height="13.2" rx="2.8"/><path d="M19.6 8.6v6.8"/><path d="M7.2 9.8h6.2M7.2 13h4.2"/>',

    /* ——— 专家 / 技能 / 连接器 ——— */
    face: '<circle cx="12" cy="12" r="8.4"/><circle cx="9.2" cy="10.5" r="1" fill="currentColor" stroke="none"/><circle cx="14.8" cy="10.5" r="1" fill="currentColor" stroke="none"/><path d="M8.7 14.4a4.3 4.3 0 0 0 6.6 0"/>',
    brain: '<path d="M9.4 5.2a3 3 0 0 0-4 2.9 3.1 3.1 0 0 0-1 5.4 3.2 3.2 0 0 0 2.6 5.3 3 3 0 0 0 3 2.2h1.4V5.2z"/><path d="M14.6 5.2a3 3 0 0 1 4 2.9 3.1 3.1 0 0 1 1 5.4 3.2 3.2 0 0 1-2.6 5.3 3 3 0 0 1-3 2.2h-1.4V5.2z"/>',
    robot: '<rect x="4.2" y="7.9" width="15.6" height="11.5" rx="3.6"/><path d="M12 4.2v3.7"/><circle cx="12" cy="3" r="1.1" fill="currentColor" stroke="none"/><circle cx="9.2" cy="12.9" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.8" cy="12.9" r="1.1" fill="currentColor" stroke="none"/><path d="M9.6 16.2h4.8"/>',
    cube: '<path d="m12 3.4 8.2 4.3v8.6L12 20.6l-8.2-4.3V7.7z"/><path d="m3.8 7.7 8.2 4.3 8.2-4.3M12 12v8.6"/>',
    life: '<circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="3.6"/><path d="m6.2 6.2 3.3 3.3M17.8 6.2l-3.3 3.3M6.2 17.8l3.3-3.3M17.8 17.8l-3.3-3.3"/>',
    plug: '<path d="M9 3.6v5M15 3.6v5"/><path d="M6.4 8.6h11.2v3a5.6 5.6 0 0 1-11.2 0z"/><path d="M12 17.2v3.2"/>',
    tool: '<path d="M15.1 4.6a5.1 5.1 0 0 0-6 7.1l-4.5 4.6a2.1 2.1 0 0 0 3 3l4.6-4.6a5.1 5.1 0 0 0 7.1-5.9l-3.1 3.1-2.5-2.5z"/>',
    bolt: '<path d="M13.6 3.4 6.2 13.6h4.8l-1.4 7 7.4-10.2h-4.8z"/>',
    download: '<path d="M12 4.4v10.4"/><path d="m7.6 10.6 4.4 4.4 4.4-4.4"/><path d="M4.8 19.6h14.4"/>',
    mail: '<rect x="3.4" y="5.2" width="17.2" height="13.6" rx="2.8"/><path d="m4.8 7.6 6.2 4.6a1.9 1.9 0 0 0 2 0l6.2-4.6"/>',
    video: '<rect x="3.4" y="6" width="12.8" height="12" rx="2.8"/><path d="m16.2 10.4 4.4-2.6v8.4l-4.4-2.6z"/>',
    form: '<rect x="3.8" y="4.2" width="16.4" height="15.6" rx="2.8"/><path d="m7.6 9.6 1.5 1.5 2.5-2.5M7.6 15.4l1.5 1.5 2.5-2.5"/><path d="M14 10.4h2.8M14 16.2h2.8"/>',
    task: '<path d="m3.6 6.6 1.6 1.6 2.6-2.6M3.6 12.2l1.6 1.6 2.6-2.6M3.6 17.8l1.6 1.6 2.6-2.6"/><path d="M11.4 7h9M11.4 12.6h9M11.4 18.2h9"/>',
    book: '<path d="M12 6.3C10.3 4.9 8.1 4.3 5.3 4.5a1.2 1.2 0 0 0-1.1 1.2v11.4a1 1 0 0 0 1.1 1c2.6-.1 4.7.5 6.7 1.9 1.9-1.4 4.1-2 6.7-1.9a1 1 0 0 0 1.1-1V5.7a1.2 1.2 0 0 0-1.1-1.2c-2.8-.2-5 .4-6.7 1.8z"/><path d="M12 6.5v13.6"/>',
    terminal: '<rect x="3.4" y="4.6" width="17.2" height="14.8" rx="2.8"/><path d="m7.6 9.8 2.9 2.5-2.9 2.5M12.8 15h4"/>',
    cart: '<path d="M3.4 4.4h2.2l2.5 10.3a1.7 1.7 0 0 0 1.7 1.3h7.7a1.7 1.7 0 0 0 1.7-1.3l1.5-6.4H6.5"/><circle cx="9.6" cy="19.2" r="1.5"/><circle cx="16.8" cy="19.2" r="1.5"/>',
    trend: '<path d="M4 16.8 9.6 11l3.6 3.6L20 7.4"/><path d="M15 7.4h5v5"/>',
    barchart: '<path d="M4 20h16"/><path d="M7.4 16.6V11M12 16.6V5.8M16.6 16.6v-3.4"/>',
    scale: '<path d="M12 4.8v14.4M6.8 19.4h10.4M5.2 7.4h13.6"/><path d="M5.2 7.4 2.6 13.2a2.9 2.9 0 0 0 5.2 0z"/><path d="M18.8 7.4l2.6 5.8a2.9 2.9 0 0 1-5.2 0z"/>',
    storefront: '<path d="M4.2 9.4v9.2a1.6 1.6 0 0 0 1.6 1.6h12.4a1.6 1.6 0 0 0 1.6-1.6V9.4"/><path d="M3.2 9.4 4.9 4.6h14.2l1.7 4.8a2.7 2.7 0 0 1-5.4 0 2.7 2.7 0 0 1-5.4 0 2.7 2.7 0 0 1-5.4 0z"/><path d="M10.2 20.2v-4.4h3.6v4.4"/>',
    db: '<ellipse cx="12" cy="6.3" rx="7.4" ry="2.9"/><path d="M4.6 6.3v11.4c0 1.6 3.3 2.9 7.4 2.9s7.4-1.3 7.4-2.9V6.3"/><path d="M4.6 12c0 1.6 3.3 2.9 7.4 2.9s7.4-1.3 7.4-2.9"/>',

    /* ——— 编辑器 / 设置 ——— */
    font: '<path d="M5.5 19.4 11 5.6a1.1 1.1 0 0 1 2 0l5.5 13.8"/><path d="M7.9 14.2h8.2"/>',
    text: '<path d="M5.4 6.4V5.1h13.2v1.3M12 5.2v13.7M9.3 18.9h5.4"/>',
    card: '<rect x="3.4" y="5.4" width="17.2" height="13.2" rx="2.8"/><path d="M3.4 10h17.2"/><path d="M6.9 14.4h3.2"/>',
    keyboard: '<rect x="3" y="6.6" width="18" height="10.8" rx="2.5"/><path d="M6.6 10h.01M9.9 10h.01M13.2 10h.01M16.5 10h.01M7.6 14h8.8"/>',
    help: '<circle cx="12" cy="12" r="8.4"/><path d="M9.7 9.9a2.3 2.3 0 1 1 3.1 2.2c-.6.25-.9.75-.9 1.35v.3"/><circle cx="12" cy="16.6" r=".9" fill="currentColor" stroke="none"/>',
    command: '<rect x="3.6" y="4.6" width="16.8" height="14.8" rx="2.7"/><path d="m7.6 9.6 3 2.5-3 2.5M12.6 15h4"/>',
    microphone: '<rect x="9.4" y="3.4" width="5.2" height="10.2" rx="2.6"/><path d="M5.8 11.4a6.2 6.2 0 0 0 12.4 0"/><path d="M12 17.6V20.4"/>'
  }

  /* 图标总览页分组（icons.html 用） */
  var GROUPS = [
    ['图标栏', ['home', 'library', 'templates', 'theme', 'settings', 'more', 'user-plus', 'feedback']],
    ['方向与基础', ['chevron-down', 'chevron-up', 'chevron-left', 'chevron-right', 'plus', 'close', 'search', 'filter', 'sort', 'refresh', 'check', 'square', 'arrow-left', 'send']],
    ['操作', ['upload', 'import', 'paperclip', 'link', 'pen', 'wand', 'eraser', 'sparkle', 'sparkle-solid']],
    ['导航与容器', ['folder', 'message', 'panel', 'users', 'globe', 'code', 'trash', 'archive', 'clock', 'user', 'apps', 'grid', 'icons', 'layers', 'compass', 'layout', 'list', 'dots-vertical', 'circle', 'shapes']],
    ['内容类型', ['image', 'presentation', 'doc', 'phone', 'carousel']],
    ['专家 · 技能 · 连接器', ['face', 'brain', 'robot', 'cube', 'life', 'plug', 'db', 'tool', 'bolt', 'download']],
    ['分类与场景', ['cart', 'trend', 'barchart', 'scale', 'storefront', 'book', 'mail', 'video', 'form', 'task', 'terminal']],
    ['编辑器与设置', ['font', 'text', 'card', 'keyboard', 'command', 'microphone', 'help']]
  ]

  function buildSprite () {
    if (typeof document === 'undefined') return null
    var host = document.getElementById('db-icons')
    if (host) return host
    var NS = 'http://www.w3.org/2000/svg'
    host = document.createElementNS(NS, 'svg')
    host.setAttribute('id', 'db-icons')
    host.setAttribute('aria-hidden', 'true')
    host.setAttribute('focusable', 'false')
    host.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden')
    var parts = []
    for (var name in I) {
      if (!Object.prototype.hasOwnProperty.call(I, name)) continue
      parts.push('<symbol id="i-' + name + '" viewBox="0 0 24 24">' + I[name] + '</symbol>')
    }
    host.innerHTML = parts.join('')
    ;(document.body || document.documentElement).insertBefore(host, document.body ? document.body.firstChild : null)
    return host
  }

  if (typeof window !== 'undefined') {
    window.DB_ICONS = I
    window.DB_ICON_GROUPS = GROUPS
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildSprite)
    else buildSprite()
    buildSprite()
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { icons: I, groups: GROUPS }
})()
