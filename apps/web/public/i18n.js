/**
 * 界面语言：以简体中文为源文案，多语言词典 + 即时翻译。
 *
 * 静态文案与设置项走同一份词典；聊天记录、文档抽取结果、代码块不翻译。
 * 每次切换都用首次记录的原值重新翻译，因此可以任意来回切换。
 * 词典按行组织：一行一个源文案，数组顺序与 COLS 对应（新增语言 = 每行加一列）。
 */

/** 可选语言，顺序即设置页下拉框顺序。 */
export const LANGUAGES = [
  { id: 'zh', label: '简体中文', htmlLang: 'zh-CN' },
  { id: 'zh-Hant', label: '繁體中文', htmlLang: 'zh-Hant' },
  { id: 'en', label: 'English', htmlLang: 'en' },
  { id: 'ja', label: '日本語', htmlLang: 'ja' },
  { id: 'ko', label: '한국어', htmlLang: 'ko' },
  { id: 'de', label: 'Deutsch', htmlLang: 'de' },
  { id: 'fr', label: 'Français', htmlLang: 'fr' },
  { id: 'es', label: 'Español', htmlLang: 'es' },
]

/** 词典列顺序：en / zh-Hant / ja / ko / de / fr / es（zh 即源文案，不占列）。 */
const COLS = ['en', 'zh-Hant', 'ja', 'ko', 'de', 'fr', 'es']

const ROWS = {
  // ── 导航 / 工作区 ──
  '专家': ['Experts', '專家', 'エキスパート', '전문가', 'Experten', 'Experts', 'Expertos'],
  '技能': ['Skills', '技能', 'スキル', '스킬', 'Fähigkeiten', 'Compétences', 'Habilidades'],
  '连接器': ['Connectors', '連接器', 'コネクタ', '커넥터', 'Konnektoren', 'Connecteurs', 'Conectores'],
  '我的专家': ['My experts', '我的專家', 'マイエキスパート', '내 전문가', 'Meine Experten', 'Mes experts', 'Mis expertos'],
  '添加技能': ['Add skill', '新增技能', 'スキルを追加', '스킬 추가', 'Fähigkeit hinzufügen', 'Ajouter une compétence', 'Añadir habilidad'],
  '自定义连接器': ['Custom connector', '自訂連接器', 'カスタムコネクタ', '사용자 지정 커넥터', 'Eigener Konnektor', 'Connecteur personnalisé', 'Conector personalizado'],
  '全部': ['All', '全部', 'すべて', '전체', 'Alle', 'Tout', 'Todo'],
  '综合': ['Overall', '綜合', '総合', '종합', 'Gesamt', 'Global', 'General'],
  '最热': ['Popular', '最熱', '人気', '인기', 'Beliebt', 'Populaire', 'Popular'],
  '最新': ['Newest', '最新', '新着', '최신', 'Neueste', 'Récent', 'Reciente'],
  '精选技能': ['Featured skills', '精選技能', '注目のスキル', '추천 스킬', 'Empfohlene Fähigkeiten', 'Compétences en vedette', 'Habilidades destacadas'],
  '换一批': ['Refresh', '換一批', '入れ替え', '새로 고침', 'Neu laden', 'Actualiser', 'Renovar'],
  '推荐': ['Recommended', '推薦', 'おすすめ', '추천', 'Empfohlen', 'Recommandé', 'Recomendado'],
  '套件': ['Suites', '套件', 'スイート', '스위트', 'Suiten', 'Suites', 'Suites'],
  '办公能力': ['Office tools', '辦公能力', 'オフィス機能', '오피스 기능', 'Office-Tools', 'Outils bureautiques', 'Herramientas de oficina'],
  'PPTX 阅读器': ['PPTX reader', 'PPTX 閱讀器', 'PPTX リーダー', 'PPTX 리더', 'PPTX-Leser', 'Lecteur PPTX', 'Lector PPTX'],
  'Word 文档处理': ['Word documents', 'Word 文件處理', 'Word 文書処理', 'Word 문서 처리', 'Word-Dokumente', 'Documents Word', 'Documentos Word'],
  'Word 公式处理': ['Word equations', 'Word 公式處理', 'Word 数式処理', 'Word 수식 처리', 'Word-Formeln', 'Équations Word', 'Ecuaciones Word'],
  'Excel 表格': ['Excel sheets', 'Excel 試算表', 'Excel シート', 'Excel 시트', 'Excel-Tabellen', 'Feuilles Excel', 'Hojas de Excel'],
  'PDF 文本提取': ['PDF text', 'PDF 文字擷取', 'PDF テキスト抽出', 'PDF 텍스트 추출', 'PDF-Text', 'Texte PDF', 'Texto PDF'],
  '更多': ['More', '更多', 'その他', '더보기', 'Mehr', 'Plus', 'Más'],
  '设置': ['Settings', '設定', '設定', '설정', 'Einstellungen', 'Paramètres', 'Ajustes'],
  '模版': ['Templates', '範本', 'テンプレート', '템플릿', 'Vorlagen', 'Modèles', 'Plantillas'],
  '带上您已有的内容': ['Bring what you already have', '帶上您已有的內容', 'お持ちのコンテンツから始める', '이미 가진 콘텐츠로 시작하기', 'Bringen Sie Ihre Inhalte mit', 'Partez de vos contenus', 'Trae tu contenido'],
  '从空白新建': ['Start blank', '從空白新增', '空白から作成', '빈 문서로 시작', 'Leer starten', 'Partir de zéro', 'Empezar en blanco'],
  '创建': ['Create', '建立', '作成', '만들기', 'Erstellen', 'Créer', 'Crear'],
  '升级获得更多 AI 功能': ['Upgrade for more AI', '升級取得更多 AI 功能', 'アップグレードで AI 機能を拡張', '업그레이드하고 AI 기능 더 받기', 'Upgrade für mehr KI', 'Passez à l’offre supérieure pour plus d’IA', 'Mejora para más IA'],
  '使用经典版生成工具': ['Use classic generator', '使用經典版產生工具', 'クラシック版の生成ツールを使う', '클래식 생성 도구 사용', 'Klassischen Generator verwenden', 'Utiliser le générateur classique', 'Usar el generador clásico'],
  '最近的对话记录': ['Recent chats', '最近的對話記錄', '最近のチャット', '최근 대화', 'Letzte Chats', 'Conversations récentes', 'Chats recientes'],
  '最近的 gammas': ['Recent gammas', '最近的 gammas', '最近の gammas', '최근 gammas', 'Letzte Gammas', 'Gammas récents', 'Gammas recientes'],
  '搜索': ['Search', '搜尋', '検索', '검색', 'Suchen', 'Rechercher', 'Buscar'],
  '与您共享': ['Shared with you', '與您共用', '共有アイテム', '공유받은 항목', 'Mit Ihnen geteilt', 'Partagé avec vous', 'Compartido contigo'],
  '网站': ['Websites', '網站', 'ウェブサイト', '웹사이트', 'Websites', 'Sites web', 'Sitios web'],
  'API 生成': ['API generation', 'API 產生', 'API 生成', 'API 생성', 'API-Erstellung', 'Génération d’API', 'Generación de API'],
  '文件夹': ['Folders', '資料夾', 'フォルダー', '폴더', 'Ordner', 'Dossiers', 'Carpetas'],
  '将相关的 gammas 分组，并一次性全部分享。': ['Group related gammas and share them at once.', '將相關的 gammas 分組，並一次全部分享。', '関連する gammas をまとめて一度に共有できます。', '관련 gammas를 묶어 한 번에 공유하세요.', 'Gruppieren Sie ähnliche Gammas und teilen Sie sie auf einmal.', 'Regroupez les gammas associés et partagez-les d’un coup.', 'Agrupa los gammas relacionados y compártelos de una vez.'],
  '创建文件夹': ['Create folder', '建立資料夾', 'フォルダーを作成', '폴더 만들기', 'Ordner erstellen', 'Créer un dossier', 'Crear carpeta'],
  '垃圾箱': ['Trash', '垃圾桶', 'ゴミ箱', '휴지통', 'Papierkorb', 'Corbeille', 'Papelera'],
  '邀请成员': ['Invite members', '邀請成員', 'メンバーを招待', '멤버 초대', 'Mitglieder einladen', 'Inviter des membres', 'Invitar miembros'],
  '推荐模板': ['Recommended templates', '推薦範本', 'おすすめテンプレート', '추천 템플릿', 'Empfohlene Vorlagen', 'Modèles recommandés', 'Plantillas recomendadas'],
  '查看所有模板': ['View all templates', '查看所有範本', 'すべてのテンプレートを見る', '모든 템플릿 보기', 'Alle Vorlagen ansehen', 'Voir tous les modèles', 'Ver todas las plantillas'],
  '演示文稿': ['Slides', '簡報', 'スライド', '슬라이드', 'Folien', 'Diaporama', 'Diapositivas'],
  '文档': ['Document', '文件', 'ドキュメント', '문서', 'Dokument', 'Document', 'Documento'],
  '轮播图': ['Carousel', '輪播圖', 'カルーセル', '캐러셀', 'Karussell', 'Carrousel', 'Carrusel'],
  '图片': ['Image', '圖片', '画像', '이미지', 'Bild', 'Image', 'Imagen'],
  '美化': ['Beautify', '美化', '美化', '미화', 'Verschönern', 'Embellir', 'Embellecer'],
  '导入': ['Import', '匯入', 'インポート', '가져오기', 'Importieren', 'Importer', 'Importar'],
  '示例指令': ['Example prompts', '範例指令', 'プロンプト例', '예시 프롬프트', 'Beispiel-Prompts', 'Exemples de prompts', 'Prompts de ejemplo'],
  '新建': ['New', '新增', '新規', '새로 만들기', 'Neu', 'Nouveau', 'Nuevo'],
  '首页': ['Home', '首頁', 'ホーム', '홈', 'Start', 'Accueil', 'Inicio'],
  '新对话': ['New chat', '新對話', '新しいチャット', '새 대화', 'Neuer Chat', 'Nouvelle conversation', 'Chat nuevo'],
  '返回': ['Back', '返回', '戻る', '뒤로', 'Zurück', 'Retour', 'Atrás'],

  // ── 设置导航 ──
  '功能': ['Features', '功能', '機能', '기능', 'Funktionen', 'Fonctionnalités', 'Funciones'],
  '数据与安全': ['Data & security', '資料與安全', 'データとセキュリティ', '데이터 및 보안', 'Daten & Sicherheit', 'Données et sécurité', 'Datos y seguridad'],
  '个人主页': ['Profile', '個人主頁', 'プロフィール', '프로필', 'Profil', 'Profil', 'Perfil'],
  '套餐与积分': ['Plan & credits', '方案與點數', 'プランとクレジット', '요금제 및 크레딧', 'Tarif & Guthaben', 'Offre et crédits', 'Plan y créditos'],
  '外观': ['Appearance', '外觀', '外観', '화면 표시', 'Darstellung', 'Apparence', 'Apariencia'],
  '快捷键': ['Shortcuts', '快速鍵', 'ショートカット', '단축키', 'Tastenkürzel', 'Raccourcis', 'Atajos'],
  '个性化': ['Personalization', '個人化', 'パーソナライズ', '개인 설정', 'Personalisierung', 'Personnalisation', 'Personalización'],
  '记忆与进化': ['Memory', '記憶與進化', 'メモリ', '메모리', 'Speicher', 'Mémoire', 'Memoria'],
  '智能体': ['Agents', '智慧體', 'エージェント', '에이전트', 'Agenten', 'Agents', 'Agentes'],
  '模型': ['Models', '模型', 'モデル', '모델', 'Modelle', 'Modèles', 'Modelos'],
  '助理': ['Assistant', '助理', 'アシスタント', '어시스턴트', 'Assistent', 'Assistant', 'Asistente'],
  '设备连接': ['Devices', '裝置連線', 'デバイス', '기기 연결', 'Geräte', 'Appareils', 'Dispositivos'],
  '对话流': ['Dialogue', '對話流', '対話フロー', '대화 흐름', 'Dialog', 'Dialogue', 'Diálogo'],
  '数据管理': ['Data', '資料管理', 'データ', '데이터', 'Daten', 'Données', 'Datos'],
  '应用管理': ['Apps', '應用程式管理', 'アプリ', '앱', 'Apps', 'Applications', 'Aplicaciones'],

  // ── 常规 / 权限 ──
  '常规': ['General', '一般', '一般', '일반', 'Allgemein', 'Général', 'General'],
  '通用': ['General', '通用', '共通', '공통', 'Allgemein', 'Général', 'General'],
  '语言': ['Language', '語言', '言語', '언어', 'Sprache', 'Langue', 'Idioma'],
  '界面语言': ['Interface language', '介面語言', '表示言語', '인터페이스 언어', 'Sprache der Oberfläche', 'Langue de l’interface', 'Idioma de la interfaz'],
  '界面文案会立即切换，对话与文档内容保持原样。': ['The interface switches instantly; chats and documents stay as they are.', '介面文案會立即切換，對話與文件內容保持原樣。', '画面の文言はすぐに切り替わります。チャットと文書の内容はそのままです。', '인터페이스 문구는 즉시 바뀌며, 대화와 문서 내용은 그대로 유지됩니다.', 'Die Oberfläche wechselt sofort; Chats und Dokumente bleiben unverändert.', 'L’interface change immédiatement ; les conversations restent inchangées.', 'La interfaz cambia al instante; los chats y documentos no se alteran.'],
  '跟随系统': ['System', '跟隨系統', 'システム設定', '시스템 설정', 'System', 'Système', 'Sistema'],
  '链接打开方式': ['Link opening', '連結開啟方式', 'リンクの開き方', '링크 열기 방식', 'Link-Öffnung', 'Ouverture des liens', 'Apertura de enlaces'],
  '设置 WorkBuddy 对话中链接的默认打开策略。': ['Choose how links in WorkBuddy open.', '設定 WorkBuddy 對話中連結的預設開啟策略。', 'WorkBuddy のチャットでリンクを開く既定の方法を設定します。', 'WorkBuddy 대화에서 링크를 여는 기본 방식을 설정합니다.', 'Legen Sie fest, wie Links in WorkBuddy geöffnet werden.', 'Choisissez comment les liens s’ouvrent dans WorkBuddy.', 'Elige cómo se abren los enlaces en WorkBuddy.'],
  '字体大小': ['Font size', '字型大小', '文字サイズ', '글자 크기', 'Schriftgröße', 'Taille du texte', 'Tamaño de letra'],
  '小': ['Small', '小', '小', '작게', 'Klein', 'Petit', 'Pequeño'],
  '大': ['Large', '大', '大', '크게', 'Groß', 'Grand', 'Grande'],
  '默认': ['Default', '預設', '標準', '기본', 'Standard', 'Par défaut', 'Predeterminado'],
  '默认打开方式': ['Default open method', '預設開啟方式', '既定の開き方', '기본 열기 방식', 'Standard-Öffnung', 'Ouverture par défaut', 'Apertura predeterminada'],
  '设置用 WorkBuddy 独立文件浏览器打开本地文件的默认方式。': ['Choose how local files open in the file browser.', '設定用 WorkBuddy 獨立檔案瀏覽器開啟本機檔案的預設方式。', 'WorkBuddy のファイルブラウザーでローカルファイルを開く既定の方法を設定します。', 'WorkBuddy 파일 브라우저에서 로컬 파일을 여는 기본 방식을 설정합니다.', 'Legen Sie fest, wie lokale Dateien im Dateibrowser geöffnet werden.', 'Choisissez comment les fichiers locaux s’ouvrent dans le navigateur de fichiers.', 'Elige cómo se abren los archivos locales en el explorador de archivos.'],
  '权限': ['Permissions', '權限', '権限', '권한', 'Berechtigungen', 'Autorisations', 'Permisos'],
  '允许锁屏运行': ['Run while locked', '允許鎖定螢幕時執行', 'ロック中も実行', '잠금 상태에서도 실행', 'Bei Sperre ausführen', 'Exécuter en cas de verrouillage', 'Ejecutar con bloqueo'],
  '选择锁屏后的运行方式，保障远程控制与后台 Agent 任务持续执行。': ['Choose how tasks keep running while locked.', '選擇鎖定螢幕後的執行方式，確保遠端控制與背景 Agent 任務持續執行。', 'ロック後の実行方法を選び、リモート操作とバックグラウンドの Agent タスクを継続します。', '잠금 후 실행 방식을 선택해 원격 제어와 백그라운드 Agent 작업이 계속 실행되게 합니다.', 'Wählen Sie, wie Aufgaben bei Sperre weiterlaufen.', 'Choisissez comment les tâches continuent une fois l’écran verrouillé.', 'Elige cómo siguen las tareas con el equipo bloqueado.'],
  '运行时防止系统休眠': ['Prevent sleep while running', '執行時防止系統休眠', '実行中はスリープしない', '실행 중 절전 방지', 'Ruhezustand verhindern', 'Empêcher la veille', 'Evitar la suspensión'],
  '在 WorkBuddy 运行任务时，让电脑保持唤醒状态。': ['Keep the computer awake while WorkBuddy is running.', '在 WorkBuddy 執行任務時，讓電腦保持喚醒狀態。', 'WorkBuddy の実行中はコンピューターをスリープさせません。', 'WorkBuddy가 작업하는 동안 컴퓨터를 깨어 있게 유지합니다.', 'Hält den Computer wach, während WorkBuddy läuft.', 'Garde l’ordinateur éveillé pendant l’exécution.', 'Mantiene el equipo despierto mientras se ejecuta.'],
  '开机自动启动': ['Launch at login', '開機自動啟動', 'ログイン時に起動', '로그인 시 자동 실행', 'Bei Anmeldung starten', 'Lancer à la connexion', 'Iniciar al arrancar'],
  '开启后 WorkBuddy 会在你登录电脑后自动启动。': ['Launch WorkBuddy automatically after you sign in.', '開啟後 WorkBuddy 會在您登入電腦後自動啟動。', 'オンにすると、サインイン後に WorkBuddy が自動で起動します。', '켜면 로그인 후 WorkBuddy가 자동으로 실행됩니다.', 'Startet WorkBuddy automatisch nach der Anmeldung.', 'Lance WorkBuddy automatiquement après la connexion.', 'Inicia WorkBuddy automáticamente al iniciar sesión.'],
  '网络代理': ['Network proxy', '網路代理', 'ネットワークプロキシ', '네트워크 프록시', 'Netzwerk-Proxy', 'Proxy réseau', 'Proxy de red'],
  '网络异常时可切换连接方式，修改后立即生效': ['Switch connection mode if the network misbehaves.', '網路異常時可切換連線方式，修改後立即生效', 'ネットワークに問題があるとき接続方法を切り替えられます。変更はすぐに反映されます。', '네트워크가 불안정할 때 연결 방식을 바꿀 수 있으며 즉시 적용됩니다.', 'Wechseln Sie bei Netzproblemen die Verbindung; Änderungen gelten sofort.', 'Changez de mode de connexion en cas de problème réseau ; effet immédiat.', 'Cambia el modo de conexión si la red falla; se aplica al instante.'],
  '自动安装可信技能': ['Auto-install trusted skills', '自動安裝可信技能', '信頼できるスキルを自動インストール', '신뢰할 수 있는 스킬 자동 설치', 'Vertrauenswürdige Fähigkeiten automatisch installieren', 'Installer automatiquement les compétences fiables', 'Instalar habilidades de confianza'],
  '自动安装来自可信来源的技能，扩展 Agent 能力。': ['Install skills from trusted sources automatically.', '自動安裝來自可信來源的技能，擴充 Agent 能力。', '信頼できる提供元のスキルを自動でインストールし、Agent の能力を広げます。', '신뢰할 수 있는 출처의 스킬을 자동 설치해 Agent 기능을 확장합니다.', 'Installiert Fähigkeiten aus vertrauenswürdigen Quellen automatisch.', 'Installe automatiquement les compétences de sources fiables.', 'Instala habilidades de fuentes fiables automáticamente.'],
  '关闭': ['Off', '關閉', 'オフ', '끔', 'Aus', 'Désactivé', 'Desactivado'],
  '允许': ['Allow', '允許', '許可', '허용', 'Erlauben', 'Autoriser', 'Permitir'],
  '仅后台任务': ['Background only', '僅背景任務', 'バックグラウンドのみ', '백그라운드 작업만', 'Nur Hintergrund', 'Tâches de fond uniquement', 'Solo en segundo plano'],
  '内置打开': ['In-app', '內建開啟', 'アプリ内', '앱 내에서 열기', 'In-App', 'Dans l’app', 'En la app'],
  '系统浏览器': ['System browser', '系統瀏覽器', 'システムブラウザー', '시스템 브라우저', 'Systembrowser', 'Navigateur système', 'Navegador del sistema'],
  '直接连接': ['Direct', '直接連線', '直接接続', '직접 연결', 'Direkt', 'Direct', 'Directa'],
  '系统代理': ['System proxy', '系統代理', 'システムプロキシ', '시스템 프록시', 'System-Proxy', 'Proxy système', 'Proxy del sistema'],
  '自定义代理': ['Custom proxy', '自訂代理', 'カスタムプロキシ', '사용자 지정 프록시', 'Eigener Proxy', 'Proxy personnalisé', 'Proxy personalizado'],

  // ── 身份 / 套餐 / 外观 ──
  '身份': ['Identity', '身分', 'アカウント', '계정 정보', 'Identität', 'Identité', 'Identidad'],
  '工作区': ['Workspace', '工作區', 'ワークスペース', '워크스페이스', 'Arbeitsbereich', 'Espace de travail', 'Espacio de trabajo'],
  '当前工作区名称': ['Workspace name', '目前工作區名稱', 'ワークスペース名', '워크스페이스 이름', 'Name des Arbeitsbereichs', 'Nom de l’espace', 'Nombre del espacio'],
  '计划': ['Plan', '方案', 'プラン', '요금제', 'Tarif', 'Offre', 'Plan'],
  '会话数': ['Sessions', '工作階段數', 'セッション数', '세션 수', 'Sitzungen', 'Sessions', 'Sesiones'],
  '本进程内创建过的会话': ['Sessions created in this process', '本程式內建立過的工作階段', 'このプロセスで作成したセッション', '이 프로세스에서 만든 세션', 'In diesem Prozess erstellte Sitzungen', 'Sessions créées dans ce processus', 'Sesiones creadas en este proceso'],
  '成员': ['Members', '成員', 'メンバー', '멤버', 'Mitglieder', 'Membres', 'Miembros'],
  '1（本地）': ['1 (local)', '1（本機）', '1（ローカル）', '1(로컬)', '1 (lokal)', '1 (local)', '1 (local)'],
  '打开工作区': ['Open workspace', '開啟工作區', 'ワークスペースを開く', '워크스페이스 열기', 'Arbeitsbereich öffnen', 'Ouvrir l’espace', 'Abrir espacio'],
  '关闭设置并回到首页': ['Close settings and return home', '關閉設定並回到首頁', '設定を閉じてホームへ戻る', '설정을 닫고 홈으로', 'Einstellungen schließen und zum Start', 'Fermer les paramètres et revenir à l’accueil', 'Cerrar ajustes y volver al inicio'],
  '打开': ['Open', '開啟', '開く', '열기', 'Öffnen', 'Ouvrir', 'Abrir'],
  '当前计划': ['Current plan', '目前方案', '現在のプラン', '현재 요금제', 'Aktueller Tarif', 'Offre actuelle', 'Plan actual'],
  '剩余额度': ['Remaining quota', '剩餘額度', '残りのクレジット', '남은 크레딧', 'Restguthaben', 'Quota restant', 'Crédito restante'],
  '演示值，不接计费': ['Demo value, not billed', '示範值，不計費', 'デモ値（課金なし）', '데모 값, 청구 없음', 'Demo-Wert, nicht abgerechnet', 'Valeur de démo, non facturée', 'Valor de demo, sin cobro'],
  '已产生会话': ['Sessions created', '已產生工作階段', '作成済みセッション', '생성된 세션', 'Erstellte Sitzungen', 'Sessions créées', 'Sesiones creadas'],
  '已产生消息': ['Messages created', '已產生訊息', '作成済みメッセージ', '생성된 메시지', 'Erstellte Nachrichten', 'Messages créés', 'Mensajes creados'],
  '升级到 Pro': ['Upgrade to Pro', '升級到 Pro', 'Pro にアップグレード', 'Pro로 업그레이드', 'Auf Pro upgraden', 'Passer à Pro', 'Mejorar a Pro'],
  '解锁 Max 档位与更高额度': ['Unlock Max and a higher quota', '解鎖 Max 方案與更高額度', 'Max プランとより大きな枠を解放', 'Max 요금제와 더 많은 크레딧 이용', 'Max und mehr Guthaben freischalten', 'Débloquer Max et plus de quota', 'Desbloquear Max y más crédito'],
  '升级': ['Upgrade', '升級', 'アップグレード', '업그레이드', 'Upgrade', 'Mettre à niveau', 'Mejorar'],
  '即时生效，保存在本地': ['Applies instantly, stored locally', '立即生效，儲存在本機', 'すぐに反映、ローカルに保存', '즉시 적용, 로컬에 저장', 'Sofort wirksam, lokal gespeichert', 'Effet immédiat, stocké localement', 'Se aplica al instante, guardado local'],
  '界面密度': ['Density', '介面密度', '表示密度', '화면 밀도', 'Dichte', 'Densité', 'Densidad'],
  '舒适': ['Comfortable', '舒適', 'ゆったり', '여유롭게', 'Komfortabel', 'Confortable', 'Cómoda'],
  '紧凑': ['Compact', '緊湊', 'コンパクト', '촘촘하게', 'Kompakt', 'Compact', 'Compacta'],
  '等宽字体': ['Monospace', '等寬字型', '等幅フォント', '고정폭 글꼴', 'Monospace', 'Monospace', 'Monoespaciada'],
  '聊天气泡与工具输出使用等宽字体': ['Use monospace for chat and tool output', '聊天泡泡與工具輸出使用等寬字型', 'チャットとツール出力を等幅フォントにする', '채팅과 도구 출력에 고정폭 글꼴 사용', 'Monospace für Chat und Tool-Ausgabe', 'Police monospace pour le chat et les outils', 'Monoespaciada en el chat y las herramientas'],
  '打开命令面板': ['Command palette', '開啟命令面板', 'コマンドパレットを開く', '명령 팔레트 열기', 'Befehlspalette öffnen', 'Ouvrir la palette de commandes', 'Abrir la paleta de comandos'],
  '搜索会话、专家与工具': ['Search sessions, experts and tools', '搜尋工作階段、專家與工具', 'セッション・エキスパート・ツールを検索', '세션, 전문가, 도구 검색', 'Sitzungen, Experten und Tools durchsuchen', 'Rechercher sessions, experts et outils', 'Buscar sesiones, expertos y herramientas'],
  '发送消息': ['Send message', '傳送訊息', 'メッセージを送信', '메시지 보내기', 'Nachricht senden', 'Envoyer le message', 'Enviar mensaje'],
  '在任一输入框中发送': ['Send from any input', '在任一輸入框中傳送', 'どの入力欄からでも送信', '어느 입력창에서나 전송', 'Aus jedem Eingabefeld senden', 'Envoyer depuis n’importe quel champ', 'Enviar desde cualquier campo'],
  '关闭弹层': ['Close overlays', '關閉彈層', 'ポップアップを閉じる', '오버레이 닫기', 'Overlays schließen', 'Fermer les fenêtres', 'Cerrar capas'],
  '菜单、抽屉与设置': ['Menus, drawer and settings', '選單、抽屜與設定', 'メニュー・ドロワー・設定', '메뉴, 서랍, 설정', 'Menüs, Drawer und Einstellungen', 'Menus, tiroirs et paramètres', 'Menús, paneles y ajustes'],
  '快捷键当前固定，暂不支持自定义。': ['Shortcuts are fixed for now.', '快速鍵目前固定，暫不支援自訂。', 'ショートカットは固定で、カスタマイズは未対応です。', '단축키는 현재 고정되어 있으며 사용자 지정은 지원하지 않습니다.', 'Tastenkürzel sind derzeit fest.', 'Les raccourcis sont fixes pour l’instant.', 'Los atajos son fijos por ahora.'],
  '称呼': ['Name', '稱呼', '呼び名', '호칭', 'Anrede', 'Nom', 'Nombre'],
  '用于界面问候，不写入会话': ['Used for greetings, not saved to sessions', '用於介面問候，不寫入工作階段', 'あいさつに使用、セッションには保存されません', '인사말에 사용되며 세션에는 저장되지 않습니다', 'Für Begrüßungen, nicht in Sitzungen gespeichert', 'Sert aux salutations, non enregistré', 'Se usa para saludar, no se guarda'],
  '回复语气': ['Tone', '回覆語氣', '返信のトーン', '답변 어조', 'Tonfall', 'Ton', 'Tono'],
  '仅本地偏好，不改变后端': ['Local preference only', '僅本機偏好，不改變後端', 'ローカル設定のみ', '로컬 설정만', 'Nur lokale Einstellung', 'Préférence locale uniquement', 'Solo preferencia local'],
  '平衡': ['Balanced', '平衡', 'バランス', '균형', 'Ausgewogen', 'Équilibré', 'Equilibrado'],
  '简洁': ['Concise', '簡潔', '簡潔', '간결', 'Knapp', 'Concis', 'Conciso'],
  '详尽': ['Detailed', '詳盡', '詳細', '상세', 'Ausführlich', 'Détaillé', 'Detallado'],
  '这些偏好保存在浏览器 localStorage，不会发送到后端。': ['Stored in localStorage; never sent to the backend.', '這些偏好儲存在瀏覽器 localStorage，不會傳送到後端。', 'これらの設定はブラウザーの localStorage に保存され、バックエンドには送信されません。', '이 설정은 브라우저 localStorage에 저장되며 백엔드로 전송되지 않습니다.', 'Diese Einstellungen liegen im localStorage und werden nicht gesendet.', 'Ces préférences sont dans le localStorage, jamais envoyées au serveur.', 'Estas preferencias se guardan en localStorage y no se envían al servidor.'],
  '设计记忆（会进入系统提示词）': ['Design memory (goes into the system prompt)', '設計記憶（會進入系統提示詞）', 'デザインメモリ（システムプロンプトに含まれます）', '디자인 메모리(시스템 프롬프트에 포함)', 'Design-Memory (geht in den System-Prompt)', 'Mémoire de design (dans le prompt système)', 'Memoria de diseño (entra en el prompt del sistema)'],
  '暂无设计决策': ['No decisions yet', '尚無設計決策', 'デザイン決定はまだありません', '아직 디자인 결정이 없습니다', 'Noch keine Entscheidungen', 'Aucune décision', 'Sin decisiones'],
  '保存后会进入系统提示词': ['Saved entries go into the system prompt', '儲存後會進入系統提示詞', '保存するとシステムプロンプトに含まれます', '저장하면 시스템 프롬프트에 포함됩니다', 'Gespeicherte Einträge gehen in den Prompt', 'Les entrées enregistrées vont dans le prompt', 'Las entradas guardadas van al prompt'],
  '新增决策': ['Add decision', '新增決策', '決定を追加', '결정 추가', 'Entscheidung hinzufügen', 'Ajouter une décision', 'Añadir decisión'],
  '主题，例如「圆角」': ['Topic, e.g. "radius"', '主題，例如「圓角」', 'トピック（例：角丸）', '주제, 예: "모서리"', 'Thema, z. B. „Radius“', 'Sujet, ex. « rayon »', 'Tema, ej. "radio"'],
  // ── 探索模板页（模版库） ──
  '工作区模板': ['Workspace templates', '工作區範本', 'ワークスペースのテンプレート', '워크스페이스 템플릿', 'Arbeitsbereich-Vorlagen', "Modèles d'espace", 'Plantillas del espacio'],
  '最近': ['Recent', '最近', '最近', '최근', 'Zuletzt', 'Récents', 'Recientes'],
  '由您创建': ['Created by you', '由您建立', '作成したもの', '내가 만든 항목', 'Von Ihnen erstellt', 'Créés par vous', 'Creados por ti'],
  '已归档': ['Archived', '已封存', 'アーカイブ済み', '보관됨', 'Archiviert', 'Archivés', 'Archivados'],
  '探索': ['Explore', '探索', '探索', '탐색', 'Entdecken', 'Explorer', 'Explorar'],
  '探索模板': ['Explore templates', '探索範本', 'テンプレートを探す', '템플릿 탐색', 'Vorlagen entdecken', 'Explorer les modèles', 'Explorar plantillas'],
  '筛选器': ['Filters', '篩選器', 'フィルター', '필터', 'Filter', 'Filtres', 'Filtros'],
  '格式': ['Format', '格式', '形式', '형식', 'Format', 'Format', 'Formato'],
  '所有格式': ['All formats', '所有格式', 'すべての形式', '모든 형식', 'Alle Formate', 'Tous les formats', 'Todos los formatos'],
  '社交轮播卡片': ['Social carousel', '社群輪播卡片', 'ソーシャルカルーセル', '소셜 캐러셀', 'Social-Carousel', 'Carrousel social', 'Carrusel social'],
  '类别': ['Category', '類別', 'カテゴリ', '카테고리', 'Kategorie', 'Catégorie', 'Categoría'],
  '课程': ['Courses', '課程', 'コース', '코스', 'Kurse', 'Cours', 'Cursos'],
  '提案': ['Proposals', '提案', '提案書', '제안서', 'Angebote', 'Propositions', 'Propuestas'],
  '报告': ['Reports', '報告', 'レポート', '보고서', 'Berichte', 'Rapports', 'Informes'],
  '融资演讲稿': ['Pitch decks', '募資簡報', 'ピッチ資料', '피치덱', 'Pitch-Decks', 'Pitchs', 'Pitch decks'],
  '营销材料': ['Marketing', '行銷素材', 'マーケティング資料', '마케팅 자료', 'Marketing', 'Supports marketing', 'Material de marketing'],
  '培训': ['Training', '培訓', '研修', '교육', 'Schulung', 'Formation', 'Formación'],
  '商业规划': ['Business plans', '商業規劃', '事業計画', '사업 계획', 'Geschäftspläne', "Plans d'affaires", 'Planes de negocio'],
  '活动': ['Events', '活動', 'イベント', '이벤트', 'Events', 'Événements', 'Eventos'],
  '品牌': ['Brand', '品牌', 'ブランド', '브랜드', 'Marke', 'Marque', 'Marca'],
  '数据': ['Data', '資料', 'データ', '데이터', 'Daten', 'Données', 'Datos'],
  '教育': ['Education', '教育', '教育', '교육', 'Bildung', 'Éducation', 'Educación'],
  '产品': ['Product', '產品', 'プロダクト', '제품', 'Produkt', 'Produit', 'Producto'],
  '研究': ['Research', '研究', 'リサーチ', '리서치', 'Forschung', 'Recherche', 'Investigación'],
  '招聘': ['Hiring', '招聘', '採用', '채용', 'Recruiting', 'Recrutement', 'Reclutamiento'],
  '手册': ['Handbooks', '手冊', 'ハンドブック', '핸드북', 'Handbücher', 'Manuels', 'Manuales'],
  '通讯': ['Newsletters', '電子報', 'ニュースレター', '뉴스레터', 'Newsletter', 'Newsletters', 'Boletines'],
  '作品集': ['Portfolio', '作品集', 'ポートフォリオ', '포트폴리오', 'Portfolio', 'Portfolio', 'Portafolio'],
  '海报': ['Posters', '海報', 'ポスター', '포스터', 'Poster', 'Affiches', 'Carteles'],
  '简历': ['Résumé', '履歷', '履歴書', '이력서', 'Lebenslauf', 'CV', 'Currículum'],
  '显示更多': ['Show more', '顯示更多', 'もっと見る', '더 보기', 'Mehr anzeigen', 'Afficher plus', 'Mostrar más'],
  '收起': ['Show less', '收合', '閉じる', '접기', 'Weniger anzeigen', 'Afficher moins', 'Mostrar menos'],
  '主题': ['Theme', '主題', 'テーマ', '테마', 'Design', 'Thème', 'Tema'],
  '浅色': ['Light', '淺色', 'ライト', '라이트', 'Hell', 'Clair', 'Claro'],
  '暖色': ['Warm', '暖色', 'ウォーム', '웜', 'Warm', 'Chaleureux', 'Cálido'],
  '黑白': ['Mono', '黑白', 'モノクロ', '모노', 'Mono', 'Mono', 'Monocromo'],
  '精心设计的模板，助您快速上手': ['Beautifully designed templates to get you started fast', '精心設計的範本，助您快速上手', 'すぐに使える洗練されたテンプレート', '바로 쓸 수 있는 세련된 템플릿', 'Sorgfältig gestaltete Vorlagen für einen schnellen Start', 'Des modèles soignés pour démarrer vite', 'Plantillas bien diseñadas para empezar rápido'],
  '搜索模板': ['Search templates', '搜尋範本', 'テンプレートを検索', '템플릿 검색', 'Vorlagen suchen', 'Rechercher des modèles', 'Buscar plantillas'],
  '创建日期': ['Date created', '建立日期', '作成日', '만든 날짜', 'Erstelldatum', 'Date de création', 'Fecha de creación'],
  '名称': ['Name', '名稱', '名前', '이름', 'Name', 'Nom', 'Nombre'],
  '排序': ['Sort', '排序', '並び順', '정렬', 'Sortieren', 'Trier', 'Ordenar'],
  '没有找到匹配的模板': ['No matching templates', '找不到符合的範本', '一致するテンプレートがありません', '일치하는 템플릿이 없습니다', 'Keine passenden Vorlagen', 'Aucun modèle correspondant', 'No hay plantillas coincidentes'],
  '换个关键词或筛选条件试试。': ['Try another keyword or filter.', '換個關鍵字或篩選條件試試。', '別のキーワードやフィルターをお試しください。', '다른 키워드나 필터를 사용해 보세요.', 'Versuchen Sie ein anderes Stichwort oder Filter.', 'Essayez un autre mot-clé ou filtre.', 'Prueba con otra palabra clave o filtro.'],
  '内容，例如「统一 8px」': ['Content, e.g. "8px everywhere"', '內容，例如「統一 8px」', '内容（例：8px で統一）', '내용, 예: "8px로 통일"', 'Inhalt, z. B. „überall 8px“', 'Contenu, ex. « 8px partout »', 'Contenido, ej. "8px en todo"'],
  '写入': ['Save', '寫入', '保存', '저장', 'Speichern', 'Enregistrer', 'Guardar'],

  // ── 专家 / 路由 / 助理 / 插件 ──
  '默认专家：': ['Default expert: ', '預設專家：', '既定のエキスパート：', '기본 전문가: ', 'Standard-Experte: ', 'Expert par défaut : ', 'Experto predeterminado: '],
  '设为默认': ['Set default', '設為預設', '既定に設定', '기본으로 설정', 'Als Standard', 'Définir par défaut', 'Predeterminar'],
  '适配器': ['Adapters', '轉接器', 'アダプター', '어댑터', 'Adapter', 'Adaptateurs', 'Adaptadores'],
  '未注册适配器': ['No adapters', '未註冊轉接器', 'アダプター未登録', '등록된 어댑터 없음', 'Keine Adapter', 'Aucun adaptateur', 'Sin adaptadores'],
  '装载 llm 适配器插件后出现': ['Appears after mounting an LLM adapter', '裝載 llm 轉接器外掛後出現', 'LLM アダプターを読み込むと表示されます', 'LLM 어댑터를 연결하면 표시됩니다', 'Erscheint nach dem Laden eines LLM-Adapters', 'Apparaît après le chargement d’un adaptateur LLM', 'Aparece al cargar un adaptador LLM'],
  '路由策略': ['Routing policies', '路由策略', 'ルーティングポリシー', '라우팅 정책', 'Routing-Regeln', 'Politiques de routage', 'Políticas de enrutamiento'],
  '无路由策略': ['No policies', '無路由策略', 'ポリシーなし', '정책 없음', 'Keine Regeln', 'Aucune politique', 'Sin políticas'],
  '候选链（按顺序回退）': ['Candidate chain (fallback in order)', '候選鏈（依序回退）', '候補チェーン（順にフォールバック）', '후보 체인(순서대로 대체)', 'Kandidatenkette (Fallback in Reihenfolge)', 'Chaîne de candidats (repli dans l’ordre)', 'Cadena de candidatos (respaldo en orden)'],
  '最近调用': ['Recent calls', '最近呼叫', '最近の呼び出し', '최근 호출', 'Letzte Aufrufe', 'Appels récents', 'Llamadas recientes'],
  '尚无调用': ['No calls yet', '尚無呼叫', '呼び出しなし', '호출 없음', 'Noch keine Aufrufe', 'Aucun appel', 'Sin llamadas'],
  '发起一次对话后这里会记录': ['Appears after your first chat', '發起一次對話後這裡會記錄', '最初のチャット後に記録されます', '첫 대화 후 여기에 기록됩니다', 'Erscheint nach dem ersten Chat', 'Apparaît après votre premier chat', 'Aparece tras tu primer chat'],
  '成功': ['OK', '成功', '成功', '성공', 'OK', 'OK', 'OK'],
  '失败': ['Failed', '失敗', '失敗', '실패', 'Fehlgeschlagen', 'Échec', 'Falló'],
  '默认助理': ['Default assistant', '預設助理', '既定のアシスタント', '기본 어시스턴트', 'Standard-Assistent', 'Assistant par défaut', 'Asistente predeterminado'],
  '新建会话使用的 preset': ['Preset for new sessions', '新工作階段使用的 preset', '新規セッションで使う preset', '새 세션에 사용할 preset', 'Preset für neue Sitzungen', 'Preset des nouvelles sessions', 'Preset para sesiones nuevas'],
  '完成后返回首页': ['Return home when done', '完成後返回首頁', '完了後にホームへ戻る', '완료 후 홈으로', 'Nach Abschluss zum Start', 'Revenir à l’accueil à la fin', 'Volver al inicio al terminar'],
  'Agent 结束时自动切回首页': ['Switch home when the agent finishes', 'Agent 結束時自動切回首頁', 'Agent 終了時に自動でホームへ', 'Agent가 끝나면 자동으로 홈으로', 'Bei Agent-Ende automatisch zum Start', 'Revenir à l’accueil à la fin de l’agent', 'Volver al inicio al acabar el agente'],
  '重置为设计经理': ['Reset to design manager', '重設為設計經理', 'デザインマネージャーに戻す', '디자인 매니저로 재설정', 'Auf Design-Manager zurücksetzen', 'Réinitialiser au design manager', 'Restablecer a jefe de diseño'],
  '恢复 manager preset': ['Restore the manager preset', '還原 manager preset', 'manager preset に戻す', 'manager preset 복원', 'Manager-Preset wiederherstellen', 'Restaurer le preset manager', 'Restaurar el preset manager'],
  '重置': ['Reset', '重設', 'リセット', '재설정', 'Zurücksetzen', 'Réinitialiser', 'Restablecer'],
  '暂无连接器': ['No connectors', '尚無連接器', 'コネクタなし', '커넥터 없음', 'Keine Konnektoren', 'Aucun connecteur', 'Sin conectores'],
  '装载连接器插件后出现': ['Appears after mounting a connector', '裝載連接器外掛後出現', 'コネクタを読み込むと表示されます', '커넥터를 연결하면 표시됩니다', 'Erscheint nach dem Laden eines Konnektors', 'Apparaît après le chargement d’un connecteur', 'Aparece al cargar un conector'],
  '已连接': ['Connected', '已連接', '接続済み', '연결됨', 'Verbunden', 'Connecté', 'Conectado'],
  '未装载': ['Not mounted', '未裝載', '未読み込み', '연결 안 됨', 'Nicht geladen', 'Non chargé', 'No cargado'],
  '断开': ['Disconnect', '中斷連接', '切断', '연결 해제', 'Trennen', 'Déconnecter', 'Desconectar'],
  '当前专家': ['Current expert', '目前專家', '現在のエキスパート', '현재 전문가', 'Aktueller Experte', 'Expert actuel', 'Experto actual'],
  '最大步数': ['Max steps', '最大步數', '最大ステップ数', '최대 단계', 'Max. Schritte', 'Étapes max.', 'Pasos máx.'],
  '单次对话最多调用模型的次数': ['Max model calls per chat', '單次對話最多呼叫模型的次數', '1 回のチャットでの最大モデル呼び出し回数', '대화당 최대 모델 호출 횟수', 'Max. Modellaufrufe pro Chat', 'Appels de modèle max. par chat', 'Llamadas máx. al modelo por chat'],
  '默认 6': ['Default 6', '預設 6', '既定 6', '기본 6', 'Standard 6', 'Par défaut 6', 'Predeterminado 6'],
  '显示工具结果': ['Show tool results', '顯示工具結果', 'ツール結果を表示', '도구 결과 표시', 'Tool-Ergebnisse zeigen', 'Afficher les résultats d’outil', 'Mostrar resultados de herramientas'],
  '关闭后聊天里只保留文字': ['Hide tool output in chat', '關閉後聊天裡只保留文字', 'オフにするとチャットにはテキストのみ', '끄면 채팅에 텍스트만 표시', 'Blendet Tool-Ausgaben im Chat aus', 'Masque les sorties d’outil dans le chat', 'Oculta la salida de herramientas'],
  '自动滚动': ['Auto-scroll', '自動捲動', '自動スクロール', '자동 스크롤', 'Auto-Scroll', 'Défilement auto', 'Desplazamiento automático'],
  '新消息到达时滚动到底部': ['Scroll to bottom on new messages', '新訊息到達時捲動到底部', '新着時に最下部へスクロール', '새 메시지가 오면 아래로 스크롤', 'Bei neuen Nachrichten nach unten scrollen', 'Défiler en bas à chaque message', 'Bajar al llegar mensajes nuevos'],
  '会话数据': ['Session data', '工作階段資料', 'セッションデータ', '세션 데이터', 'Sitzungsdaten', 'Données de session', 'Datos de sesión'],
  '暂无会话': ['No sessions', '尚無工作階段', 'セッションなし', '세션 없음', 'Keine Sitzungen', 'Aucune session', 'Sin sesiones'],
  '发送一条消息后出现在这里': ['Appears after you send a message', '傳送一則訊息後出現在這裡', 'メッセージを送るとここに表示されます', '메시지를 보내면 여기에 표시됩니다', 'Erscheint nach dem Senden einer Nachricht', 'Apparaît après l’envoi d’un message', 'Aparece al enviar un mensaje'],
  '导出': ['Export', '匯出', 'エクスポート', '내보내기', 'Exportieren', 'Exporter', 'Exportar'],
  '清空界面会话': ['Clear this view', '清除介面工作階段', 'この表示をクリア', '이 화면 비우기', 'Diese Ansicht leeren', 'Vider cette vue', 'Vaciar esta vista'],
  '只清空当前窗口显示，不删除服务端记录': ['Only clears this view, keeps server records', '只清空目前視窗顯示，不刪除伺服器記錄', '表示のみクリアし、サーバー記録は残します', '이 화면만 비우며 서버 기록은 유지합니다', 'Leert nur die Ansicht, Serverdaten bleiben', 'Vide seulement la vue, garde les données serveur', 'Solo vacía la vista, conserva el servidor'],
  '清空': ['Clear', '清空', 'クリア', '비우기', 'Leeren', 'Vider', 'Vaciar'],
  '运行时装卸插件。卸载会撤销该插件注册的服务、工具与提示词分节。': ['Mount and unmount plugins at runtime. Unloading removes their services, tools and prompt sections.', '執行時裝卸外掛。卸載會撤銷該外掛註冊的服務、工具與提示詞分節。', '実行中にプラグインを着脱できます。アンロードすると、そのサービス・ツール・プロンプトが解除されます。', '실행 중에 플러그인을 붙였다 떼었다 할 수 있습니다. 해제하면 해당 서비스, 도구, 프롬프트가 제거됩니다.', 'Plugins zur Laufzeit laden und entladen. Entladen entfernt Dienste, Tools und Prompt-Abschnitte.', 'Montez et démontez des plugins à chaud. Le démontage retire services, outils et sections de prompt.', 'Carga y descarga plugins en caliente. Al quitarlos se eliminan servicios, herramientas y secciones del prompt.'],
  '当前工具': ['Current tools', '目前工具', '現在のツール', '현재 도구', 'Aktuelle Tools', 'Outils actuels', 'Herramientas actuales'],

  // ── 办公面板 ──
  '操作': ['Action', '操作', '操作', '작업', 'Aktion', 'Action', 'Acción'],
  '来源': ['Source', '來源', 'ソース', '소스', 'Quelle', 'Source', 'Origen'],
  '上传': ['Upload', '上傳', 'アップロード', '업로드', 'Hochladen', 'Importer', 'Subir'],
  '本地路径': ['Local path', '本機路徑', 'ローカルパス', '로컬 경로', 'Lokaler Pfad', 'Chemin local', 'Ruta local'],
  '动作': ['Action', '動作', '動作', '동작', 'Aktion', 'Action', 'Acción'],
  '保存到': ['Save to', '儲存到', '保存先', '저장 위치', 'Speichern unter', 'Enregistrer dans', 'Guardar en'],
  '运行': ['Run', '執行', '実行', '실행', 'Ausführen', 'Exécuter', 'Ejecutar'],
  '提取公式（LaTeX）': ['Extract formulas (LaTeX)', '擷取公式（LaTeX）', '数式を抽出（LaTeX）', '수식 추출(LaTeX)', 'Formeln extrahieren (LaTeX)', 'Extraire les formules (LaTeX)', 'Extraer fórmulas (LaTeX)'],
  '给显示公式编号': ['Number display formulas', '為顯示公式編號', '表示数式に番号を付ける', '표시 수식 번호 매기기', 'Anzeige-Formeln nummerieren', 'Numéroter les formules', 'Numerar las fórmulas'],
  '选择文件后点「运行」。': ['Choose a file, then click Run.', '選擇檔案後點「執行」。', 'ファイルを選んで「実行」をクリックします。', '파일을 선택한 뒤 "실행"을 누르세요.', 'Datei wählen, dann „Ausführen“ klicken.', 'Choisissez un fichier puis cliquez sur Exécuter.', 'Elige un archivo y pulsa Ejecutar.'],
  '上传模板': ['Upload template', '上傳範本', 'テンプレートをアップロード', '템플릿 업로드', 'Vorlage hochladen', 'Importer un modèle', 'Subir plantilla'],
  '浏览模板': ['Browse templates', '瀏覽範本', 'テンプレートを探す', '템플릿 둘러보기', 'Vorlagen durchsuchen', 'Parcourir les modèles', 'Explorar plantillas'],
  '添加文件': ['Add file', '新增檔案', 'ファイルを追加', '파일 추가', 'Datei hinzufügen', 'Ajouter un fichier', 'Añadir archivo'],
  '模式': ['Mode', '模式', 'モード', '모드', 'Modus', 'Mode', 'Modo'],
  '努力': ['Effort', '努力', '労力', '노력', 'Aufwand', 'Effort', 'Esfuerzo'],
  '越多的需求将消耗更多的使用额度': ['More demand uses more quota', '越多的需求將消耗更多的使用額度', '要求が多いほどクレジットを消費します', '요구가 많을수록 크레딧을 더 사용합니다', 'Mehr Aufwand verbraucht mehr Guthaben', 'Plus d’exigence, plus de quota consommé', 'Más exigencia consume más crédito'],
  '标准': ['Standard', '標準', '標準', '표준', 'Standard', 'Standard', 'Estándar'],
  '未接入': ['Not connected', '未接入', '未接続', '연결 안 됨', 'Nicht verbunden', 'Non connecté', 'Sin conectar'],
  '仅桌面版': ['Desktop only', '僅桌面版', 'デスクトップ版のみ', '데스크톱 전용', 'Nur Desktop', 'Bureau uniquement', 'Solo escritorio'],
  '演示': ['Demo', '示範', 'デモ', '데모', 'Demo', 'Démo', 'Demo'],
  '已接入': ['Connected', '已接入', '接続済み', '연결됨', 'Verbunden', 'Connecté', 'Conectado'],

  // ── 杂项 ──
  '你好，': ['Hi, ', '你好，', 'こんにちは、', '안녕하세요, ', 'Hallo, ', 'Bonjour, ', 'Hola, '],
  '已保存': ['Saved', '已儲存', '保存しました', '저장됨', 'Gespeichert', 'Enregistré', 'Guardado'],
  '请简洁回答。': ['Answer concisely.', '請簡潔回答。', '簡潔に答えてください。', '간결하게 답하세요.', 'Bitte knapp antworten.', 'Répondez de façon concise.', 'Responde de forma concisa.'],
  '请详细说明。': ['Explain in detail.', '請詳細說明。', '詳しく説明してください。', '자세히 설명하세요.', 'Bitte ausführlich erklären.', 'Expliquez en détail.', 'Explica con detalle.'],
  'DesignBuddy · 工作台': ['DesignBuddy · Workspace', 'DesignBuddy · 工作台', 'DesignBuddy · ワークスペース', 'DesignBuddy · 워크스페이스', 'DesignBuddy · Arbeitsbereich', 'DesignBuddy · Espace de travail', 'DesignBuddy · Espacio de trabajo'],

  // ── 语言下拉框（自身标签永远用本地写法，仍登记以便选择器显示） ──
  '简体中文': ['Simplified Chinese', '简体中文', '簡体字中国語', '중국어 간체', 'Vereinfachtes Chinesisch', 'Chinois simplifié', 'Chino simplificado'],
  '繁體中文': ['Traditional Chinese', '繁體中文', '繁体字中国語', '중국어 번체', 'Traditionelles Chinesisch', 'Chinois traditionnel', 'Chino tradicional'],
  '日本語': ['Japanese', '日文', '日本語', '일본어', 'Japanisch', 'Japonais', 'Japonés'],
  '한국어': ['Korean', '韓文', '韓国語', '한국어', 'Koreanisch', 'Coréen', 'Coreano'],
  'Deutsch': ['German', '德文', 'ドイツ語', '독일어', 'Deutsch', 'Allemand', 'Alemán'],
  'Français': ['French', '法文', 'フランス語', '프랑스어', 'Französisch', 'Français', 'Francés'],
  'Español': ['Spanish', '西班牙文', 'スペイン語', '스페인어', 'Spanisch', 'Espagnol', 'Español'],
  // ── 图标条 / 头像菜单 / 模板菜单 / 技能卡 ──
  '家': ['Home', '家', 'ホーム', '홈', 'Start', 'Accueil', 'Inicio'],
  '媒体': ['Media', '媒體', 'メディア', '미디어', 'Medien', 'Médias', 'Medios'],
  '自定义': ['Custom', '自訂', 'カスタム', '사용자 지정', 'Eigene', 'Personnalisé', 'Personalizado'],
  '帮助与反馈': ['Help & feedback', '說明與回饋', 'ヘルプとフィードバック', '도움말 및 피드백', 'Hilfe & Feedback', 'Aide et retours', 'Ayuda y comentarios'],
  '帮助': ['Help', '說明', 'ヘルプ', '도움말', 'Hilfe', 'Aide', 'Ayuda'],
  '今天我们要做点什么呢？': ['What shall we make today?', '今天我們要做點什麼呢？', '今日は何を作りましょうか？', '오늘은 무엇을 만들어 볼까요?', 'Was bauen wir heute?', 'Que fait-on aujourd’hui ?', '¿Qué hacemos hoy?'],
  '更多选择': ['More options', '更多選擇', 'その他の選択肢', '더 많은 옵션', 'Mehr Optionen', 'Plus d’options', 'Más opciones'],
  '导入模板': ['Import template', '匯入範本', 'テンプレートを読み込む', '템플릿 가져오기', 'Vorlage importieren', 'Importer un modèle', 'Importar plantilla'],
  '创建可复用的工作区模板': ['Create reusable workspace templates', '建立可重複使用的工作區範本', '再利用できるワークスペーステンプレートを作成', '재사용 가능한 워크스페이스 템플릿 만들기', 'Wiederverwendbare Arbeitsbereich-Vorlagen erstellen', 'Créez des modèles d’espace réutilisables', 'Crea plantillas de espacio reutilizables'],
  '提示：使用连接器从您喜爱的工具中导入。': ['Tip: import from your favourite tools with connectors.', '提示：使用連接器從您喜愛的工具中匯入。', 'ヒント：コネクタでお気に入りのツールから取り込めます。', '팁: 커넥터로 즐겨 쓰는 도구에서 가져오세요.', 'Tipp: Mit Konnektoren aus Ihren Lieblingstools importieren.', 'Astuce : importez depuis vos outils préférés via les connecteurs.', 'Consejo: importa desde tus herramientas favoritas con conectores.'],
  '美化方式': ['Beautify style', '美化方式', '美化成り口', '미화 방식', 'Verschönerung', 'Style d’embellissement', 'Estilo de embellecimiento'],
  '更换视觉风格': ['Change the visual style', '更換視覺風格', 'ビジュアルスタイルを変更', '비주얼 스타일 변경', 'Visuellen Stil ändern', 'Changer le style visuel', 'Cambiar el estilo visual'],
  '全新的主题、字体和配色': ['New theme, fonts and colors', '全新的主題、字型與配色', '新しいテーマ・フォント・配色', '새 테마, 글꼴, 색상', 'Neues Theme, Schriften und Farben', 'Nouveau thème, polices et couleurs', 'Nuevo tema, fuentes y colores'],
  '重新设计布局': ['Redesign the layout', '重新設計版面', 'レイアウトを再設計', '레이아웃 재설계', 'Layout neu gestalten', 'Recomposer la mise en page', 'Rediseñar el diseño'],
  '用更强大的布局重构卡片': ['Rebuild cards with a stronger layout', '用更強大的版面重構卡片', 'より強いレイアウトでカードを再構築', '더 나은 레이아웃으로 카드 재구성', 'Karten mit stärkerem Layout neu aufbauen', 'Reconstruire les cartes avec une mise en page plus forte', 'Reconstruir tarjetas con un diseño más potente'],
  '精简文字': ['Trim the copy', '精簡文字', '文言を短く', '문구 간소화', 'Text kürzen', 'Alléger le texte', 'Simplificar el texto'],
  '标题更清晰，文案更简洁': ['Clearer titles, tighter copy', '標題更清晰，文案更簡潔', '見出しを明確に、文言は簡潔に', '제목은 명확하게, 문구는 간결하게', 'Klarere Titel, knapperer Text', 'Titres plus clairs, texte plus court', 'Títulos más claros, texto más breve'],
  '专家团': ['Expert team', '專家團', 'エキスパートチーム', '전문가 팀', 'Expertenteam', 'Équipe d’experts', 'Equipo de expertos'],
  '已安装(': ['Installed (', '已安裝(', 'インストール済み(', '설치됨(', 'Installiert (', 'Installé (', 'Instalado ('],
  'PPTX · DOCX · XLSX · PDF · 本地处理': ['PPTX · DOCX · XLSX · PDF · processed locally', 'PPTX · DOCX · XLSX · PDF · 本機處理', 'PPTX · DOCX · XLSX · PDF · ローカル処理', 'PPTX · DOCX · XLSX · PDF · 로컬 처리', 'PPTX · DOCX · XLSX · PDF · lokal verarbeitet', 'PPTX · DOCX · XLSX · PDF · traité en local', 'PPTX · DOCX · XLSX · PDF · procesado local'],
  '逐页提取标题与正文': ['Extract titles and body per page', '逐頁擷取標題與正文', 'ページごとに見出しと本文を抽出', '페이지마다 제목과 본문 추출', 'Titel und Text seitenweise extrahieren', 'Extraire titres et texte page par page', 'Extraer títulos y texto por página'],
  '⚡ 本地处理': ['⚡ Local processing', '⚡ 本機處理', '⚡ ローカル処理', '⚡ 로컬 처리', '⚡ Lokal verarbeitet', '⚡ Traité en local', '⚡ Procesado local'],
  '⬇ 无需联网': ['⬇ No network needed', '⬇ 免連網', '⬇ ネット不要', '⬇ 오프라인 가능', '⬇ Ohne Netz', '⬇ Sans réseau', '⬇ Sin conexión'],
  '读取段落与表格，或生成新文档': ['Read paragraphs and tables, or create a new document', '讀取段落與表格，或產生新文件', '段落と表を読み取り、新しい文書も作成', '문단과 표를 읽고 새 문서 생성', 'Absätze und Tabellen lesen oder neues Dokument erstellen', 'Lire paragraphes et tableaux, ou créer un document', 'Leer párrafos y tablas, o crear un documento'],
  'OMML → LaTeX，显示公式编号': ['OMML → LaTeX, number display formulas', 'OMML → LaTeX，顯示公式編號', 'OMML → LaTeX、表示数式に番号を付与', 'OMML → LaTeX, 표시 수식 번호 매기기', 'OMML → LaTeX, Anzeige-Formeln nummerieren', 'OMML → LaTeX, numéroter les formules', 'OMML → LaTeX, numerar las fórmulas'],
  '读取工作表，或按行生成表格': ['Read sheets, or generate tables row by row', '讀取工作表，或依列產生表格', 'シートを読み取り、行ごとに表を生成', '시트를 읽고 행 단위로 표 생성', 'Tabellenblätter lesen oder Zeilen erzeugen', 'Lire les feuilles ou générer des tableaux ligne par ligne', 'Leer hojas o generar tablas fila a fila'],
  '抽取可复制文本': ['Extract copyable text', '擷取可複製文字', 'コピー可能なテキストを抽出', '복사 가능한 텍스트 추출', 'Kopierbaren Text extrahieren', 'Extraire le texte copiable', 'Extraer texto copiable'],
  '使用量': ['Usage', '使用量', '使用量', '사용량', 'Nutzung', 'Utilisation', 'Uso'],
  '安装量': ['Installs', '安裝量', 'インストール数', '설치 수', 'Installationen', 'Installations', 'Instalaciones'],
  '未设置': ['Not set', '未設定', '未設定', '설정 안 됨', 'Nicht festgelegt', 'Non défini', 'Sin definir'],
  '文本设置': ['Text settings', '文字設定', 'テキスト設定', '텍스트 설정', 'Texteinstellungen', 'Réglages du texte', 'Ajustes de texto'],
  '语音': ['Voice', '語音', '音声', '음성', 'Sprache', 'Voix', 'Voz'],
  '发送': ['Send', '傳送', '送信', '보내기', 'Senden', 'Envoyer', 'Enviar'],
  '添加或连接': ['Add or connect', '新增或連接', '追加または接続', '추가 또는 연결', 'Hinzufügen oder verbinden', 'Ajouter ou connecter', 'Añadir o conectar'],
  '移除类型': ['Remove type', '移除類型', '種類を削除', '유형 제거', 'Typ entfernen', 'Retirer le type', 'Quitar tipo'],
  '描述您的演示主题': ['Describe your presentation topic', '描述您的簡報主題', 'プレゼンのテーマを入力', '프레젠테이션 주제를 설명하세요', 'Beschreiben Sie Ihr Präsentationsthema', 'Décrivez votre sujet de présentation', 'Describe el tema de tu presentación'],
  '继续描述你的设计需求…': ['Keep describing your design needs…', '繼續描述你的設計需求…', 'デザインの要望を続けて入力…', '디자인 요구 사항을 계속 설명하세요…', 'Beschreiben Sie Ihre Designwünsche weiter…', 'Continuez à décrire vos besoins…', 'Sigue describiendo tus necesidades de diseño…'],
  '搜索专家': ['Search experts', '搜尋專家', 'エキスパートを検索', '전문가 검색', 'Experten suchen', 'Rechercher des experts', 'Buscar expertos'],
  '搜索会话、专家、工具…': ['Search sessions, experts, tools…', '搜尋工作階段、專家、工具…', 'セッション・エキスパート・ツールを検索…', '세션, 전문가, 도구 검색…', 'Sitzungen, Experten, Tools suchen…', 'Rechercher sessions, experts, outils…', 'Buscar sesiones, expertos, herramientas…'],
  '搜索设置项': ['Search settings', '搜尋設定項', '設定を検索', '설정 검색', 'Einstellungen suchen', 'Rechercher', 'Buscar ajustes'],
  '将此电子表格精简为 6 张幻灯片的演示文稿。仅绘制三个最重要的趋势，每张幻灯片展示一个趋势，并在结尾处说明这些数据对下一季度的意义。': ['Turn this spreadsheet into a 6-slide deck. Plot only the three most important trends, one per slide, and close with what the data means for next quarter.', '將此電子表格精簡為 6 張投影片的簡報。僅繪製三個最重要的趨勢，每張投影片展示一個趨勢，並在結尾處說明這些數據對下一季度的意義。', 'この表計算を 6 枚のスライドにまとめてください。最も重要な 3 つのトレンドだけをグラフ化し、最後に来四半期への示唆を述べてください。', '이 스프레드시트를 6장 슬라이드로 정리하세요. 가장 중요한 추세 3개만 도식화하고 마지막에 다음 분기에 대한 의미를 설명하세요.', 'Machen Sie aus dieser Tabelle eine Präsentation mit 6 Folien. Zeigen Sie nur die drei wichtigsten Trends und schließen Sie mit der Bedeutung für das nächste Quartal.', 'Transformez cette feuille de calcul en 6 diapositives. Ne tracez que les trois tendances majeures et concluez sur leur sens pour le prochain trimestre.', 'Convierte esta hoja en 6 diapositivas. Grafica solo las tres tendencias clave y cierra con lo que significan para el próximo trimestre.'],

  // ── 图标条与侧栏的短写法（位置窄，单独取更短的词） ──
  'rail.home': ['Home', '首頁', 'ホーム', '홈', 'Start', 'Accueil', 'Inicio'],
  'rail.media': ['Media', '媒體', 'メディア', '미디어', 'Medien', 'Médias', 'Medios'],
  'rail.templates': ['Templates', '範本', 'テンプレート', '템플릿', 'Vorlagen', 'Modèles', 'Plantillas'],
  'rail.custom': ['Custom', '自訂', 'カスタム', '사용자 지정', 'Eigene', 'Perso', 'Propio'],
  'rail.settings': ['Settings', '設定', '設定', '설정', 'Optionen', 'Options', 'Ajustes'],
  'rail.more': ['More', '更多', 'その他', '더보기', 'Mehr', 'Plus', 'Más'],
  'nav.shared': ['Shared', '與您共用', '共有', '공유 항목', 'Geteilt', 'Partagé', 'Compartido'],
  'nav.api': ['API', 'API', 'API', 'API', 'API', 'API', 'API'],

  // ── 动态渲染的界面文案（数据本身不翻译） ──
  '卸载': ['Unmount', '卸載', '取り外す', '제거', 'Entladen', 'Démonter', 'Desmontar'],
  '已装载的工具能力': ['Mounted capabilities', '已裝載的工具能力', '読み込み済みのツール', '로드된 도구', 'Geladene Tools', 'Outils chargés', 'Herramientas cargadas'],
  '办公': ['Office', '辦公', 'オフィス', '오피스', 'Office', 'Bureautique', 'Oficina'],
  'Agent 预设与分工': ['Agent presets & roles', 'Agent 預設與分工', 'Agent プリセットと役割', 'Agent 프리셋과 역할', 'Agent-Presets & Rollen', 'Presets et rôles d’agents', 'Presets y roles de agentes'],
  '外部工具接入': ['External tools', '外部工具接入', '外部ツール連携', '외부 도구 연동', 'Externe Tools', 'Outils externes', 'Herramientas externas'],
  '自动': ['Auto', '自動', '自動', '자동', 'Auto', 'Auto', 'Auto'],
  '根据主题智能匹配': ['Match automatically by topic', '依主題智慧匹配', 'テーマに合わせて自動選択', '주제에 맞춰 자동 선택', 'Automatisch nach Thema', 'Correspondance automatique', 'Coincidencia automática'],
  '添加图片': ['Add images', '新增圖片', '画像を追加', '이미지 추가', 'Bilder hinzufügen', 'Ajouter des images', 'Añadir imágenes'],
  '图文并茂': ['With images', '圖文並茂', '画像あり', '이미지 포함', 'Mit Bildern', 'Avec images', 'Con imágenes'],
  '图片幻灯片': ['Image slides', '圖片投影片', '画像スライド', '이미지 슬라이드', 'Bildfolien', 'Diapositives illustrées', 'Diapositivas con imagen'],
  '每张幻灯片对应一张图片，文字保持可编辑状态。': ['One image per slide, text stays editable.', '每張投影片對應一張圖片，文字保持可編輯狀態。', 'スライドごとに 1 枚の画像、テキストは編集可能なまま。', '슬라이드마다 이미지 1장, 텍스트는 편집 가능.', 'Ein Bild pro Folie, Text bleibt editierbar.', 'Une image par diapositive, texte modifiable.', 'Una imagen por diapositiva, texto editable.'],
  '不添加图片': ['No images', '不新增圖片', '画像なし', '이미지 없음', 'Ohne Bilder', 'Sans images', 'Sin imágenes'],
  '保留您附加的所有图片': ['Keep the images you attach', '保留您附加的所有圖片', '添付した画像をすべて保持', '첨부한 이미지를 모두 유지', 'Alle angehängten Bilder behalten', 'Conserver les images jointes', 'Conserva las imágenes adjuntas'],
  '演示环境：输入需求会真实驱动本地 Agent Runtime。': ['Demo: your prompt really drives the local Agent Runtime.', '示範環境：輸入需求會真實驅動本機 Agent Runtime。', 'デモ環境：入力はローカルの Agent Runtime を実際に動かします。', '데모 환경: 입력한 요구가 로컬 Agent Runtime을 실제로 구동합니다.', 'Demo: Eingaben treiben die lokale Agent Runtime wirklich an.', 'Démo : votre demande pilote réellement l’Agent Runtime local.', 'Demo: tu petición impulsa el Agent Runtime local.'],
  '适用于简单任务的基础模式': ['Basic mode for simple tasks', '適用於簡單任務的基礎模式', 'シンプルなタスク向けの基本モード', '간단한 작업을 위한 기본 모드', 'Basismodus für einfache Aufgaben', 'Mode de base pour tâches simples', 'Modo básico para tareas simples'],
  '适合日常工作的均衡效能': ['Balanced power for everyday work', '適合日常工作的均衡效能', '日常業務に合ったバランス', '일상 업무에 맞춘 균형', 'Ausgewogen für den Arbeitsalltag', 'Équilibré pour le quotidien', 'Equilibrado para el día a día'],
  '对重要工作全力以赴': ['Full effort for important work', '對重要工作全力以赴', '重要な作業に全力', '중요한 작업에 최선', 'Volle Leistung für wichtige Arbeit', 'Pleine puissance pour l’essentiel', 'Máximo esfuerzo para lo importante'],
  '例如：设计师小李': ['e.g. Alex Lee', '例如：設計師小李', '例：デザイナーの佐藤', '예: 디자이너 김', 'z. B. Alex Lee', 'ex. Alex Lee', 'ej. Alex Lee'],
  '⚡ 已接入': ['⚡ Connected', '⚡ 已接入', '⚡ 接続済み', '⚡ 연결됨', '⚡ Verbunden', '⚡ Connecté', '⚡ Conectado'],
  '全部工具': ['All tools', '全部工具', 'すべてのツール', '모든 도구', 'Alle Tools', 'Tous les outils', 'Todas las herramientas'],

  '级联': ['Cascade', '級聯', 'カスケード', '계단식', 'Kaskade', 'Cascade', 'Cascada'],

  // ── 模版库页 ──
  '从精选模版开始，或从空白页自己搭。': ['Start from a curated template, or build from a blank page.', '從精選範本開始，或從空白頁自己搭。', '厳選テンプレートから始めるか、空白ページから作れます。', '엄선된 템플릿으로 시작하거나 빈 페이지에서 직접 만들어 보세요.', 'Starten Sie mit einer Vorlage oder bauen Sie selbst von einer leeren Seite.', 'Partez d’un modèle sélectionné ou d’une page blanche.', 'Empieza con una plantilla destacada o desde una página en blanco.'],
  '搜索模版': ['Search templates', '搜尋範本', 'テンプレートを検索', '템플릿 검색', 'Vorlagen suchen', 'Rechercher un modèle', 'Buscar plantillas'],
  '使用模版': ['Use template', '使用範本', 'テンプレートを使う', '템플릿 사용', 'Vorlage verwenden', 'Utiliser le modèle', 'Usar plantilla'],
  '社交': ['Social', '社群', 'ソーシャル', '소셜', 'Social', 'Social', 'Social'],
  '没有找到匹配的模版': ['No matching templates', '找不到符合的範本', '一致するテンプレートはありません', '일치하는 템플릿이 없습니다', 'Keine passenden Vorlagen', 'Aucun modèle correspondant', 'No hay plantillas coincidentes'],
  '换个关键词或分类试试。': ['Try another keyword or category.', '換個關鍵字或分類試試。', '別のキーワードやカテゴリをお試しください。', '다른 검색어나 카테고리를 시도해 보세요.', 'Versuchen Sie ein anderes Stichwort oder eine andere Kategorie.', 'Essayez un autre mot-clé ou une autre catégorie.', 'Prueba otra palabra clave o categoría.'],
  '用「%s」模版做一份提案，包含主色、层级和 3 个关键页面。': ['Build a proposal with the “%s” template, covering the primary color, hierarchy and 3 key pages.', '用「%s」範本做一份提案，包含主色、層級和 3 個關鍵頁面。', '「%s」テンプレートで提案を作成。メインカラー、階層、主要 3 ページを含めます。', '‘%s’ 템플릿으로 제안서를 만들어 주세요. 메인 컬러, 계층, 핵심 페이지 3개를 포함합니다.', 'Erstellen Sie mit der Vorlage „%s“ ein Angebot mit Hauptfarbe, Hierarchie und 3 Schlüsselseiten.', 'Créez une proposition avec le modèle « %s » : couleur principale, hiérarchie et 3 pages clés.', 'Crea una propuesta con la plantilla «%s»: color principal, jerarquía y 3 páginas clave.'],

}

/** 源文案 → { en, 'zh-Hant', ja, … }，缺列时回退到英文。 */
const DICT = {}
for (const key of Object.keys(ROWS)) {
  const row = ROWS[key]
  const entry = {}
  COLS.forEach((col, index) => {
    const value = row[index]
    if (value) entry[col] = value
  })
  if (!entry.en) entry.en = key
  DICT[key] = entry
}

const LANGUAGE_IDS = new Set(LANGUAGES.map((item) => item.id))
const HTML_LANG = Object.fromEntries(LANGUAGES.map((item) => [item.id, item.htmlLang]))
const COLSET = new Set(COLS)

let titleSource = null
const originals = new WeakMap()
const attrOriginals = new WeakMap()
let lang = 'zh'

export function currentLanguage() {
  return lang
}

export function languageLabel(id) {
  return LANGUAGES.find((item) => item.id === id)?.label ?? LANGUAGES[0].label
}

/** 按浏览器语言猜一个界面语言，猜不到就用简体中文。 */
export function detectLanguage() {
  const list = (typeof navigator !== 'undefined' && (navigator.languages || [navigator.language])) || []
  for (const raw of list) {
    if (!raw) continue
    const tag = String(raw).toLowerCase()
    if (tag.startsWith('zh')) {
      return /hant|tw|hk|mo/.test(tag) ? 'zh-Hant' : 'zh'
    }
    const base = tag.split('-')[0]
    if (LANGUAGE_IDS.has(base)) return base
  }
  return 'zh'
}

/**
 * 把设置里存的值变成语言 id。
 * 兼容旧版本存下来的选项文案（'English' / '简体中文'），也支持 'auto'。
 */
export function resolveLanguage(pref) {
  if (!pref || pref === 'auto') return pref === 'auto' ? detectLanguage() : 'zh'
  if (LANGUAGE_IDS.has(pref)) return pref
  if (pref === 'English') return 'en'
  if (pref === '繁體中文' || pref === 'Traditional Chinese') return 'zh-Hant'
  if (pref === '日本語' || pref === 'Japanese') return 'ja'
  if (pref === '한국어' || pref === 'Korean') return 'ko'
  if (pref === 'Deutsch' || pref === 'German') return 'de'
  if (pref === 'Français' || pref === 'French') return 'fr'
  if (pref === 'Español' || pref === 'Spanish') return 'es'
  return 'zh'
}

/** 翻译单个词条；源语言直接返回。 */
export function t(text) {
  if (lang === 'zh') return text
  return DICT[text]?.[lang] ?? DICT[text]?.en ?? text
}

function translate(source, keyOverride) {
  if (lang === 'zh') return null
  const key = keyOverride || source.trim();
  const value = DICT[key]?.[lang] ?? DICT[key]?.en
  return value ? source.replace(source.trim(), value) : null
}

function skipNode(node) {
  const parent = node.parentElement
  if (!parent) return true
  const tag = parent.tagName
  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') return true
  // 语言下拉框里的语言名永远用各自的本族写法
  if (parent.closest('#setLanguage')) return true
  return parent.closest('#opResult, .thread, pre, code, .msg, #chatTitle, #chatSid, .op-result, [data-no-i18n]') !== null
}

function translateTextNode(node) {
  const stored = originals.get(node) ?? node.nodeValue ?? ''
  if (!originals.has(node)) originals.set(node, stored)
  const trimmed = stored.trim()
  if (trimmed === '') return
  const key = node.parentElement?.dataset?.i18nKey
  node.nodeValue = translate(stored, key) ?? stored
}

function translateAttributes() {
  for (const el of document.querySelectorAll('[placeholder], [title], [aria-label]')) {
    const store = attrOriginals.get(el) ?? new Map()
    attrOriginals.set(el, store)
    for (const name of ['placeholder', 'title', 'aria-label']) {
      const value = el.getAttribute(name)
      if (value == null) continue
      if (!store.has(name)) store.set(name, value)
      const original = store.get(name)
      if (original.trim() === '') continue
      el.setAttribute(name, translate(original) ?? original)
    }
  }
}

/** 切换界面语言：id（en / ja / …）或 'auto'。 */
export function applyLanguage(next) {
  const resolved = resolveLanguage(next)
  lang = COLSET.has(resolved) ? resolved : 'zh'
  document.documentElement.lang = HTML_LANG[lang] ?? 'zh-CN'
  document.documentElement.dataset.lang = lang
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return skipNode(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    },
  })
  const nodes = []
  while (walker.nextNode()) nodes.push(walker.currentNode)
  for (const node of nodes) translateTextNode(node)
  translateAttributes()
  if (titleSource === null) titleSource = document.title
  document.title = translate(titleSource) ?? titleSource
}

/** 动态渲染出来的节点也跟随当前语言（只处理新增节点，避免整页重扫）。 */
export function startAutoTranslate() {
  const translateSubtree = (root) => {
    if (root.nodeType === Node.TEXT_NODE) {
      if (!skipNode(root)) translateTextNode(root)
      return
    }
    if (root.nodeType !== Node.ELEMENT_NODE) return
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode
      if (!skipNode(node)) translateTextNode(node)
    }
    for (const el of root.querySelectorAll('[placeholder], [title], [aria-label]')) {
      const store = attrOriginals.get(el) ?? new Map()
      attrOriginals.set(el, store)
      for (const name of ['placeholder', 'title', 'aria-label']) {
        const value = el.getAttribute(name)
        if (value == null) continue
        if (!store.has(name)) store.set(name, value)
        const original = store.get(name)
        if (original.trim() === '') continue
        el.setAttribute(name, translate(original) ?? original)
      }
    }
  }

  const observer = new MutationObserver((records) => {
    if (lang === 'zh') return
    for (const record of records) {
      for (const node of record.addedNodes) translateSubtree(node)
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
}
