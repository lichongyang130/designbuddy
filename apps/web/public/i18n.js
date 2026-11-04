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
  // ── 演示文稿引擎 · 生成工作台 ──
  '第 %s 页 · %s': ['Page %s · %s', '第 %s 頁 · %s', '%s ページ目 · %s', '%s페이지 · %s', 'Seite %s · %s', 'Page %s · %s', 'Página %s · %s'],
  '计划确认后，页面会一页一页出现在这里 · 16:9': ['After you confirm the plan, pages appear here one by one · 16:9', '計劃確認後，頁面會一頁一頁出現在這裡 · 16:9', '計画を確認すると、ページが 1 枚ずつここに現れます · 16:9', '계획을 확인하면 페이지가 한 장씩 여기에 나타납니다 · 16:9', 'Nach Bestätigung erscheinen die Seiten hier nacheinander · 16:9', 'Après confirmation, les pages apparaissent ici une à une · 16:9', 'Tras confirmar, las páginas aparecen aquí una a una · 16:9'],
  '演示文稿引擎': ['Deck engine', '簡報引擎', 'プレゼンエンジン', '프레젠테이션 엔진', 'Präsentations-Engine', 'Moteur de présentation', 'Motor de presentaciones'],
  '正在理解需求…': ['Reading the brief…', '正在理解需求…', '要件を読み取り中…', '요구사항 파악 중…', 'Briefing wird gelesen…', 'Lecture du brief…', 'Leyendo el brief…'],
  '等待分析…': ['Waiting for analysis…', '等待分析…', '分析待ち…', '분석 대기 중…', 'Warten auf Analyse…', 'En attente d’analyse…', 'Esperando el análisis…'],
  '需求分析': ['Brief analysis', '需求分析', '要件分析', '요구사항 분석', 'Briefing-Analyse', 'Analyse du brief', 'Análisis del brief'],
  '资料研究': ['Research', '資料研究', 'リサーチ', '자료 조사', 'Recherche', 'Recherche', 'Investigación'],
  '内容策划': ['Story planning', '內容策劃', '構成設計', '콘텐츠 기획', 'Inhaltsplanung', 'Conception du contenu', 'Planificación del contenido'],
  '视觉设计': ['Visual design', '視覺設計', 'ビジュアル設計', '비주얼 디자인', 'Visual Design', 'Design visuel', 'Diseño visual'],
  '页面生成': ['Slide building', '頁面生成', 'スライド生成', '슬라이드 생성', 'Folien-Aufbau', 'Création des pages', 'Creación de páginas'],
  '质量审核': ['Quality review', '品質審核', '品質レビュー', '품질 검토', 'Qualitätsprüfung', 'Contrôle qualité', 'Revisión de calidad'],
  '读需求，定主题、用途、受众、页数': ['Reads the ask, sets topic, purpose, audience, pages', '讀需求，定主題、用途、受眾、頁數', '要件を読み、主題・用途・対象・枚数を決める', '요구를 읽고 주제·용도·대상·장수를 정함', 'Liest den Auftrag, legt Thema, Zweck, Zielgruppe, Seiten fest', 'Lit la demande, fixe sujet, usage, public, pages', 'Lee la petición y fija tema, uso, público y páginas'],
  '核对关键词与行业口径': ['Checks keywords and industry baselines', '核對關鍵詞與行業口徑', 'キーワードと業界基準を確認', '키워드와 업계 기준 확인', 'Prüft Stichworte und Branchenbezug', 'Vérifie les mots-clés et les références du secteur', 'Comprueba palabras clave y referencias del sector'],
  '排叙事顺序，决定每页讲什么': ['Orders the story, decides what each page says', '排敘事順序，決定每頁講什麼', '流れを組み、各ページの内容を決める', '이야기 순서를 짜고 페이지별 내용을 정함', 'Ordnet die Erzählung, legt fest, was jede Seite sagt', 'Ordonne le récit et décide du contenu de chaque page', 'Ordena el relato y decide qué dice cada página'],
  '定配色、字体、版式家族': ['Sets palette, type and layout family', '定配色、字體、版式家族', '配色・書体・レイアウトを決める', '색상·서체·레이아웃 결정', 'Legt Farben, Schriften und Layoutfamilie fest', 'Fixe palette, typographie et famille de mises en page', 'Fija paleta, tipografía y familia de maquetas'],
  '一页一页写出来': ['Writes it page by page', '一頁一頁寫出來', '1 ページずつ書き出す', '한 장씩 만들어 냄', 'Schreibt Seite für Seite', 'Écrit page après page', 'Escribe página a página'],
  '查内容、排版、图片、商业逻辑': ['Checks content, layout, images, business logic', '查內容、排版、圖片、商業邏輯', '内容・レイアウト・画像・筋を確認', '내용·배치·이미지·논리 점검', 'Prüft Inhalt, Layout, Bilder, Geschäftslogik', 'Vérifie contenu, mise en page, images, logique métier', 'Revisa contenido, maqueta, imágenes y lógica de negocio'],
  '叙事主线': ['Narrative spine', '敘事主線', 'ストーリーの軸', '이야기 축', 'Erzähllinie', 'Fil narratif', 'Hilo narrativo'],
  '大纲': ['Outline', '大綱', 'アウトライン', '개요', 'Gliederung', 'Plan', 'Esquema'],
  '正在搭结构…': ['Laying out the structure…', '正在搭結構…', '構成を組んでいます…', '구조를 짜는 중…', 'Struktur wird aufgebaut…', 'Construction de la structure…', 'Armando la estructura…'],
  '下载全部': ['Download all', '下載全部', 'すべて保存', '모두 내려받기', 'Alles herunterladen', 'Tout télécharger', 'Descargar todo'],
  '正在按大纲产出…': ['Building from the outline…', '正在按大綱產出…', '構成どおり生成中…', '개요대로 만드는 중…', 'Wird nach Gliederung erstellt…', 'Production selon le plan…', 'Creando según el esquema…'],
  '演示文稿 · %s 页大纲': ['Deck · %s-page outline', '簡報 · %s 頁大綱', 'プレゼン · %s ページ構成', '프레젠테이션 · %s장 개요', 'Präsentation · %s Seiten Gliederung', 'Présentation · plan de %s pages', 'Presentación · esquema de %s páginas'],
  '思考摘要': ['Reasoning summary', '思考摘要', '思考サマリー', '사고 요약', 'Denk-Zusammenfassung', 'Résumé du raisonnement', 'Resumen del razonamiento'],
  '本页版式理由': ['Why this layout', '本頁版式理由', 'このレイアウトの理由', '이 레이아웃을 쓴 이유', 'Warum dieses Layout', 'Pourquoi cette mise en page', 'Por qué esta maqueta'],
  '开始生成': ['Start generating', '開始生成', '生成を開始', '생성 시작', 'Generierung starten', 'Lancer la génération', 'Empezar a generar'],
  '说一句想改的地方，例如「第 3 页换种说法」': ['Say what to change, e.g. “reword page 3”', '說一句想改的地方，例如「第 3 頁換種說法」', '直したい点を一言、例：「3 ページ目の言い回しを変えて」', '바꾸고 싶은 점을 한마디로, 예: “3페이지 표현을 바꿔줘”', 'Sag, was sich ändern soll, z. B. „Seite 3 anders formulieren“', 'Dites quoi changer, par ex. « reformuler la page 3 »', 'Di qué cambiar, p. ej. «reformular la página 3»'],
  '打开完整演示': ['Open full deck', '打開完整簡報', 'スライド全体を開く', '전체 슬라이드 열기', 'Ganze Präsentation öffnen', 'Ouvrir la présentation', 'Abrir la presentación'],
  '生成': ['Generate', '生成', '生成', '생성', 'Erstellen', 'Générer', 'Generar'],
  '正在生成…': ['Generating…', '正在生成…', '生成中…', '생성 중…', 'Wird erstellt…', 'Génération…', 'Generando…'],
  '正在搭大纲…': ['Drafting the outline…', '正在搭大綱…', 'アウトライン作成中…', '개요 작성 중…', 'Gliederung wird erstellt…', 'Création du plan…', 'Creando el esquema…'],
  '等待大纲': ['Waiting for outline', '等待大綱', 'アウトライン待ち', '개요 대기 중', 'Warten auf Gliederung', 'En attente du plan', 'Esperando el esquema'],
  '正在创建“%s”…': ['Creating “%s”…', '正在建立「%s」…', '「%s」を作成しています…', '“%s” 생성 중…', '„%s“ wird erstellt…', 'Création de « %s »…', 'Creando «%s»…'],
  '正在撰写幻灯片…': ['Writing slides…', '正在撰寫投影片…', 'スライドを作成中…', '슬라이드 작성 중…', 'Folien werden geschrieben…', 'Rédaction des diapositives…', 'Escribiendo diapositivas…'],
  '写作': ['Writing', '寫作', '作成中', '작성 중', 'Schreiben', 'Rédaction', 'Escribiendo'],
  '润色中': ['Polishing', '潤色中', '推敲中', '다듬는 중', 'Wird geglättet', 'Peaufinage', 'Puliendo'],
  '这次没有可预览的页面，直接下载打包文件。': ['No page previews this time — download the bundle instead.', '這次沒有可預覽的頁面，直接下載打包檔案。', '今回はプレビューできるページがありません。パッケージをダウンロードしてください。', '이번에는 미리 볼 페이지가 없습니다. 묶음 파일을 내려받으세요.', 'Diesmal keine Seitenvorschau – lade stattdessen das Paket herunter.', 'Aucun aperçu cette fois — téléchargez l’archive.', 'Esta vez no hay páginas: descarga el paquete.'],
  '待生成': ['Not generated', '待生成', '未生成', '생성 전', 'Ausstehend', 'À générer', 'Sin generar'],
  '这一页还没写完，写完会自动出现在这里。': ['This page is not written yet — it appears here as soon as it is.', '這一頁還沒寫完，寫完會自動出現在這裡。', 'このページはまだ書き終わっていません。書き終わるとここに表示されます。', '이 페이지는 아직 작성 중입니다. 완료되면 여기에 표시됩니다.', 'Diese Seite ist noch nicht geschrieben – sie erscheint hier, sobald sie fertig ist.', 'Cette page n’est pas encore écrite — elle apparaîtra ici dès qu’elle le sera.', 'Esta página aún no está escrita: aparecerá aquí en cuanto lo esté.'],
  '自由形式': ['Freeform', '自由形式', 'フリーフォーム', '자유 형식', 'Freiform', 'Libre', 'Libre'],
  '网格视图': ['Grid view', '網格檢視', 'グリッド表示', '그리드 보기', 'Rasteransicht', 'Vue grille', 'Vista de cuadrícula'],
  '大纲视图': ['Outline view', '大綱檢視', 'アウトライン表示', '개요 보기', 'Gliederungsansicht', 'Vue plan', 'Vista de esquema'],
  '撤销': ['Undo', '復原', '元に戻す', '실행 취소', 'Rückgängig', 'Annuler', 'Deshacer'],
  '重做': ['Redo', '重做', 'やり直す', '다시 실행', 'Wiederholen', 'Rétablir', 'Rehacer'],
  '撤销：': ['Undo: ', '復原：', '元に戻す：', '실행 취소: ', 'Rückgängig: ', 'Annuler : ', 'Deshacer: '],
  '重做：': ['Redo: ', '重做：', 'やり直す：', '다시 실행: ', 'Wiederholen: ', 'Rétablir : ', 'Rehacer: '],
  '已撤销：': ['Undone: ', '已復原：', '元に戻しました：', '실행 취소됨: ', 'Rückgängig gemacht: ', 'Annulé : ', 'Deshecho: '],
  '已重做：': ['Redone: ', '已重做：', 'やり直しました：', '다시 실행됨: ', 'Wiederholt: ', 'Rétabli : ', 'Rehecho: '],
  '正在打磨细节…': ['Polishing details…', '正在打磨細節…', '細部を整えています…', '세부 사항을 다듬는 중…', 'Details werden verfeinert…', 'Finitions en cours…', 'Puliendo detalles…'],
  '添加版块': ['Add block', '新增區塊', 'ブロックを追加', '블록 추가', 'Block hinzufügen', 'Ajouter un bloc', 'Añadir bloque'],
  '添加': ['Add', '新增', '追加', '추가', 'Hinzufügen', 'Ajouter', 'Añadir'],
  '先确认大纲，再往页里加东西': ['Confirm the outline first, then add to a page', '先確認大綱，再往頁裡加東西', 'まずアウトラインを確定してからページに追加してください', '먼저 개요를 확정한 뒤 페이지에 추가하세요', 'Bestätige zuerst die Gliederung, dann füge etwas hinzu', 'Confirmez d’abord le plan, puis ajoutez du contenu', 'Confirma primero el esquema y luego añade contenido'],
  '先确认大纲，再加页': ['Confirm the outline first, then add pages', '先確認大綱，再加頁', 'まずアウトラインを確定してからページを追加してください', '먼저 개요를 확정한 뒤 페이지를 추가하세요', 'Bestätige zuerst die Gliederung, dann füge Seiten hinzu', 'Confirmez d’abord le plan, puis ajoutez des pages', 'Confirma primero el esquema y luego añade páginas'],
  '待生成的一页': ['Not started yet', '待產生的一頁', '未生成のページ', '아직 생성되지 않은 페이지', 'Noch nicht erstellt', 'Pas encore générée', 'Aún sin generar'],
  '已完成 %s 页': ['Done — %s pages', '已完成 %s 頁', '完了 — %s ページ', '완료 — %s장', 'Fertig – %s Seiten', 'Terminé — %s pages', 'Listo: %s páginas'],
  '%s 分': ['Score %s', '%s 分', '%s 点', '%s점', '%s Punkte', '%s points', '%s puntos'],
  '已停止 · 已生成 %s / %s 页': ['Stopped · %s of %s pages built', '已停止 · 已產生 %s / %s 頁', '停止しました · %s / %s ページ作成済み', '중지됨 · %s / %s장 생성됨', 'Gestoppt · %s von %s Seiten erstellt', 'Arrêté · %s / %s pages générées', 'Detenido · %s / %s páginas creadas'],
  '重新生成': ['Regenerate', '重新生成', '再生成', '다시 생성', 'Neu erstellen', 'Régénérer', 'Volver a generar'],
  '停止生成': ['Stop generating', '停止生成', '生成を停止', '생성 중지', 'Erstellung stoppen', 'Arrêter la génération', 'Detener la generación'],
  '生成没能继续：%s': ['Generation could not continue: %s', '生成沒能繼續：%s', '生成を続けられませんでした：%s', '생성을 계속할 수 없습니다: %s', 'Erstellung konnte nicht fortgesetzt werden: %s', 'La génération n’a pas pu continuer : %s', 'La generación no pudo continuar: %s'],
  '正在生成，跑完或点停止后再改大纲': ['Still generating — wait for it to finish or stop it before editing the outline', '正在生成，跑完或點停止後再改大綱', '生成中です。完了するか停止してからアウトラインを編集してください', '생성 중입니다. 완료되거나 중지된 후 개요를 수정하세요', 'Läuft noch – warten Sie das Ende ab oder stoppen Sie, bevor Sie die Gliederung ändern', 'Génération en cours — attendez la fin ou arrêtez avant de modifier le plan', 'Generando: espera a que termine o detenlo antes de editar el esquema'],
  '大纲已复制，可直接粘贴分享': ['Outline copied — paste it anywhere to share', '大綱已複製，可直接貼上分享', 'アウトラインをコピーしました。貼り付けて共有できます', '개요를 복사했습니다. 붙여넣어 공유하세요', 'Gliederung kopiert – zum Teilen einfach einfügen', 'Plan copié — collez-le pour le partager', 'Esquema copiado: pégalo donde quieras para compartirlo'],
  '复制失败，浏览器没给剪贴板权限': ['Copy failed — the browser blocked clipboard access', '複製失敗，瀏覽器沒有給予剪貼簿權限', 'コピーできませんでした（クリップボード権限なし）', '복사하지 못했습니다(클립보드 권한 없음)', 'Kopieren fehlgeschlagen – kein Zugriff auf die Zwischenablage', 'Copie impossible — accès au presse-papiers refusé', 'No se pudo copiar: el navegador bloqueó el portapapeles'],
  '规划模式': ['Plan mode', '規劃模式', '計画モード', '기획 모드', 'Planungsmodus', 'Mode plan', 'Modo plan'],
  '快速模式': ['Express mode', '快速模式', 'エクスプレスモード', '빠른 모드', 'Express-Modus', 'Mode express', 'Modo exprés'],
  '研究模式': ['Research mode', '研究模式', 'リサーチモード', '리서치 모드', 'Recherchemodus', 'Mode recherche', 'Modo investigación'],
  '先出计划，你确认后再逐页生成': ['Plan first, build page by page after you confirm', '先出計劃，你確認後再逐頁生成', 'まず計画、確認後に 1 ページずつ生成', '먼저 계획, 확인 후 한 장씩 생성', 'Erst Plan, nach Bestätigung Seite für Seite', 'Plan d’abord, génération après confirmation', 'Primero el plan; luego, página a página'],
  '不等确认，出来一页看一页': ['No waiting — each page appears as it is made', '不等確認，出來一頁看一頁', '確認なしで 1 ページずつ表示', '확인 없이 한 장씩 표시', 'Ohne Warten – Seite für Seite sichtbar', 'Sans attendre, chaque page apparaît', 'Sin esperas: cada página aparece al hacerse'],
  '先核对关键词口径，再出计划': ['Verify key figures first, then plan', '先核對關鍵詞口徑，再出計劃', '先に指標を確認してから計画', '키 기준을 먼저 확인한 뒤 계획', 'Erst Kennzahlen prüfen, dann planen', 'Vérifier les chiffres, puis planifier', 'Verificar cifras y luego planificar'],
  '通过': ['Pass', '通過', '合格', '통과', 'Bestanden', 'Validé', 'Aprobado'],
  '得分': ['Score', '得分', 'スコア', '점수', 'Punkte', 'Score', 'Puntuación'],
  '已修': ['Fixed', '已修', '修正済み', '수정됨', 'Behoben', 'Corrigé', 'Corregido'],
  '错误': ['Error', '錯誤', 'エラー', '오류', 'Fehler', 'Erreur', 'Error'],
  '提醒': ['Note', '提醒', '注意', '알림', 'Hinweis', 'Remarque', 'Aviso'],
  '还没开始生成，等一下。': ['Generation has not started yet — give it a moment.', '還沒開始生成，等一下。', 'まだ生成が始まっていません。少しお待ちを。', '아직 생성이 시작되지 않았습니다. 잠시만요.', 'Die Generierung läuft noch nicht – einen Moment.', 'La génération n’a pas commencé, un instant.', 'La generación aún no ha empezado, espera un momento.'],
  '这句没对上具体页面，说「第 3 页…」更准。': ['That did not point at a page — try “page 3 …”.', '這句沒對上具體頁面，說「第 3 頁…」更準。', 'ページが特定できません。「3 ページ目…」のように言ってください。', '어느 페이지인지 알 수 없습니다. “3페이지…”처럼 말해 주세요.', 'Das traf keine Seite – versuch „Seite 3 …“.', 'Cela ne cible aucune page — dites « page 3 … ».', 'Eso no señala una página: prueba «página 3 …».'],
  '开始生成 %s 页': ['Start generating %s pages', '開始生成 %s 頁', '%s ページ生成を開始', '%s장 생성 시작', '%s Seiten generieren', 'Générer %s pages', 'Generar %s páginas'],
  '计划就绪，确认后开始': ['Plan ready — confirm to start', '計劃就緒，確認後開始', '計画完成、確認後に開始', '계획 준비 완료, 확인 후 시작', 'Plan bereit – bestätigen zum Start', 'Plan prêt — confirmez pour démarrer', 'Plan listo: confirma para empezar'],
  '计划就绪，开始逐页生成…': ['Plan ready — building page by page…', '計劃就緒，開始逐頁生成…', '計画完成、1 ページずつ生成中…', '계획 완료, 한 장씩 생성 중…', 'Plan bereit – baue Seite für Seite …', 'Plan prêt — génération page par page…', 'Plan listo: generando página a página…'],
  '开始逐页生成…': ['Building page by page…', '開始逐頁生成…', '1 ページずつ生成中…', '한 장씩 생성 중…', 'Baue Seite für Seite …', 'Génération page par page…', 'Generando página a página…'],
  '质量审核中…': ['Quality review…', '品質審核中…', '品質レビュー中…', '품질 검토 중…', 'Qualitätsprüfung …', 'Contrôle qualité…', 'Revisión de calidad…'],
  '正在理解需求…': ['Reading the brief…', '正在理解需求…', '要件を読み取り中…', '요구사항 파악 중…', 'Briefing wird gelesen…', 'Lecture du brief…', 'Leyendo el brief…'],
  '%s正在处理…': ['%s is working…', '%s 正在處理…', '%s が処理中…', '%s 처리 중…', '%s arbeitet …', '%s travaille…', '%s trabajando…'],
  '正在生成第 %s 页 · 共 %s 页': ['Building page %s of %s', '正在生成第 %s 頁 · 共 %s 頁', '%s / %s ページ目を生成中', '%s / %s 페이지 생성 중', 'Seite %s von %s', 'Page %s sur %s', 'Página %s de %s'],
  '已完成 %s 页 · %s': ['Done — %s pages · %s', '已完成 %s 頁 · %s', '完了 — %s ページ · %s', '완료 — %s장 · %s', 'Fertig – %s Seiten · %s', 'Terminé — %s pages · %s', 'Listo: %s páginas · %s'],
  '生成没能开始：%s': ['Could not start: %s', '生成沒能開始：%s', '開始できませんでした：%s', '시작하지 못했습니다: %s', 'Start fehlgeschlagen: %s', 'Démarrage impossible : %s', 'No se pudo iniciar: %s'],
  '继续生成失败：%s': ['Could not continue: %s', '繼續生成失敗：%s', '続行できませんでした：%s', '계속 생성 실패: %s', 'Fortsetzen fehlgeschlagen: %s', 'Reprise impossible : %s', 'No se pudo continuar: %s'],
  '修改没生效：%s': ['Change failed: %s', '修改沒生效：%s', '変更が反映されません：%s', '수정 실패: %s', 'Änderung fehlgeschlagen: %s', 'Modification échouée : %s', 'El cambio falló: %s'],
  '内容、密度、重复与数据支撑都过了 · %s 分': ['Content, density, repetition and data checks all passed · %s pts', '內容、密度、重複與數據支撐都過了 · %s 分', '内容・密度・重複・根拠すべて合格 · %s 点', '내용·밀도·중복·근거 모두 통과 · %s점', 'Inhalt, Dichte, Wiederholung und Belege bestanden · %s Punkte', 'Contenu, densité, répétitions et sources validés · %s pts', 'Contenido, densidad, repetición y datos superados · %s pts'],
  '%s 分 · 查 %s 处，已自动修 %s 处': ['%s pts · %s issues found, %s auto-fixed', '%s 分 · 查 %s 處，已自動修 %s 處', '%s 点 · %s 件検出、%s 件を自動修正', '%s점 · %s건 발견, %s건 자동 수정', '%s Punkte · %s Punkte gefunden, %s automatisch behoben', '%s pts · %s points relevés, %s corrigés', '%s pts · %s hallazgos, %s corregidos'],
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
  '把内容变成方案': ['Turn what you have into a proposal', '把內容變成提案', '手持ちの内容を提案書に', '가진 내용을 제안서로', 'Aus Inhalten wird ein Konzept', 'De vos contenus à une proposition', 'Convierte tu contenido en una propuesta'],
  '从空白新建': ['Start blank', '從空白新增', '空白から作成', '빈 문서로 시작', 'Leer starten', 'Partir de zéro', 'Empezar en blanco'],
  '创建': ['Create', '建立', '作成', '만들기', 'Erstellen', 'Créer', 'Crear'],
  '升级获得更多 AI 功能': ['Upgrade for more AI', '升級取得更多 AI 功能', 'アップグレードで AI 機能を拡張', '업그레이드하고 AI 기능 더 받기', 'Upgrade für mehr KI', 'Passez à l’offre supérieure pour plus d’IA', 'Mejora para más IA'],
  '使用经典版生成工具': ['Use classic generator', '使用經典版產生工具', 'クラシック版の生成ツールを使う', '클래식 생성 도구 사용', 'Klassischen Generator verwenden', 'Utiliser le générateur classique', 'Usar el generador clásico'],
  '最近的对话记录': ['Recent chats', '最近的對話記錄', '最近のチャット', '최근 대화', 'Letzte Chats', 'Conversations récentes', 'Chats recientes'],
  '最近的 DesignBuddy 作品': ['Recent DesignBuddy decks', '最近的 DesignBuddy 作品', '最近の DesignBuddy 作品', '최근 DesignBuddy 작품', 'Letzte DesignBuddy-Präsentationen', 'Créations DesignBuddy récentes', 'Creaciones recientes de DesignBuddy'],
  '搜索': ['Search', '搜尋', '検索', '검색', 'Suchen', 'Rechercher', 'Buscar'],
  '与您共享': ['Shared with you', '與您共用', '共有アイテム', '공유받은 항목', 'Mit Ihnen geteilt', 'Partagé avec vous', 'Compartido contigo'],
  '网站': ['Websites', '網站', 'ウェブサイト', '웹사이트', 'Websites', 'Sites web', 'Sitios web'],
  'API 生成': ['API generation', 'API 產生', 'API 生成', 'API 생성', 'API-Erstellung', 'Génération d’API', 'Generación de API'],
  '文件夹': ['Folders', '資料夾', 'フォルダー', '폴더', 'Ordner', 'Dossiers', 'Carpetas'],
  '将相关的 DesignBuddy 作品分组，并一次性全部分享。': ['Group related DesignBuddy decks and share them all at once.', '將相關的 DesignBuddy 作品分組，並一次全部分享。', '関連する DesignBuddy 作品をまとめて一度に共有できます。', '관련 DesignBuddy 작품을 묶어 한 번에 공유하세요.', 'Gruppieren Sie verwandte DesignBuddy-Präsentationen und teilen Sie sie auf einmal.', 'Regroupez les créations DesignBuddy associées et partagez-les d’un coup.', 'Agrupa las creaciones de DesignBuddy relacionadas y compártelas de una vez.'],
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
  '设置 DesignBuddy 对话中链接的默认打开策略。': ['Choose how links in DesignBuddy open.', '設定 DesignBuddy 對話中連結的預設開啟策略。', 'DesignBuddy のチャットでリンクを開く既定の方法を設定します。', 'DesignBuddy 대화에서 링크를 여는 기본 방식을 설정합니다.', 'Legen Sie fest, wie Links in DesignBuddy geöffnet werden.', 'Choisissez comment les liens s’ouvrent dans DesignBuddy.', 'Elige cómo se abren los enlaces en DesignBuddy.'],
  '字体大小': ['Font size', '字型大小', '文字サイズ', '글자 크기', 'Schriftgröße', 'Taille du texte', 'Tamaño de letra'],
  '小': ['Small', '小', '小', '작게', 'Klein', 'Petit', 'Pequeño'],
  '大': ['Large', '大', '大', '크게', 'Groß', 'Grand', 'Grande'],
  '默认': ['Default', '預設', '標準', '기본', 'Standard', 'Par défaut', 'Predeterminado'],
  '默认打开方式': ['Default open method', '預設開啟方式', '既定の開き方', '기본 열기 방식', 'Standard-Öffnung', 'Ouverture par défaut', 'Apertura predeterminada'],
  '设置用 DesignBuddy 独立文件浏览器打开本地文件的默认方式。': ['Choose how local files open in the file browser.', '設定用 DesignBuddy 獨立檔案瀏覽器開啟本機檔案的預設方式。', 'DesignBuddy のファイルブラウザーでローカルファイルを開く既定の方法を設定します。', 'DesignBuddy 파일 브라우저에서 로컬 파일을 여는 기본 방식을 설정합니다.', 'Legen Sie fest, wie lokale Dateien im Dateibrowser geöffnet werden.', 'Choisissez comment les fichiers locaux s’ouvrent dans le navigateur de fichiers.', 'Elige cómo se abren los archivos locales en el explorador de archivos.'],
  '权限': ['Permissions', '權限', '権限', '권한', 'Berechtigungen', 'Autorisations', 'Permisos'],
  '允许锁屏运行': ['Run while locked', '允許鎖定螢幕時執行', 'ロック中も実行', '잠금 상태에서도 실행', 'Bei Sperre ausführen', 'Exécuter en cas de verrouillage', 'Ejecutar con bloqueo'],
  '选择锁屏后的运行方式，保障远程控制与后台 Agent 任务持续执行。': ['Choose how tasks keep running while locked.', '選擇鎖定螢幕後的執行方式，確保遠端控制與背景 Agent 任務持續執行。', 'ロック後の実行方法を選び、リモート操作とバックグラウンドの Agent タスクを継続します。', '잠금 후 실행 방식을 선택해 원격 제어와 백그라운드 Agent 작업이 계속 실행되게 합니다.', 'Wählen Sie, wie Aufgaben bei Sperre weiterlaufen.', 'Choisissez comment les tâches continuent une fois l’écran verrouillé.', 'Elige cómo siguen las tareas con el equipo bloqueado.'],
  '运行时防止系统休眠': ['Prevent sleep while running', '執行時防止系統休眠', '実行中はスリープしない', '실행 중 절전 방지', 'Ruhezustand verhindern', 'Empêcher la veille', 'Evitar la suspensión'],
  '在 DesignBuddy 运行任务时，让电脑保持唤醒状态。': ['Keep the computer awake while DesignBuddy is running.', '在 DesignBuddy 執行任務時，讓電腦保持喚醒狀態。', 'DesignBuddy の実行中はコンピューターをスリープさせません。', 'DesignBuddy가 작업하는 동안 컴퓨터를 깨어 있게 유지합니다.', 'Hält den Computer wach, während DesignBuddy läuft.', 'Garde l’ordinateur éveillé pendant l’exécution.', 'Mantiene el equipo despierto mientras se ejecuta.'],
  '开机自动启动': ['Launch at login', '開機自動啟動', 'ログイン時に起動', '로그인 시 자동 실행', 'Bei Anmeldung starten', 'Lancer à la connexion', 'Iniciar al arrancar'],
  '开启后 DesignBuddy 会在你登录电脑后自动启动。': ['Launch DesignBuddy automatically after you sign in.', '開啟後 DesignBuddy 會在您登入電腦後自動啟動。', 'オンにすると、サインイン後に DesignBuddy が自動で起動します。', '켜면 로그인 후 DesignBuddy가 자동으로 실행됩니다.', 'Startet DesignBuddy automatisch nach der Anmeldung.', 'Lance DesignBuddy automatiquement après la connexion.', 'Inicia DesignBuddy automáticamente al iniciar sesión.'],
  '网络代理': ['Network proxy', '網路代理', 'ネットワークプロキシ', '네트워크 프록시', 'Netzwerk-Proxy', 'Proxy réseau', 'Proxy de red'],
  '网络异常时可切换连接方式，修改后立即生效': ['Switch connection mode if the network misbehaves.', '網路異常時可切換連線方式，修改後立即生效', 'ネットワークに問題があるとき接続方法を切り替えられます。変更はすぐに反映されます。', '네트워크가 불안정할 때 연결 방식을 바꿀 수 있으며 즉시 적용됩니다.', 'Wechseln Sie bei Netzproblemen die Verbindung; Änderungen gelten sofort.', 'Changez de mode de connexion en cas de problème réseau ; effet immédiat.', 'Cambia el modo de conexión si la red falla; se aplica al instante.'],
  '自动安装可信技能': ['Auto-install trusted skills', '自動安裝可信技能', '信頼できるスキルを自動インストール', '신뢰할 수 있는 스킬 자동 설치', 'Vertrauenswürdige Fähigkeiten automatisch installieren', 'Installer automatiquement les compétences fiables', 'Instalar habilidades de confianza'],
  '自动安装来自可信来源的技能，扩展 Agent 能力。': ['Install skills from trusted sources automatically.', '自動安裝來自可信來源的技能，擴充 Agent 能力。', '信頼できる提供元のスキルを自動でインストールし、Agent の能力を広げます。', '신뢰할 수 있는 출처의 스킬을 자동 설치해 Agent 기능을 확장합니다.', 'Installiert Fähigkeiten aus vertrauenswürdigen Quellen automatisch.', 'Installe automatiquement les compétences de sources fiables.', 'Instala habilidades de fuentes fiables automáticamente.'],
  '关闭': ['Off', '關閉', 'オフ', '끔', 'Aus', 'Désactivé', 'Desactivado'],
  '允许': ['Allow', '允許', '許可', '허용', 'Erlauben', 'Autoriser', 'Permitir'],
  '拒绝': ['Deny', '拒絕', '拒否', '거부', 'Ablehnen', 'Refuser', 'Rechazar'],
  '等待你确认写操作': ['Waiting for your approval', '等待你確認寫操作', '書き込みの確認待ち', '쓰기 작업 확인 대기 중', 'Warten auf deine Freigabe', 'En attente de votre validation', 'Esperando tu aprobación'],
  '这个工具会改动远端数据，点「允许」之前不会执行。': ['This tool changes data on the remote service. Nothing runs until you click Allow.', '這個工具會改動遠端資料，點「允許」之前不會執行。', 'このツールはリモートのデータを変更します。「許可」を押すまで実行されません。', '이 도구는 원격 데이터를 변경합니다. 「허용」을 누르기 전에는 실행되지 않습니다.', 'Dieses Tool ändert Daten beim Dienst. Bis du auf „Erlauben“ klickst, passiert nichts.', 'Cet outil modifie des données distantes. Rien ne s’exécute avant que vous ne cliquiez sur Autoriser.', 'Esta herramienta modifica datos remotos. No se ejecuta hasta que pulses Permitir.'],
  '这张确认卡已经失效': ['This approval request has expired', '這張確認卡已經失效', 'この確認はすでに無効です', '이 확인 카드는 만료되었습니다', 'Diese Freigabe ist nicht mehr gültig', 'Cette demande de validation a expiré', 'Esta solicitud de aprobación ha caducado'],
  '已允许这次写操作': ['Write approved', '已允許這次寫操作', '書き込みを許可しました', '쓰기 작업을 허용했습니다', 'Schreibvorgang freigegeben', 'Écriture autorisée', 'Escritura aprobada'],
  '已拒绝这次写操作': ['Write denied', '已拒絕這次寫操作', '書き込みを拒否しました', '쓰기 작업을 거부했습니다', 'Schreibvorgang abgelehnt', 'Écriture refusée', 'Escritura rechazada'],
  '提交确认失败：%s': ['Could not send your answer: %s', '提交確認失敗：%s', '確認の送信に失敗しました：%s', '확인 전송 실패: %s', 'Antwort konnte nicht gesendet werden: %s', 'Impossible d’envoyer votre réponse : %s', 'No se pudo enviar tu respuesta: %s'],
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
  '整站字号按比例缩放，幻灯片画布保持原尺寸': ['Scales type across the app; slide canvases keep their size', '整站字號按比例縮放，簡報畫布保持原尺寸', 'アプリ全体の文字を拡大縮小（スライドは原寸のまま）', '앱 전체 글자 크기를 조절합니다. 슬라이드 캔버스는 원래 크기 유지', 'Skaliert die Schrift in der ganzen App; Folien bleiben unverändert', 'Met à l’échelle le texte de l’app ; les diapos gardent leur taille', 'Escala el texto de toda la app; las diapositivas mantienen su tamaño'],
  '界面密度': ['Density', '介面密度', '表示密度', '화면 밀도', 'Dichte', 'Densité', 'Densidad'],
  '舒适': ['Comfortable', '舒適', 'ゆったり', '여유롭게', 'Komfortabel', 'Confortable', 'Cómoda'],
  '紧凑': ['Compact', '緊湊', 'コンパクト', '촘촘하게', 'Kompakt', 'Compact', 'Compacta'],
  '等宽字体': ['Monospace', '等寬字型', '等幅フォント', '고정폭 글꼴', 'Monospace', 'Monospace', 'Monoespaciada'],
  // ── 会员中心 ──
  '会员': ['Member', '會員', 'メンバー', '멤버', 'Mitglied', 'Membre', 'Miembro'],
  '今日额度': ['Today\u2019s quota', '今日額度', '本日の割当', '오늘의 한도', 'Tageskontingent', 'Quota du jour', 'Cuota de hoy'],
  '运行次数': ['Runs', '執行次數', '実行回数', '실행 횟수', 'Läufe', 'Exécutions', 'Ejecuciones'],
  '会话': ['Chats', '工作階段', 'セッション', '세션', 'Chats', 'Sessions', 'Chats'],
  '会话列表': ['Chat list', '工作階段列表', 'セッション一覧', '세션 목록', 'Chat-Liste', 'Liste des sessions', 'Lista de chats'],
  '恢复默认': ['Reset', '恢復預設', '既定に戻す', '기본값으로', 'Zurücksetzen', 'Réinitialiser', 'Restablecer'],
  '按下组合键…': ['Press keys…', '按下組合鍵…', 'キーを押してください…', '키를 누르세요…', 'Tasten drücken…', 'Appuyez sur les touches…', 'Pulsa las teclas…'],
  '点右侧按键即可重新录制（需带 Ctrl / ⌘）；录制中按 Esc 取消。快捷键保存在本机。': ['Click the key chip to re-record (needs Ctrl / ⌘); press Esc while recording to cancel. Shortcuts are stored locally.', '點右側按鍵即可重新錄製（需帶 Ctrl / ⌘）；錄製中按 Esc 取消。快速鍵儲存在本機。', '右側のキーを押すと録り直せます（Ctrl / ⌘ 必須）。録音中に Esc で取消。設定はローカルに保存されます。', '오른쪽 키를 눌러 다시 기록하세요(Ctrl / ⌘ 필요). 기록 중 Esc로 취소합니다. 설정은 로컬에 저장됩니다.', 'Zum Neuaufnehmen auf die Taste klicken (mit Ctrl / ⌘); Esc bricht ab. Tastenkürzel werden lokal gespeichert.', 'Cliquez sur la touche pour réenregistrer (avec Ctrl / ⌘) ; Échap annule. Les raccourcis restent en local.', 'Haz clic en la tecla para volver a grabarla (con Ctrl / ⌘); Esc cancela. Los atajos se guardan en local.'],
  '运行时防止休眠': ['Keep the screen awake', '執行時防止休眠', '実行中はスリープしない', '실행 중 절전 방지', 'Bildschirm wach halten', 'Garder l’écran éveillé', 'Evitar que se apague'],
  '任务运行期间向浏览器申请屏幕唤醒锁，任务结束后自动释放；浏览器不支持时会自动跳过。': ['Requests a screen wake lock while a task runs and releases it afterwards; skipped when the browser does not support it.', '任務執行期間向瀏覽器申請螢幕喚醒鎖，結束後自動釋放；瀏覽器不支援時會自動跳過。', '実行中はスクリーンウェイクロックを要求し、終了後に解放します。非対応のブラウザーではスキップします。', '실행 중 화면 깨우기 잠금을 요청하고 끝나면 해제합니다. 지원하지 않으면 건너뜁니다.', 'Fordert während einer Aufgabe eine Bildschirm-Wachsperre an und gibt sie danach frei.', 'Demande un verrou d’écran pendant une tâche puis le libère.', 'Solicita mantener la pantalla activa durante la tarea y la libera al acabar.'],
  '界面主题': ['Theme', '介面主題', 'テーマ', '화면 테마', 'Design', 'Thème', 'Tema'],
  '跟随系统': ['System', '跟隨系統', 'システムに合わせる', '시스템 설정', 'System', 'Système', 'Sistema'],
  '浅色': ['Light', '淺色', 'ライト', '라이트', 'Hell', 'Clair', 'Claro'],
  '深色': ['Dark', '深色', 'ダーク', '다크', 'Dunkel', 'Sombre', 'Oscuro'],
  '跟随系统时，系统切换深色会自动跟随': ['On System it follows your OS appearance.', '跟隨系統時，系統切換深色會自動跟隨。', 'システムに合わせると、OS の外観に自動で従います。', '시스템 설정이면 OS 화면 모드를 따릅니다.', 'Bei „System“ folgt es der Systemdarstellung.', 'Sur « Système », l’apparence du système est suivie.', 'Con Sistema sigue la apariencia del sistema.'],
  '免费版': ['Free', '免費版', '無料版', '무료', 'Kostenlos', 'Gratuit', 'Gratis'],
  '本地工作区': ['Local workspace', '本機工作區', 'ローカルワークスペース', '로컬 워크스페이스', 'Lokaler Arbeitsbereich', 'Espace local', 'Espacio local'],
  '字号': ['Font size', '字級', '文字サイズ', '글자 크기', 'Schriftgröße', 'Taille du texte', 'Tamaño de letra'],
  '本机运行，无订阅费用；每天 20 万 tokens 免费额度': ['Runs locally, no subscription; 200k free tokens a day', '本機執行，不產生訂閱費用；每天 20 萬 tokens 免費額度', 'この端末で動作し、購読料なし。1 日 20 万トークンまで無料', '이 기기에서 실행되며 구독료가 없습니다. 하루 20만 토큰까지 무료', 'Läuft lokal, kein Abo; 200k Token pro Tag gratis', 'Tourne en local, sans abonnement ; 200 k tokens gratuits par jour', 'Se ejecuta en local, sin suscripción; 200 k tokens gratis al día'],
  '全部功能在本机运行，无订阅费用': ['Every feature runs locally, no subscription fee', '全部功能在本機執行，不產生訂閱費用', 'すべての機能はこの端末で動作し、購読料はかかりません', '모든 기능이 이 기기에서 실행되며 구독료가 없습니다', 'Alle Funktionen laufen lokal, ohne Abo-Gebühr', 'Toutes les fonctions tournent en local, sans abonnement', 'Todo funciona en tu equipo, sin suscripción'],
  '数据保存在本机浏览器': ['Data stays in this browser', '資料儲存在本機瀏覽器', 'データはこのブラウザーに保存されます', '데이터는 이 브라우저에 저장됩니다', 'Daten bleiben in diesem Browser', 'Les données restent dans ce navigateur', 'Los datos se quedan en este navegador'],
  '对话、工具输出与代码块用等宽字体（汉字没有等宽字形，沿用系统字体）': ['Monospace for chat, tool output and code (CJK keeps the system font)', '對話、工具輸出與程式碼區塊用等寬字型（漢字沒有等寬字形，沿用系統字型）', 'チャット・ツール出力・コードを等幅フォントに（漢字は等幅字形がないためシステムフォント）', '대화·도구 출력·코드 블록에 고정폭 글꼴 사용(한자는 고정폭 글리프가 없어 시스템 글꼴 유지)', 'Monospace für Chat, Tool-Ausgabe und Code (CJK bleibt Systemschrift)', 'Police monospace pour le chat, la sortie d’outils et le code (le CJK garde sa police)', 'Monoespaciada en chat, salida de herramientas y código (el CJK mantiene su fuente)'],
  '紧凑档收窄留白与行高，一屏多放一些内容': ['Compact tightens padding and row heights to fit more on screen', '緊湊檔收窄留白與行高，一屏多放一些內容', 'コンパクトは余白と行高を詰めて、一画面に多く表示します', '좁게 설정하면 여백과 행 높이를 줄여 한 화면에 더 많이 표시합니다', 'Kompakt verringert Abstände und Zeilenhöhen für mehr Inhalt', 'Compact réduit les marges et les hauteurs de ligne pour afficher plus', 'Compacto reduce márgenes y alturas para mostrar más'],
  '这段就是刚才三项设置的实际效果': ['This is the three settings above, applied live', '這段就是剛才三項設定的實際效果', 'この段落に上の 3 つの設定がそのまま反映されています', '위 세 가지 설정이 이 문단에 그대로 적용됩니다', 'Genau diese drei Einstellungen wirken hier', 'Les trois réglages ci-dessus s’appliquent ici', 'Los tres ajustes de arriba se aplican aquí'],
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
  // ── 主题页（自定义） ──
  '自定义字体': ['Custom fonts', '自訂字型', 'カスタムフォント', '사용자 지정 글꼴', 'Eigene Schriften', 'Polices personnalisées', 'Fuentes personalizadas'],
  '自定义指令': ['Custom instructions', '自訂指令', 'カスタム指示', '사용자 지정 지침', 'Eigene Anweisungen', 'Instructions personnalisées', 'Instrucciones personalizadas'],
  '测试版': ['Beta', '測試版', 'ベータ版', '베타', 'Beta', 'Bêta', 'Beta'],
  '图标库': ['Icon library', '圖示庫', 'アイコンライブラリ', '아이콘 라이브러리', 'Icon-Bibliothek', "Bibliothèque d'icônes", 'Biblioteca de iconos'],
  '新建主题': ['New theme', '新增主題', '新しいテーマ', '새 테마', 'Neues Design', 'Nouveau thème', 'Nuevo tema'],
  '按标题、关键字、作者姓名等搜索': ['Search by title, keyword, or author', '依標題、關鍵字、作者姓名搜尋', 'タイトル・キーワード・作成者で検索', '제목, 키워드, 작성자로 검색', 'Nach Titel, Stichwort oder Autor suchen', 'Rechercher par titre, mot-clé ou auteur', 'Buscar por título, palabra clave o autor'],
  'theme.sub': ['Pick a theme and the accent color switches right away, remembered in your local preferences.', '選一個主題，介面的強調色會立刻換成它，並記在本地偏好裡。', 'テーマを選ぶとアクセントカラーがすぐ切り替わり、ローカルの設定に保存されます。', '테마를 고르면 강조 색이 바로 바뀌고 로컬 설정에 저장됩니다.', 'Wählen Sie ein Design – die Akzentfarbe wechselt sofort und wird lokal gespeichert.', 'Choisissez un thème : la couleur d’accent change aussitôt et reste enregistrée en local.', 'Elige un tema y el color de acento cambia al instante y queda guardado en tus preferencias locales.'],
  '标题': ['Title', '標題', 'タイトル', '제목', 'Titel', 'Titre', 'Título'],
  '正文和': ['Body and ', '正文和', '本文と', '본문 및 ', 'Text und ', 'Texte et ', 'Texto y '],
  '链接': ['link', '連結', 'リンク', '링크', 'Link', 'lien', 'enlace'],
  '还没有自定义主题': ['No custom themes yet', '尚無自訂主題', 'カスタムテーマはまだありません', '사용자 지정 테마가 없습니다', 'Noch keine eigenen Designs', 'Aucun thème personnalisé', 'Aún no hay temas personalizados'],
  '点「新建主题」开始创建。': ['Click “New theme” to create one.', '點「新增主題」開始建立。', '「新しいテーマ」から作成できます。', '"새 테마"를 눌러 시작하세요.', 'Klicken Sie auf „Neues Design“, um zu starten.', 'Cliquez sur « Nouveau thème » pour commencer.', 'Haz clic en «Nuevo tema» para empezar.'],
  '没有已归档的主题': ['No archived themes', '沒有已封存的主題', 'アーカイブされたテーマはありません', '보관된 테마가 없습니다', 'Keine archivierten Designs', 'Aucun thème archivé', 'No hay temas archivados'],
  '归档后的主题会出现在这里。': ['Archived themes will appear here.', '封存後的主題會顯示在這裡。', 'アーカイブしたテーマがここに表示されます。', '보관한 테마가 여기에 표시됩니다.', 'Archivierte Designs erscheinen hier.', 'Les thèmes archivés apparaîtront ici.', 'Los temas archivados aparecerán aquí.'],
  '没有找到匹配的主题': ['No matching themes', '找不到符合的主題', '一致するテーマがありません', '일치하는 테마가 없습니다', 'Keine passenden Designs', 'Aucun thème correspondant', 'No hay temas coincidentes'],
  '换个关键字试试。': ['Try another keyword.', '換個關鍵字試試。', '別のキーワードをお試しください。', '다른 키워드를 사용해 보세요.', 'Versuchen Sie ein anderes Stichwort.', 'Essayez un autre mot-clé.', 'Prueba con otra palabra clave.'],
  // ── 探索模板页（模版库） ──
  '工作区模板': ['Workspace templates', '工作區範本', 'ワークスペースのテンプレート', '워크스페이스 템플릿', 'Arbeitsbereich-Vorlagen', "Modèles d'espace", 'Plantillas del espacio'],
  '最近': ['Recent', '最近', '最近', '최근', 'Zuletzt', 'Récents', 'Recientes'],
  '由您创建': ['Created by you', '由您建立', '作成したもの', '내가 만든 항목', 'Von Ihnen erstellt', 'Créés par vous', 'Creados por ti'],
  '已归档': ['Archived', '已封存', 'アーカイブ済み', '보관됨', 'Archiviert', 'Archivés', 'Archivados'],
  '探索': ['Explore', '探索', '探索', '탐색', 'Entdecken', 'Explorer', 'Explorar'],
  '返回模板': ['Back to templates', '返回範本', 'テンプレートに戻る', '템플릿으로 돌아가기', 'Zurück zu Vorlagen', 'Retour aux modèles', 'Volver a plantillas'],
  '使用模板': ['Use template', '使用範本', 'テンプレートを使う', '템플릿 사용', 'Vorlage verwenden', 'Utiliser le modèle', 'Usar plantilla'],
  '最适合': ['Best for', '最適合', 'こんな用途に', '적합한 용도', 'Am besten für', 'Idéal pour', 'Ideal para'],
  '样式': ['Style', '樣式', 'スタイル', '스타일', 'Stil', 'Style', 'Estilo'],
  '分类': ['Category', '分類', 'カテゴリ', '카테고리', 'Kategorie', 'Catégorie', 'Categoría'],
  '探索模板': ['Explore templates', '探索範本', 'テンプレートを探す', '템플릿 탐색', 'Vorlagen entdecken', 'Explorer les modèles', 'Explorar plantillas'],
  '筛选器': ['Filters', '篩選器', 'フィルター', '필터', 'Filter', 'Filtres', 'Filtros'],
  '格式': ['Format', '格式', '形式', '형식', 'Format', 'Format', 'Formato'],
  '所有格式': ['All formats', '所有格式', 'すべての形式', '모든 형식', 'Alle Formate', 'Tous les formats', 'Todos los formatos'],
  '社交轮播卡片': ['Social carousel', '社群輪播卡片', 'ソーシャルカルーセル', '소셜 캐러셀', 'Social-Carousel', 'Carrousel social', 'Carrusel social'],
  '网站复刻': ['Website replica', '網站復刻', 'ウェブサイト再現', '웹사이트 재현', 'Website-Nachbau', 'Réplique de site', 'Réplica web'],
  '图片': ['Image', '圖片', '画像', '이미지', 'Bild', 'Image', 'Imagen'],
  '实时产物': ['Live artifact', '即時產物', 'ライブ成果物', '실시간 결과물', 'Live-Artefakt', 'Artefact live', 'Artefacto en vivo'],
  '视频': ['Video', '影片', '動画', '동영상', 'Video', 'Vidéo', 'Vídeo'],
  '音频': ['Audio', '音訊', '音声', '오디오', 'Audio', 'Audio', 'Audio'],
  'Hyper Frames': ['Hyper Frames', 'Hyper Frames', 'Hyper Frames', 'Hyper Frames', 'Hyper Frames', 'Hyper Frames', 'Hyper Frames'],
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
  'rail.library': ['Library', '資料庫', 'ライブラリ', '라이브러리', 'Bibliothek', 'Bibliothèque', 'Biblioteca'],
  'rail.templates': ['Templates', '範本', 'テンプレート', '템플릿', 'Vorlagen', 'Modèles', 'Plantillas'],
  'rail.theme': ['Theme', '主題', 'テーマ', '테마', 'Design', 'Thème', 'Tema'],
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


  // ── 连接器 / 模板引用 ──
  '正在读取连接器目录…': ['Loading the connector catalog…', '正在讀取連接器目錄…', 'コネクタ一覧を読み込み中…', '커넥터 목록을 불러오는 중…', 'Konnektor-Katalog wird geladen…', 'Chargement du catalogue de connecteurs…', 'Cargando el catálogo de conectores…'],
  '连接器目录没读到': ['Couldn’t load the connector catalog', '連接器目錄沒有讀到', 'コネクタ一覧を読み込めませんでした', '커넥터 목록을 불러오지 못했습니다', 'Konnektor-Katalog konnte nicht geladen werden', 'Impossible de charger le catalogue', 'No se pudo cargar el catálogo'],
  '重新读取': ['Reload', '重新讀取', '再読み込み', '다시 불러오기', 'Neu laden', 'Recharger', 'Recargar'],
  '还没有连接器': ['No connectors yet', '還沒有連接器', 'コネクタがまだありません', '아직 커넥터가 없습니다', 'Noch keine Konnektoren', 'Aucun connecteur pour l’instant', 'Aún no hay conectores'],
  '后端没有返回目录条目': ['The backend returned an empty catalog', '後端沒有回傳目錄項目', 'バックエンドが一覧を返しませんでした', '백엔드가 목록을 반환하지 않았습니다', 'Das Backend hat keinen Katalog geliefert', 'Le backend n’a renvoyé aucun catalogue', 'El backend no devolvió el catálogo'],
  '没有匹配的连接器': ['No matching connectors', '沒有符合的連接器', '一致するコネクタがありません', '일치하는 커넥터가 없습니다', 'Keine passenden Konnektoren', 'Aucun connecteur correspondant', 'No hay conectores coincidentes'],
  '换个关键词或筛选条件试试': ['Try another keyword or filter', '換個關鍵字或篩選條件試試', '別のキーワードや絞り込みを試してください', '다른 검색어나 필터를 사용해 보세요', 'Andere Suchbegriffe oder Filter probieren', 'Essayez un autre mot-clé ou filtre', 'Prueba con otra palabra clave o filtro'],
  '需重新授权': ['Reauthorize', '需重新授權', '再認証が必要', '다시 인증 필요', 'Neu autorisieren', 'Réautoriser', 'Volver a autorizar'],
  '筛出 %s 项 · %s / %s 已连接': ['%s shown · %s / %s connected', '篩出 %s 項 · %s / %s 已連接', '%s 件 · %s / %s 接続済み', '%s개 표시 · %s / %s 연결됨', '%s Treffer · %s / %s verbunden', '%s affichés · %s / %s connectés', '%s mostrados · %s / %s conectados'],
  '需要凭据': ['Needs credentials', '需要憑證', '認証情報が必要', '자격 증명 필요', 'Zugangsdaten nötig', 'Identifiants requis', 'Requiere credenciales'],
  '演示数据': ['Demo data', '示範資料', 'デモデータ', '데모 데이터', 'Demodaten', 'Données de démo', 'Datos de demostración'],
  '未连接': ['Not connected', '未連接', '未接続', '연결 안 됨', 'Nicht verbunden', 'Non connecté', 'Sin conectar'],
  '未连接 · 需要 %s': ['Not connected · needs %s', '未連接 · 需要 %s', '未接続 · %s が必要', '연결 안 됨 · %s 필요', 'Nicht verbunden · %s erforderlich', 'Non connecté · %s requis', 'Sin conectar · requiere %s'],
  '演示数据 · 无需凭据': ['Demo data · no credentials needed', '示範資料 · 無需憑證', 'デモデータ · 認証情報は不要', '데모 데이터 · 자격 증명 불필요', 'Demodaten · keine Zugangsdaten nötig', 'Données de démo · aucun identifiant requis', 'Datos de demostración · sin credenciales'],
  '需要重新授权：%s': ['Reauthorization needed: %s', '需重新授權：%s', '再認証が必要：%s', '다시 인증 필요: %s', 'Neu autorisieren: %s', 'Réautorisation requise : %s', 'Hay que volver a autorizar: %s'],
  '需要权限': ['Permissions needed', '需要權限', '必要な権限', '필요한 권한', 'Benötigte Berechtigungen', 'Autorisations requises', 'Permisos necesarios'],
  '凭据': ['Credentials', '憑證', '認証情報', '자격 증명', 'Zugangsdaten', 'Identifiants', 'Credenciales'],
  '（可选）': [' (optional)', '（選填）', '（任意）', ' (선택)', ' (optional)', ' (facultatif)', ' (opcional)'],
  '去申请 →': ['Get one →', '去申請 →', '取得する →', '발급받기 →', 'Jetzt beantragen →', 'En obtenir un →', 'Obtener uno →'],
  '允许写操作（创建、发送、部署这类会改动远端数据的能力）。不开也能连，只是写工具不会注册。': ['Allow write actions (creating, sending, deploying — anything that changes data on the other side). You can still connect; the write tools just won’t be registered.', '允許寫入操作（建立、傳送、部署這類會改動遠端資料的能力）。不開也能連，只是寫入工具不會註冊。', '書き込み操作（作成・送信・デプロイなど相手側のデータを変える操作）を許可します。オフでも接続でき、書き込みツールが登録されないだけです。', '쓰기 작업(생성, 전송, 배포처럼 상대 데이터를 바꾸는 기능)을 허용합니다. 끄더라도 연결은 되고, 쓰기 도구만 등록되지 않습니다.', 'Schreibaktionen erlauben (Erstellen, Senden, Deployen – alles, was Daten auf der Gegenseite ändert). Verbinden geht auch ohne; die Schreibwerkzeuge werden dann nur nicht registriert.', 'Autoriser les écritures (créer, envoyer, déployer — tout ce qui modifie les données distantes). Vous pouvez vous connecter sans : les outils d’écriture ne seront simplement pas enregistrés.', 'Permitir escrituras (crear, enviar, desplegar: todo lo que modifica datos remotos). Puedes conectar sin ello; simplemente no se registrarán las herramientas de escritura.'],
  '连接后可用（%s）': ['Available once connected (%s)', '連接後可用（%s）', '接続後に使えるもの（%s）', '연결 후 사용 가능(%s)', 'Nach dem Verbinden verfügbar (%s)', 'Disponibles une fois connecté (%s)', 'Disponibles al conectar (%s)'],
  '失败：%s': ['Failed: %s', '失敗：%s', '失敗：%s', '실패: %s', 'Fehlgeschlagen: %s', 'Échec : %s', 'Error: %s'],
  '测试连接': ['Test connection', '測試連接', '接続をテスト', '연결 테스트', 'Verbindung testen', 'Tester la connexion', 'Probar conexión'],
  '连接': ['Connect', '連接', '接続', '연결', 'Verbinden', 'Connecter', 'Conectar'],
  '启用演示数据': ['Enable demo data', '啟用示範資料', 'デモデータを有効化', '데모 데이터 사용', 'Demodaten aktivieren', 'Activer les données de démo', 'Activar datos de demostración'],
  '断开连接': ['Disconnect', '中斷連接', '接続を解除', '연결 해제', 'Trennen', 'Déconnecter', 'Desconectar'],
  '无需凭据': ['No credentials needed', '無需憑證', '認証情報は不要', '자격 증명 불필요', 'Keine Zugangsdaten nötig', 'Aucun identifiant requis', 'Sin credenciales'],
  '正在测试…': ['Testing…', '正在測試…', 'テスト中…', '테스트 중…', 'Wird getestet…', 'Test en cours…', 'Probando…'],
  '通了 · %s（%s ms）': ['Reachable · %s (%s ms)', '通了 · %s（%s ms）', '接続できました · %s（%s ms）', '연결됨 · %s(%s ms)', 'Erreichbar · %s (%s ms)', 'Accessible · %s (%s ms)', 'Accesible · %s (%s ms)'],
  '不通：%s': ['No connection: %s', '不通：%s', '接続できません：%s', '연결 실패: %s', 'Keine Verbindung: %s', 'Pas de connexion : %s', 'Sin conexión: %s'],
  '正在连接…': ['Connecting…', '正在連接…', '接続中…', '연결 중…', 'Verbindung wird hergestellt…', 'Connexion…', 'Conectando…'],
  '连接失败：%s': ['Connection failed: %s', '連接失敗：%s', '接続に失敗しました：%s', '연결 실패: %s', 'Verbindung fehlgeschlagen: %s', 'Échec de la connexion : %s', 'Error de conexión: %s'],
  '已连接 %s，新增 %s 个工具': ['Connected %s, %s tools added', '已連接 %s，新增 %s 個工具', '%s に接続し、ツールを %s 個追加しました', '%s 연결됨, 도구 %s개 추가', '%s verbunden, %s Werkzeuge hinzugefügt', '%s connecté, %s outils ajoutés', '%s conectado, %s herramientas añadidas'],
  '已断开 %s，相关工具已注销': ['Disconnected %s, its tools were removed', '已中斷 %s，相關工具已註銷', '%s を切断し、関連ツールを削除しました', '%s 연결 해제, 관련 도구 제거됨', '%s getrennt, zugehörige Werkzeuge entfernt', '%s déconnecté, outils associés retirés', '%s desconectado, herramientas retiradas'],
  '已断开 %s': ['Disconnected %s', '已中斷 %s', '%s を切断しました', '%s 연결 해제됨', '%s getrennt', '%s déconnecté', '%s desconectado'],
  '取消引用': ['Remove reference', '取消引用', '引用を解除', '참조 취소', 'Verweis entfernen', 'Retirer la référence', 'Quitar referencia'],
  '引用': ['Reference', '引用', '引用', '참조', 'Verweisen', 'Référencer', 'Referenciar'],
  '模板': ['Template', '範本', 'テンプレート', '템플릿', 'Vorlage', 'Modèle', 'Plantilla'],
  '引用这套模板': ['Reference this template', '引用這套範本', 'このテンプレートを引用', '이 템플릿 참조', 'Diese Vorlage verweisen', 'Référencer ce modèle', 'Referenciar esta plantilla'],
  '已引用模板「%s」，补一句需求一起发出去': ['Referenced “%s”. Add a sentence and send them together.', '已引用範本「%s」，補一句需求一起送出', '「%s」を引用しました。ひとこと要件を足して送信してください。', '‘%s’ 참조됨. 요구 사항을 한 줄 덧붙여 보내세요.', 'Vorlage „%s“ verwiesen. Ergänzen Sie einen Satz und senden Sie beides.', 'Modèle « %s » référencé. Ajoutez une phrase et envoyez le tout.', 'Plantilla «%s» referenciada. Añade una frase y envía todo junto.'],
  '引用模板 %s': ['Reference template %s', '引用範本 %s', 'テンプレート %s を引用', '템플릿 %s 참조', 'Vorlage %s verweisen', 'Référencer le modèle %s', 'Referenciar la plantilla %s'],
  '用「%s」这套模板做一份%s。': ['Use the “%s” template to make a %s.', '用「%s」這套範本做一份%s。', '「%s」テンプレートで%sを作成します。', '‘%s’ 템플릿으로 %s을(를) 만들어 주세요.', 'Erstellen Sie mit der Vorlage „%s“ ein %s.', 'Utilisez le modèle « %s » pour créer un %s.', 'Usa la plantilla «%s» para crear un %s.'],
  '已连接的连接器': ['Connected connectors', '已連接的連接器', '接続済みのコネクタ', '연결된 커넥터', 'Verbundene Konnektoren', 'Connecteurs connectés', 'Conectores conectados'],
  '运行时插件': ['Runtime plugins', '執行時外掛', '実行中のプラグイン', '실행 중인 플러그인', 'Laufende Plugins', 'Plugins actifs', 'Complementos activos'],
  '目录里有 %s 个，随便挑一个打开': ['There are %s in the catalog — open any of them', '目錄裡有 %s 個，隨便挑一個打開', '一覧に %s 件あります。どれでも開けます', '목록에 %s개 있습니다. 아무거나 열어 보세요', '%s im Katalog – öffnen Sie einen davon', '%s dans le catalogue — ouvrez-en un', 'Hay %s en el catálogo: abre el que quieras'],
  '连接器目录': ['Connector catalog', '連接器目錄', 'コネクタ一覧', '커넥터 목록', 'Konnektor-Katalog', 'Catalogue de connecteurs', 'Catálogo de conectores'],
  '按分类筛选，看每个连接器要什么权限、连上能用哪些工具': ['Filter by category; each connector shows the permissions it needs and the tools it unlocks', '依分類篩選，看每個連接器需要什麼權限、連上後能用哪些工具', 'カテゴリで絞り込み、各コネクタに必要な権限と使えるツールを確認できます', '분류로 필터링하고 커넥터별 필요 권한과 사용 가능한 도구를 확인하세요', 'Nach Kategorie filtern; jeder Konnektor zeigt benötigte Berechtigungen und verfügbare Werkzeuge', 'Filtrez par catégorie : chaque connecteur indique les autorisations requises et les outils débloqués', 'Filtra por categoría: cada conector muestra los permisos que necesita y las herramientas que habilita'],
  '前往连接器': ['Open connectors', '前往連接器', 'コネクタを開く', '커넥터로 이동', 'Zu den Konnektoren', 'Ouvrir les connecteurs', 'Ir a conectores'],
  '暂无运行中的外部插件': ['No external plugins running', '暫無執行中的外部外掛', '実行中の外部プラグインはありません', '실행 중인 외부 플러그인이 없습니다', 'Keine externen Plugins aktiv', 'Aucun plugin externe actif', 'No hay complementos externos activos'],
  '装载后出现在这里': ['They show up here once mounted', '裝載後會出現在這裡', 'マウントするとここに表示されます', '마운트하면 여기에 표시됩니다', 'Sie erscheinen hier, sobald sie eingebunden sind', 'Ils apparaissent ici une fois montés', 'Aparecen aquí al montarse'],
  '运行中': ['Running', '執行中', '実行中', '실행 중', 'Läuft', 'En cours', 'En marcha'],
  '该类型（%s）的运行时适配器还没接，连接会明确报错而不是静默成功。': ['No runtime adapter for this type (%s) yet — connecting fails loudly instead of silently succeeding.', '此類型（%s）的執行時轉接器還沒接，連接會明確報錯而不是默默成功。', 'このタイプ（%s）のランタイムアダプタは未実装です。接続は黙って成功せず、はっきりエラーになります。', '이 유형(%s)의 런타임 어댑터가 아직 없습니다. 연결하면 조용히 성공하지 않고 분명히 오류가 납니다.', 'Für diesen Typ (%s) gibt es noch keinen Laufzeit-Adapter – das Verbinden schlägt sichtbar fehl statt still zu gelingen.', 'Aucun adaptateur d’exécution pour ce type (%s) : la connexion échoue clairement au lieu de réussir en silence.', 'Aún no hay adaptador de ejecución para este tipo (%s): la conexión fallará de forma visible en lugar de fingir éxito.'],
  '服务器': ['Server', '伺服器', 'サーバー', '서버', 'Server', 'Serveur', 'Servidor'],
  'MCP 服务器地址': ['MCP server URL', 'MCP 伺服器位址', 'MCP サーバー URL', 'MCP 서버 주소', 'MCP-Serveradresse', 'URL du serveur MCP', 'Dirección del servidor MCP'],
  '填了就能连真服务器；留空走演示数据。本地服务用 stdio: 开头，例如 stdio: node tools/mcp-echo.mjs': ['Fill this in to reach a real server; leave it empty for demo data. Local servers start with stdio:, e.g. stdio: node tools/mcp-echo.mjs', '填了就能連真伺服器；留空走示範資料。本機服務用 stdio: 開頭，例如 stdio: node tools/mcp-echo.mjs', '入力すると実サーバーに接続します。空欄ならデモデータです。ローカルは stdio: で始めます（例: stdio: node tools/mcp-echo.mjs）', '입력하면 실제 서버에 연결됩니다. 비워 두면 데모 데이터입니다. 로컬은 stdio: 로 시작합니다(예: stdio: node tools/mcp-echo.mjs)', 'Ausgefüllt wird ein echter Server erreicht; leer bedeutet Demodaten. Lokale Server beginnen mit stdio:, z. B. stdio: node tools/mcp-echo.mjs', 'Renseignez-le pour joindre un vrai serveur ; laissez vide pour des données de démo. Un serveur local commence par stdio:, ex. stdio: node tools/mcp-echo.mjs', 'Rellénalo para conectar con un servidor real; déjalo vacío para datos de demostración. Un servidor local empieza por stdio:, p. ej. stdio: node tools/mcp-echo.mjs'],
  '目录里这一项没有预置服务器。填了 MCP 地址就连真服务器，不填走演示数据（每条结果都会标注）。': ['This entry ships without a server. Give it an MCP URL to reach the real service; otherwise it returns demo data (every result is labelled).', '目錄裡這一項沒有預設伺服器。填了 MCP 位址就連真伺服器，不填走示範資料（每筆結果都會標註）。', 'この項目にはサーバーが設定されていません。MCP の URL を入れると実サーバーに接続し、空欄ならデモデータ（各結果に明記）を返します。', '이 항목에는 서버가 미리 설정되어 있지 않습니다. MCP 주소를 넣으면 실제 서버에 연결되고, 비워 두면 데모 데이터(결과마다 표시)를 반환합니다.', 'Für diesen Eintrag ist kein Server hinterlegt. Mit einer MCP-URL wird der echte Dienst erreicht, sonst kommen Demodaten (jedes Ergebnis gekennzeichnet).', 'Cette entrée n’a pas de serveur préconfiguré. Avec une URL MCP vous joignez le vrai service ; sinon ce sont des données de démo (chaque résultat est signalé).', 'Esta entrada no trae servidor. Con una URL MCP llegas al servicio real; si la dejas vacía devuelve datos de demostración (cada resultado va marcado).'],
  '已连上真服务器：%s': ['Connected to a real server: %s', '已連上真伺服器：%s', '実サーバーに接続済み：%s', '실제 서버에 연결됨: %s', 'Mit echtem Server verbunden: %s', 'Connecté à un vrai serveur : %s', 'Conectado a un servidor real: %s'],
  '服务器实际返回（%s 个）': ['Tools the server reports (%s)', '伺服器實際回傳（%s 個）', 'サーバーが返したツール（%s 件）', '서버가 실제로 반환한 도구(%s개)', 'Vom Server gemeldete Tools (%s)', 'Outils renvoyés par le serveur (%s)', 'Herramientas que devuelve el servidor (%s)'],
  '下载原文件': ['Download original', '下載原始檔案', '元ファイルをダウンロード', '원본 파일 다운로드', 'Original herunterladen', 'Télécharger l’original', 'Descargar original'],
  '保存': ['Save', '儲存', '保存', '저장', 'Speichern', 'Enregistrer', 'Guardar'],
  '保存中…': ['Saving…', '儲存中…', '保存中…', '저장 중…', 'Wird gespeichert…', 'Enregistrement…', 'Guardando…'],
  '保存失败：%s': ['Save failed: %s', '儲存失敗：%s', '保存に失敗しました：%s', '저장 실패: %s', 'Speichern fehlgeschlagen: %s', 'Échec de l’enregistrement : %s', 'Error al guardar: %s'],
  '先填接口地址': ['Fill in the endpoint first', '先填介面位址', 'まずエンドポイントを入力してください', '먼저 엔드포인트를 입력하세요', 'Bitte zuerst die Endpunkt-Adresse eintragen', 'Renseignez d’abord l’URL de l’API', 'Primero rellena la dirección del endpoint'],
  '再点一次退出登录': ['Click again to sign out', '再點一次登出', 'もう一度クリックでログアウト', '한 번 더 누르면 로그아웃', 'Erneut klicken zum Abmelden', 'Cliquez à nouveau pour vous déconnecter', 'Haz clic otra vez para cerrar sesión'],
  '加载失败：%s': ['Loading failed: %s', '載入失敗：%s', '読み込みに失敗しました：%s', '불러오기 실패: %s', 'Laden fehlgeschlagen: %s', 'Échec du chargement : %s', 'Error al cargar: %s'],
  '参考图': ['Reference image', '參考圖', '参照画像', '참조 이미지', 'Referenzbild', 'Image de référence', 'Imagen de referencia'],
  '取消': ['Cancel', '取消', 'キャンセル', '취소', 'Abbrechen', 'Annuler', 'Cancelar'],
  '导入的模板': ['Imported template', '匯入的範本', '読み込んだテンプレート', '가져온 템플릿', 'Importierte Vorlage', 'Modèle importé', 'Plantilla importada'],
  '已创建会话，等待第一条消息…': ['Session created — waiting for the first message…', '已建立工作階段，等待第一則訊息…', 'セッションを作成しました。最初のメッセージを待っています…', '세션이 만들어졌습니다. 첫 메시지를 기다리는 중…', 'Sitzung erstellt – wartet auf die erste Nachricht…', 'Session créée — en attente du premier message…', 'Sesión creada: esperando el primer mensaje…'],
  '恢复本地账号': ['Restore local account', '還原本機帳號', 'ローカルアカウントを復元', '로컬 계정 복원', 'Lokales Konto wiederherstellen', 'Restaurer le compte local', 'Restaurar la cuenta local'],
  '接口地址': ['Endpoint URL', '介面位址', 'エンドポイント URL', '엔드포인트 URL', 'Endpunkt-URL', 'URL de l’API', 'URL del endpoint'],
  '接口地址不能为空': ['Endpoint URL is required', '介面位址不能為空', 'エンドポイント URL は必須です', '엔드포인트 URL은 필수입니다', 'Endpunkt-URL darf nicht leer sein', 'L’URL de l’API est obligatoire', 'La URL del endpoint es obligatoria'],
  '模型名称': ['Model name', '模型名稱', 'モデル名', '모델 이름', 'Modellname', 'Nom du modèle', 'Nombre del modelo'],
  '模型名称不能为空': ['Model name is required', '模型名稱不能為空', 'モデル名は必須です', '모델 이름은 필수입니다', 'Modellname darf nicht leer sein', 'Le nom du modèle est obligatoire', 'El nombre del modelo es obligatorio'],
  '模板只存在这台机器的浏览器里，不会上传到服务器；删掉它不会影响案例库。': ['Templates live only in this browser on this machine — nothing is uploaded. Deleting one does not touch the case library.', '範本只存在這台機器的瀏覽器裡，不會上傳到伺服器；刪掉它不會影響案例庫。', 'テンプレートはこの端末のブラウザにだけ保存され、サーバーには送信されません。削除しても事例ライブラリには影響しません。', '템플릿은 이 기기의 브라우저에만 저장되며 서버로 전송되지 않습니다. 삭제해도 사례 라이브러리는 그대로입니다.', 'Vorlagen liegen nur in diesem Browser auf diesem Rechner – nichts wird hochgeladen. Löschen lässt die Beispielsammlung unberührt.', 'Les modèles restent dans ce navigateur, rien n’est envoyé. Les supprimer ne touche pas la bibliothèque d’exemples.', 'Las plantillas solo viven en este navegador; no se sube nada. Borrarlas no afecta a la biblioteca de ejemplos.'],
  '没有匹配项': ['No matches', '沒有符合項目', '一致する項目がありません', '일치하는 항목이 없습니다', 'Keine Treffer', 'Aucun résultat', 'Sin coincidencias'],
  '测试中…': ['Testing…', '測試中…', 'テスト中…', '테스트 중…', 'Wird getestet…', 'Test en cours…', 'Probando…'],
  '测试失败：%s': ['Test failed: %s', '測試失敗：%s', 'テストに失敗しました：%s', '테스트 실패: %s', 'Test fehlgeschlagen: %s', 'Échec du test : %s', 'Error en la prueba: %s'],
  '移除': ['Remove', '移除', '削除', '제거', 'Entfernen', 'Retirer', 'Quitar'],
  '运行中…': ['Running…', '執行中…', '実行中…', '실행 중…', 'Läuft…', 'En cours…', 'En marcha…'],
  '退出登录': ['Sign out', '登出', 'ログアウト', '로그아웃', 'Abmelden', 'Se déconnecter', 'Cerrar sesión'],
  '高级配置': ['Advanced settings', '進階設定', '詳細設定', '고급 설정', 'Erweiterte Einstellungen', 'Paramètres avancés', 'Ajustes avanzados'],
  '（仅支持 OpenAI 兼容协议 API）': [' (OpenAI-compatible APIs only)', '（僅支援 OpenAI 相容協定 API）', '（OpenAI 互換 API のみ）', ' (OpenAI 호환 API만 지원)', ' (nur OpenAI-kompatible APIs)', ' (API compatibles OpenAI uniquement)', ' (solo API compatibles con OpenAI)'],
  '已选择 %s，点「运行」读取。': ['Selected %s — press Run to read it.', '已選擇 %s，點「執行」讀取。', '%s を選択しました。「実行」で読み取ります。', '%s 선택됨. ‘실행’을 누르면 읽습니다.', '%s ausgewählt – zum Einlesen „Ausführen“ drücken.', '%s sélectionné — cliquez sur « Exécuter » pour lire.', '%s seleccionado: pulsa «Ejecutar» para leerlo.'],
  '再点一次确认删除「%s」': ['Click again to delete “%s”', '再點一次確認刪除「%s」', 'もう一度クリックで「%s」を削除', '한 번 더 누르면 ‘%s’ 삭제', 'Erneut klicken, um „%s“ zu löschen', 'Cliquez à nouveau pour supprimer « %s »', 'Haz clic otra vez para borrar «%s»'],
  '删除「%s」？': ['Delete “%s”?', '刪除「%s」？', '「%s」を削除しますか？', '‘%s’을 삭제할까요?', '„%s“ löschen?', 'Supprimer « %s » ?', '¿Borrar «%s»?'],
  '删除': ['Delete', '刪除', '削除', '삭제', 'Löschen', 'Supprimer', 'Borrar'],
  '删除中…': ['Deleting…', '刪除中…', '削除中…', '삭제 중…', 'Wird gelöscht…', 'Suppression…', 'Borrando…'],
  '✕ 测试失败': ['✕ Test failed', '✕ 測試失敗', '✕ テスト失敗', '✕ 테스트 실패', '✕ Test fehlgeschlagen', '✕ Test échoué', '✕ Prueba fallida'],
  '✕ 未填接口地址': ['✕ No endpoint set', '✕ 未填介面位址', '✕ URL が未入力', '✕ 엔드포인트 미입력', '✕ Keine URL hinterlegt', '✕ Aucune URL', '✕ Falta la URL'],
  '已接入': ['Connected', '已接入', '接続済み', '연결됨', 'Verbunden', 'Connecté', 'Conectado'],
  '未接入': ['Not connected', '未接入', '未接続', '미연결', 'Nicht verbunden', 'Non connecté', 'Sin conectar'],
  '当前生成走规则模板（还没有接入模型）': ['Generation is using rule templates (no model connected yet)', '當前生成走規則範本（還沒有接入模型）', '現在の生成はルールテンプレートです（モデル未接続）', '현재 생성은 규칙 템플릿으로 동작합니다（모델 미연결）', 'Die Generierung nutzt Regelvorlagen (noch kein Modell verbunden)', 'La génération utilise des modèles de règles (aucun modèle connecté)', 'La generación usa plantillas de reglas (aún sin modelo conectado)'],
  '模型已挂上，但浏览器中转没连上，生成会回落到规则模板': ['The model is mounted, but the browser relay is offline — generation falls back to rule templates', '模型已掛上，但瀏覽器中轉沒連上，生成會回落到規則範本', 'モデルは接続済みですがブラウザ中継が未接続のため、ルールテンプレートに戻ります', '모델은 연결됐지만 브라우저 중계가 없어 규칙 템플릿으로 대체됩니다', 'Das Modell ist eingebunden, aber die Browser-Weiterleitung ist offline – es wird auf Regelvorlagen zurückgefallen', 'Le modèle est monté, mais le relais navigateur est hors ligne — retour aux modèles de règles', 'El modelo está montado, pero el relé del navegador no está conectado: se usan las plantillas de reglas'],
  '浏览器里没有这个地址的 Key，先填上 Key 再测': ['This browser has no key for that address — fill the key in first', '瀏覽器裡沒有這個位址的 Key，先填上 Key 再測', 'このブラウザにこのアドレスのキーがありません。先にキーを入力してください', '이 브라우저에 이 주소의 키가 없습니다. 키를 먼저 입력하세요', 'Dieser Browser hat keinen Schlüssel für diese Adresse – bitte zuerst eintragen', 'Ce navigateur n’a pas de clé pour cette adresse — saisissez-la d’abord', 'Este navegador no tiene clave para esa dirección: introdúcela primero'],
  '浏览器直连（服务端出不了网时用）': ['Direct from browser (when the server has no outbound network)', '瀏覽器直連（伺服器出不了網時用）', 'ブラウザ直結（サーバーが外部に出られない場合）', '브라우저 직접 연결(서버가 외부로 나갈 수 없을 때)', 'Direkt aus dem Browser (wenn der Server kein Internet hat)', 'Direct depuis le navigateur (si le serveur n’a pas d’accès)', 'Directo desde el navegador (si el servidor no tiene salida)'],
  '请求从这里这台浏览器发出，Key 只存 localStorage，服务端不保存。要求该接口允许跨域（CORS）。': ['The request leaves from this browser; the key stays in localStorage and never reaches the server. The endpoint must allow CORS.', '請求從這台瀏覽器發出，Key 只存 localStorage，伺服器不儲存。要求該介面允許跨域（CORS）。', 'リクエストはこのブラウザから送信され、キーは localStorage にのみ保存されます。CORS が許可されている必要があります。', '요청은 이 브라우저에서 나가며 키는 localStorage에만 저장됩니다. 해당 API가 CORS를 허용해야 합니다.', 'Die Anfrage geht von diesem Browser aus, der Schlüssel bleibt im localStorage. Der Endpunkt muss CORS erlauben.', 'La requête part de ce navigateur, la clé reste dans le localStorage. L’API doit autoriser CORS.', 'La petición sale de este navegador y la clave queda en localStorage. La API debe permitir CORS.'],
  '默认由服务端直接请求；预览容器只放行少数域名，供应商接口通常不通。': ['By default the server makes the request; the preview container only allows a few domains, so vendor APIs usually fail.', '預設由伺服器直接請求；預覽容器只放行少數網域，供應商介面通常不通。', '既定ではサーバーが直接リクエストします。プレビュー容器は一部のドメインしか許可しないため、通常は通りません。', '기본적으로 서버가 직접 요청합니다. 미리보기 컨테이너는 일부 도메인만 허용하므로 대개 실패합니다.', 'Standardmäßig fragt der Server direkt an; der Vorschau-Container erlaubt nur wenige Domains.', 'Par défaut, le serveur fait la requête ; le conteneur de prévisualisation n’autorise que quelques domaines.', 'Por defecto la petición la hace el servidor; el contenedor de vista previa solo permite unos dominios.'],
  '直连': ['Direct', '直連', '直結', '직접', 'Direkt', 'Direct', 'Directo'],
  '已接入 · %s': ['Connected · %s', '已接入 · %s', '接続済み · %s', '연결됨 · %s', 'Verbunden · %s', 'Connecté · %s', 'Conectado · %s'],
  '规则模板': ['Rule templates', '規則範本', 'ルールテンプレート', '규칙 템플릿', 'Regelvorlagen', 'Modèles de règles', 'Plantillas de reglas'],
  '正在用 %s 生成，保存即生效': ['Generating with %s — saved changes apply immediately', '正在用 %s 生成，儲存即生效', '%s で生成中。保存するとすぐ反映されます', '%s(으)로 생성 중이며, 저장하면 즉시 적용됩니다', 'Generierung mit %s – Änderungen gelten sofort', 'Génération avec %s — les modifications s’appliquent aussitôt', 'Generando con %s — los cambios se aplican al guardar'],
  '还没有可用的模型，生成走规则模板：%s': ['No usable model yet — generation uses rule templates: %s', '還沒有可用的模型，生成走規則範本：%s', '利用できるモデルがないため、ルールテンプレートで生成します：%s', '사용 가능한 모델이 없어 규칙 템플릿으로 생성합니다: %s', 'Noch kein nutzbares Modell – Generierung mit Regelvorlagen: %s', 'Aucun modèle utilisable — génération avec les modèles de règles : %s', 'Aún no hay modelo usable: la generación usa plantillas de reglas: %s'],
  '模型：%s · %s': ['Model: %s · %s', '模型：%s · %s', 'モデル：%s · %s', '모델: %s · %s', 'Modell: %s · %s', 'Modèle : %s · %s', 'Modelo: %s · %s'],
  '规则模板 · 原因：%s': ['Rule templates · reason: %s', '規則範本 · 原因：%s', 'ルールテンプレート · 理由：%s', '규칙 템플릿 · 이유: %s', 'Regelvorlagen · Grund: %s', 'Modèles de règles · raison : %s', 'Plantillas de reglas · motivo: %s'],
  '这个面板暂时没有内容。': ['This panel has nothing to show yet.', '這個面板暫時沒有內容。', 'このパネルにはまだ表示する内容がありません。', '이 패널에는 아직 표시할 내용이 없습니다.', 'Dieses Panel hat noch keine Inhalte.', 'Ce panneau n’a rien à afficher pour l’instant.', 'Este panel aún no tiene contenido.'],
  '已装载工具': ['Loaded tools', '已裝載工具', '読み込み済みツール', '로드된 도구', 'Geladene Werkzeuge', 'Outils chargés', 'Herramientas cargadas'],
  '模板设置': ['Template settings', '範本設定', 'テンプレート設定', '템플릿 설정', 'Vorlagen-Einstellungen', 'Réglages du modèle', 'Ajustes de la plantilla'],
  '正在读取专家预设…': ['Loading expert presets…', '正在讀取專家預設…', 'エキスパートプリセットを読み込み中…', '전문가 프리셋을 불러오는 중…', 'Experten-Presets werden geladen…', 'Chargement des presets d’experts…', 'Cargando presets de expertos…'],
  '没有匹配的专家': ['No matching experts', '沒有符合的專家', '一致するエキスパートがいません', '일치하는 전문가가 없습니다', 'Keine passenden Experten', 'Aucun expert correspondant', 'No hay expertos coincidentes'],
  '您正在查看此模板。只有编辑者才能编辑此模板的说明。': ['You are viewing this template. Only the editor can change its description.', '您正在檢視此範本。只有編輯者才能編輯此範本的說明。', 'このテンプレートを表示中です。説明を編集できるのは編集者だけです。', '이 템플릿을 보고 있습니다. 설명은 편집자만 수정할 수 있습니다.', 'Sie sehen diese Vorlage an. Nur die Bearbeiter können die Beschreibung ändern.', 'Vous consultez ce modèle. Seul l’éditeur peut modifier sa description.', 'Estás viendo esta plantilla. Solo el editor puede cambiar su descripción.'],
  '上传模板或从案例库挑一套': ['Upload a template or pick one from the library', '上傳範本或從案例庫挑一套', 'テンプレートをアップロードするか、事例から選ぶ', '템플릿을 올리거나 사례에서 하나 고르세요', 'Vorlage hochladen oder aus der Sammlung wählen', 'Importez un modèle ou choisissez-en un', 'Sube una plantilla o elige una de la biblioteca'],
  '第一次打开会慢一点': ['The first open takes a moment', '第一次開啟會慢一點', '初回は少し時間がかかります', '처음 열 때는 조금 느립니다', 'Der erste Aufruf dauert etwas', 'La première ouverture est un peu lente', 'La primera apertura tarda un poco'],
  '换个关键词试试': ['Try another keyword', '換個關鍵字試試', '別のキーワードを試してください', '다른 검색어를 사용해 보세요', 'Anderes Stichwort probieren', 'Essayez un autre mot-clé', 'Prueba con otra palabra clave'],
  '%s / %s 已连接': ['%s / %s connected', '%s / %s 已連接', '%s / %s 接続済み', '%s / %s 연결됨', '%s / %s verbunden', '%s / %s connectés', '%s / %s conectados'],
  '读': ['Read', '讀', '読み取り', '읽기', 'Lesen', 'Lecture', 'Lectura'],
  '写': ['Write', '寫', '書き込み', '쓰기', 'Schreiben', 'Écriture', 'Escritura'],
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

/** 取某语言下的译文（纯函数，供测试与 t() 共用）；源语言直接返回原文。 */
export function translationOf(text, langId) {
  if (langId === 'zh') return text
  return DICT[text]?.[langId] ?? DICT[text]?.en ?? text
}

/** 翻译单个词条；源语言直接返回。 */
export function t(text) {
  return translationOf(text, lang)
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
