import type { Locale } from "../locales";

// Reuse established translations only where the meaning is unchanged.
export const settingsDesignAliases: Record<string, string> = {
  defaultModel: "settings.personal.model",
  identity: "settings.section.profile",
  guest: "settings.devices.guest",
  edit: "settings.models.editItem",
  save: "settings.models.save",
  cancel: "settings.models.cancel",
  saved: "settings.personal.saved",
  loading: "settings.devices.loading",
  retry: "settings.devices.refresh",
  accountData: "settings.data.cloud.go",
  accountHelp: "settings.data.cloud.help",
  remove: "settings.models.remove",
  expertManage: "settings.link.experts",
  pluginsManage: "settings.link.plugins",
  connectionsManage: "settings.link.connectors",
  devices: "settings.section.devices",
  notConnected: "account.plan.none",
  billingHelp: "settings.plan.current.help",
  credits: "account.plan.credits",
  planInfo: "settings.plan.title",
  storage: "settings.data.usage",
  modelEmptyHelp: "settings.models.help",
};

// Compact, native-language equivalents; each row follows this explicit key order.
const keys =
  `intro.general|intro.profile|intro.plan|intro.appearance|intro.shortcuts|intro.personalization|intro.memory|intro.agents|intro.models|intro.assistant|intro.devices|intro.data|intro.apps|intro.security|audit.account.register|audit.account.profile.update|audit.account.password.change|audit.account.oauth.login|audit.account.oauth.register|audit.account.enable|audit.account.disable|displayName|email|username|account|failure|busy|empty|guestHelp|connection|memoryList|memoryHelp|memoryEmpty|memoryEmptyHelp|memoryAdd|memoryContent|memoryConsent|memoryRemoveConfirm|memoryClearConfirm|memoryClear|memoryUpdated|danger|dangerHelp|searchExperts|expertHelp|expertDetails|plugins|pluginsEmpty|pluginsHelp|enabled|disabled|pluginToggle|pluginUpdated|connections|connectionsHelp|connectionsEmpty|status.connected|status.disconnected|status.pending|status.error|devicesHelp|lastSeen|password|passwordHelp|currentPassword|newPassword|passwordUpdated|activity|activityHelp|billing|creditsHelp|storageHelp|fontPreview|fontSample|readingLayout|detailsLayout|reading|behavior|sceneHelp|modelEmpty|closeEditor|configured|sync.idle|sync.syncing|sync.synced|sync.offline|roleConfiguration|roleEnabled|roleDisabled|roleDescription|roleInstructions|roleScope|assistantPreferences|autoMatch|autoMatchHelp|matchDelay|collaborators|collaboratorsHelp|availablePlugins|install|uninstall|uninstallConfirm|incompatible|permissions|requirements|lifecycleUpdated|configure|addConnector|connectorName|connectorDescription|connectorEndpoint|connectorTransport|connectorLocalHelp|invalidEndpoint|authorize|disconnect|disconnectConfirm|deleteConnectorConfirm|unsupportedConnector|oauthHelp|popupBlocked|unsafeAuthorization|authorizationStarted|serviceUnavailable|connectionVerified|connectionFailed|connectionUnverified|connectionReachable|connectionChanged|serverProbeHelp|verifiedAt`.split(
    "|",
  );
const rows: Partial<Record<Locale, string>> = {};

rows["ja"] = `
言語と作業環境を設定します。
公開プロフィールとアカウントを管理します。
実際の利用量とプラン情報を確認します。
テーマ、文字と画面の余白を調整します。
キーボード操作をカスタマイズします。
新しいタスクの初期設定を選びます。
同意して保存したメモリを管理します。
役割の有効化と作業規範を設定します。
モデルの接続情報と検証結果を管理します。
マッチングの設定と拡張機能を管理します。
登録済みデバイスの情報を確認します。
ローカルデータのバックアップと削除を行います。
アプリの設定と認可を管理します。
パスワードとセキュリティ履歴を確認します。
アカウントを登録
プロフィールを更新
パスワードを変更
外部サービスでログイン
外部サービスで登録
アカウントを有効化
アカウントを無効化
表示名
メールアドレス
ユーザー名
アカウント
操作に失敗しました。再試行してください。
処理中…
記録はありません
ゲストはこのデバイスのローカル情報を確認できます。
データ接続
保存済みメモリ
明示的な同意を得て保存された内容のみ表示します。自動学習ではありません。
メモリはまだありません
保存時に同意した内容がここに表示されます。
メモリを追加
メモリの内容
この内容をアカウントのメモリに保存することに同意します。
このメモリを削除しますか？
すべてのメモリを削除しますか？元には戻せません。
メモリをすべて削除
メモリを更新しました。
取り消せない操作
実行前にデータへの影響を確認してください。
役割を検索
規範は後続タスクに適用されますが、実行結果の保証ではありません。
詳細を見る
拡張機能
インストール済み拡張機能はありません
実際にインストールされた拡張機能の状態です。市場への登録と実行の許可は別です。
有効
無効
{name}を切り替える
拡張機能の状態を更新しました。
アプリの接続
検証済みの認可状態です。設定の保存だけでは接続されません。
認可された接続はありません
接続済み
未接続
認可待ち
接続エラー
サーバーに登録されたデバイス情報です。リアルタイムのオンライン状態ではありません。
最終記録
パスワードの変更
新しいパスワードは10〜128文字です。変更後、ほかのセッションは終了します。
現在のパスワード
新しいパスワード
パスワードを更新しました。ほかのセッションは終了しました。
セキュリティ履歴
サーバーに実際に記録された操作を表示します。
お支払い
クレジットサービスは未接続です。残高や特典は表示しません。
このブラウザーの実際のローカル保存容量です。
文字のプレビュー
読みやすい余白で、作業に集中できます。
文字とレイアウト
詳細と操作
読みやすさ
操作の設定
ホームに表示する6つのクイック操作を選びます。
モデルはまだ追加されていません
エディターを閉じる
設定済み
ローカルに保存済み
同期中…
同期済み
同期できません・ローカル保存済み
役割の設定
役割を有効化：{name}
この役割は無効です。設定で有効化してください。
役割の説明
追加の作業規範
無効な役割はマッチングと選択から除外されます。規範は新しいタスクに適用され、既存タスクは変更しません。
アシスタントの設定
エキスパートの自動マッチング
有効にすると下書き、読み取り可能な添付部分、役割の情報を選択モデルに送信し、料金が発生する場合があります。無効にすると自動リクエストを停止します。
入力停止後の待機時間
協力エキスパートの規範を使用
無効にすると新しいタスクに協力役割の規範を追加しません。
インストール可能な拡張機能
インストール
アンインストール
{name}をアンインストールしますか？
互換性なし
権限
動作要件
拡張機能の操作が完了しました。
設定
カスタムアプリを追加
アプリ名
アプリの説明
HTTPSサービスのURL
通信方式
公開設定のみローカルに保存し、接続は確立しません。URLに認証情報、クエリ、フラグメントを含めないでください。
認証情報、クエリ、フラグメントのない公開HTTPS URLを入力してください。
認可して接続
接続を解除
{name}の接続を解除しますか？
{name}のローカル設定を削除しますか？
このアプリの認可アダプターはありません。
提供元の画面で認可してください。パスワードやトークンをここに入力しないでください。戻ったら状態を更新してください。
認可画面がブロックされました。ポップアップを許可して再試行してください。
予期しない認可URLを受信したため、移動をブロックしました。
認可画面を開きました。完了後に状態を更新してください。
認可サービスは未設定です。ローカル設定は管理できますが、外部認可は行われていません。
モデル検証済み
検証失敗
未検証
API応答あり・モデル未確認
設定またはキーが変更されました。再検証してください。
サーバー管理モデルは「モデルと利用量」で検証してください。
検証日時
`;

rows["ko"] = `
언어와 작업 환경을 설정합니다.
공개 프로필과 계정을 관리합니다.
실제 사용량과 요금제 정보를 확인합니다.
테마, 글꼴과 여백을 조정합니다.
키보드 단축키를 설정합니다.
새 작업의 기본값을 선택합니다.
동의하고 저장한 기억을 관리합니다.
역할을 켜고 작업 지침을 편집합니다.
모델 연결 설정과 검증 결과를 관리합니다.
매칭 설정과 확장 기능을 관리합니다.
등록된 기기 정보를 확인합니다.
로컬 데이터를 백업하거나 삭제합니다.
앱 설정과 인증을 관리합니다.
비밀번호와 보안 기록을 확인합니다.
계정 등록
프로필 수정
비밀번호 변경
외부 서비스로 로그인
외부 서비스로 가입
계정 활성화
계정 비활성화
표시 이름
이메일
사용자 이름
계정
작업에 실패했습니다. 다시 시도하세요.
처리 중…
기록 없음
게스트는 이 기기의 로컬 정보를 볼 수 있습니다.
데이터 연결
저장된 기억
명시적으로 동의해 저장한 내용만 표시합니다. 자동 학습이 아닙니다.
저장된 기억이 없습니다
저장에 동의한 내용이 여기에 표시됩니다.
기억 추가
기억 내용
이 내용을 계정 기억에 저장하는 데 동의합니다.
이 기억을 삭제할까요?
모든 기억을 삭제할까요? 되돌릴 수 없습니다.
모든 기억 삭제
기억이 업데이트되었습니다.
되돌릴 수 없는 작업
실행 전에 데이터에 미치는 영향을 확인하세요.
역할 검색
지침은 이후 작업에 적용되며 실행 결과를 보장하지 않습니다.
자세히 보기
확장 기능
설치된 확장 기능이 없습니다
실제 설치된 확장의 상태입니다. 마켓 등록은 실행 권한을 의미하지 않습니다.
활성
비활성
{name} 전환
확장 상태가 업데이트되었습니다.
앱 연결
검증된 인증 상태입니다. 설정을 저장해도 연결되지는 않습니다.
인증된 연결이 없습니다
연결됨
연결 안 됨
인증 대기
연결 오류
서버에 기록된 기기 정보이며 실시간 접속 상태가 아닙니다.
마지막 기록
비밀번호 변경
새 비밀번호는 10~128자입니다. 변경하면 다른 세션이 종료됩니다.
현재 비밀번호
새 비밀번호
비밀번호가 변경되었습니다. 다른 세션은 종료되었습니다.
보안 활동
서버에 실제로 기록된 작업입니다.
결제
크레딧 서비스가 연결되지 않았습니다. 잔액이나 보상을 표시하지 않습니다.
이 브라우저가 실제로 사용하는 로컬 저장 공간입니다.
글꼴 미리 보기
편안한 여백으로 작업에 집중하세요.
글꼴과 레이아웃
세부 정보와 상호작용
읽기
동작 설정
홈에 표시할 빠른 작업 6개를 선택하세요.
추가된 모델이 없습니다
편집기 닫기
설정됨
로컬 저장됨
동기화 중…
동기화됨
동기화 불가 · 로컬 저장됨
역할 설정
역할 활성화: {name}
비활성 역할입니다. 설정에서 먼저 활성화하세요.
역할 설명
추가 작업 지침
비활성 역할은 매칭과 선택에서 제외됩니다. 지침은 새 작업에만 적용되며 기존 작업을 변경하지 않습니다.
도우미 기본 설정
전문가 자동 매칭
켜면 초안, 읽을 수 있는 첨부 부분과 역할 정보를 선택한 모델에 보내며 요금이 발생할 수 있습니다. 끄면 자동 요청이 중지됩니다.
입력 중단 후 대기 시간
협업 전문가 지침 사용
끄면 새 작업에 협업 역할 지침을 추가하지 않습니다.
설치 가능한 확장 기능
설치
제거
{name} 확장을 제거할까요?
호환되지 않음
권한
실행 요구 사항
확장 작업이 완료되었습니다.
설정
사용자 정의 앱 추가
앱 이름
앱 설명
HTTPS 서비스 주소
전송 방식
공개 설정만 로컬에 저장하며 연결하지 않습니다. URL에 인증 정보, 쿼리나 프래그먼트를 포함하지 마세요.
인증 정보, 쿼리와 프래그먼트가 없는 공개 HTTPS URL을 입력하세요.
연결 인증
연결 해제
{name} 연결을 해제할까요?
{name}의 로컬 설정을 삭제할까요?
이 앱의 인증 어댑터가 없습니다.
제공업체 창에서 인증하세요. 비밀번호나 토큰을 여기에 입력하지 마세요. 돌아온 뒤 상태를 새로고침하세요.
인증 창이 차단되었습니다. 팝업을 허용하고 다시 시도하세요.
예상하지 못한 인증 URL이 반환되어 이동을 차단했습니다.
인증 창을 열었습니다. 완료 후 상태를 새로고침하세요.
인증 서비스가 설정되지 않았습니다. 로컬 설정은 관리할 수 있지만 외부 인증은 수행되지 않았습니다.
모델 검증됨
검증 실패
검증 안 됨
API 응답 있음 · 모델 미확인
설정 또는 키가 변경되었습니다. 다시 검증하세요.
서버 관리 모델은 모델 및 사용량 페이지에서 검증하세요.
검증 시간
`;

rows["fr"] = `
Réglez la langue et votre environnement de travail.
Gérez votre profil public et votre compte.
Consultez l’utilisation réelle et votre offre.
Ajustez le thème, les caractères et les espacements.
Personnalisez les raccourcis clavier.
Choisissez les valeurs des nouvelles tâches.
Gérez les souvenirs enregistrés avec votre accord.
Activez les rôles et modifiez leurs consignes.
Gérez les modèles et leurs vérifications.
Réglez l’association des experts et les extensions.
Consultez les appareils enregistrés.
Sauvegardez ou effacez les données locales.
Gérez la configuration et l’autorisation des applications.
Consultez le mot de passe et l’historique de sécurité.
Création du compte
Modification du profil
Changement du mot de passe
Connexion via un fournisseur
Inscription via un fournisseur
Activation du compte
Désactivation du compte
Nom affiché
Adresse e-mail
Nom d’utilisateur
Compte
Échec de l’opération. Réessayez.
Traitement…
Aucun enregistrement
Les invités peuvent consulter les données locales de cet appareil.
Connexion aux données
Souvenirs enregistrés
Uniquement les contenus enregistrés avec un consentement explicite. Aucun apprentissage automatique.
Aucun souvenir
Les contenus dont l’enregistrement a été accepté apparaîtront ici.
Ajouter un souvenir
Contenu du souvenir
J’accepte d’enregistrer ce contenu dans la mémoire du compte.
Supprimer ce souvenir ?
Supprimer tous les souvenirs ? Cette action est irréversible.
Effacer tous les souvenirs
Mémoire mise à jour.
Actions irréversibles
Vérifiez leur effet sur les données avant de continuer.
Rechercher un rôle
Les consignes s’appliquent aux prochaines tâches sans garantir leur résultat.
Voir les détails
Extensions
Aucune extension installée
État des extensions réellement installées. Une fiche de catalogue n’autorise pas leur exécution.
Activé
Désactivé
Basculer {name}
État de l’extension mis à jour.
Connexions aux applications
Seules les autorisations vérifiées sont affichées. Enregistrer une configuration ne connecte pas l’application.
Aucune connexion autorisée
Connecté
Déconnecté
Autorisation en attente
Erreur de connexion
Appareils enregistrés sur le serveur, sans indication de présence en temps réel.
Dernière trace
Modifier le mot de passe
Entre 10 et 128 caractères. Les autres sessions seront fermées après modification.
Mot de passe actuel
Nouveau mot de passe
Mot de passe modifié. Les autres sessions sont fermées.
Activité de sécurité
Actions réellement consignées par le serveur.
Facturation
Le service de crédits n’est pas connecté. Aucun solde ni récompense n’est affiché.
Stockage local réellement utilisé par ce navigateur.
Aperçu du texte
Des espaces confortables pour mieux se concentrer.
Texte et disposition
Détails et interactions
Lecture
Comportement
Choisissez les six actions rapides de l’accueil.
Aucun modèle ajouté
Fermer l’éditeur
Configuré
Enregistré localement
Synchronisation…
Synchronisé
Synchronisation indisponible · enregistré localement
Configuration du rôle
Activer le rôle : {name}
Ce rôle est désactivé. Activez-le d’abord dans les paramètres.
Description du rôle
Consignes supplémentaires
Les rôles désactivés sont exclus de l’association et de la sélection. Les consignes s’appliquent aux nouvelles tâches, pas aux tâches existantes.
Préférences de l’assistant
Association automatique des experts
L’activation envoie les brouillons, les extraits lisibles des pièces jointes et les profils au modèle choisi, avec des frais possibles. La désactivation arrête les requêtes automatiques.
Délai après la saisie
Utiliser les consignes des collaborateurs
Désactivez pour ne plus inclure ces consignes dans les nouvelles tâches.
Extensions disponibles
Installer
Désinstaller
Désinstaller {name} ?
Incompatible
Autorisations
Prérequis
Opération sur l’extension terminée.
Configurer
Ajouter une application personnalisée
Nom de l’application
Description de l’application
URL HTTPS du service
Transport
Seule la configuration publique est enregistrée localement, sans connexion. L’URL ne doit contenir ni identifiants, ni paramètres, ni fragment.
Saisissez une URL HTTPS publique sans identifiants, paramètres ni fragment.
Autoriser
Déconnecter
Déconnecter {name} ?
Supprimer la configuration locale de {name} ?
Aucun adaptateur d’autorisation pour cette application.
Autorisez dans la fenêtre du fournisseur. Ne saisissez ici ni mot de passe ni jeton. Actualisez l’état à votre retour.
La fenêtre a été bloquée. Autorisez les fenêtres contextuelles et réessayez.
URL d’autorisation inattendue : navigation bloquée.
Autorisation ouverte. Terminez puis actualisez l’état.
Service d’autorisation non configuré. Les configurations locales restent modifiables ; aucune autorisation externe n’a été effectuée.
Modèle vérifié
Échec de vérification
Non vérifié
API accessible · modèle non confirmé
Configuration ou clé modifiée. Vérifiez à nouveau.
Vérifiez les modèles gérés par le serveur sur la page Modèles et utilisation.
Vérifié le
`;

rows["de"] = `
Sprache und Arbeitsumgebung einstellen.
Öffentliches Profil und Konto verwalten.
Tatsächliche Nutzung und Tarifdaten ansehen.
Design, Schrift und Abstände anpassen.
Tastenkürzel anpassen.
Standardwerte für neue Aufgaben wählen.
Mit Zustimmung gespeicherte Erinnerungen verwalten.
Rollen aktivieren und Arbeitsregeln bearbeiten.
Modelle und Verbindungsprüfungen verwalten.
Expertenzuordnung und Erweiterungen einstellen.
Registrierte Geräte ansehen.
Lokale Daten sichern oder löschen.
Anwendungen konfigurieren und autorisieren.
Passwort und Sicherheitsverlauf prüfen.
Konto registriert
Profil aktualisiert
Passwort geändert
Anmeldung über Anbieter
Registrierung über Anbieter
Konto aktiviert
Konto deaktiviert
Anzeigename
E-Mail-Adresse
Benutzername
Konto
Aktion fehlgeschlagen. Bitte erneut versuchen.
Wird verarbeitet…
Keine Einträge
Gäste können die lokalen Daten dieses Geräts ansehen.
Datenverbindung
Gespeicherte Erinnerungen
Nur mit ausdrücklicher Zustimmung gespeicherte Inhalte. Kein automatisches Lernen.
Noch keine Erinnerungen
Mit Zustimmung gespeicherte Inhalte erscheinen hier.
Erinnerung hinzufügen
Inhalt der Erinnerung
Ich stimme zu, diesen Inhalt im Kontogedächtnis zu speichern.
Diese Erinnerung löschen?
Alle Erinnerungen unwiderruflich löschen?
Alle Erinnerungen löschen
Erinnerungen aktualisiert.
Unwiderrufliche Aktionen
Prüfen Sie vorab die Auswirkungen auf Ihre Daten.
Rollen suchen
Arbeitsregeln gelten für künftige Aufgaben, garantieren aber kein Ergebnis.
Details ansehen
Erweiterungen
Keine Erweiterungen installiert
Status tatsächlich installierter Erweiterungen. Ein Katalogeintrag erteilt keine Ausführungsrechte.
Aktiviert
Deaktiviert
{name} umschalten
Erweiterungsstatus aktualisiert.
App-Verbindungen
Nur bestätigte Autorisierungen. Eine gespeicherte Konfiguration stellt keine Verbindung her.
Keine autorisierten Verbindungen
Verbunden
Getrennt
Autorisierung ausstehend
Verbindungsfehler
Auf dem Server registrierte Geräte; kein Echtzeit-Onlinestatus.
Zuletzt erfasst
Passwort ändern
10 bis 128 Zeichen. Nach der Änderung werden andere Sitzungen beendet.
Aktuelles Passwort
Neues Passwort
Passwort geändert. Andere Sitzungen wurden beendet.
Sicherheitsaktivität
Tatsächlich vom Server protokollierte Aktionen.
Abrechnung
Der Guthabendienst ist nicht angebunden. Keine Guthaben oder Prämien werden angezeigt.
Tatsächlich belegter lokaler Speicher dieses Browsers.
Schriftvorschau
Angenehme Abstände für konzentriertes Arbeiten.
Schrift und Layout
Details und Interaktionen
Lesen
Verhalten
Sechs Schnellaktionen für die Startseite auswählen.
Noch keine Modelle hinzugefügt
Editor schließen
Konfiguriert
Lokal gespeichert
Wird synchronisiert…
Synchronisiert
Synchronisierung nicht verfügbar · lokal gespeichert
Rollenkonfiguration
Rolle aktivieren: {name}
Diese Rolle ist deaktiviert. Aktivieren Sie sie zuerst in den Einstellungen.
Rollenbeschreibung
Zusätzliche Arbeitsregeln
Deaktivierte Rollen werden nicht zugeordnet oder ausgewählt. Regeln gelten für neue, nicht für bestehende Aufgaben.
Assistenteneinstellungen
Experten automatisch zuordnen
Sendet Entwürfe, lesbare Anhangsauszüge und Rollenprofile an das gewählte Modell; Kosten können entstehen. Deaktivieren stoppt automatische Anfragen.
Wartezeit nach der Eingabe
Hinweise mitwirkender Experten verwenden
Deaktivieren schließt diese Hinweise aus neuen Aufgaben aus.
Verfügbare Erweiterungen
Installieren
Deinstallieren
{name} deinstallieren?
Nicht kompatibel
Berechtigungen
Voraussetzungen
Erweiterungsaktion abgeschlossen.
Konfigurieren
Eigene Anwendung hinzufügen
Anwendungsname
Anwendungsbeschreibung
HTTPS-Dienstadresse
Transport
Nur öffentliche Konfiguration wird lokal gespeichert, ohne Verbindung. URLs dürfen keine Zugangsdaten, Abfragen oder Fragmente enthalten.
Öffentliche HTTPS-URL ohne Zugangsdaten, Abfragen oder Fragmente eingeben.
Autorisieren
Trennen
Verbindung mit {name} trennen?
Lokale Konfiguration von {name} löschen?
Für diese Anwendung ist kein Autorisierungsadapter verfügbar.
Im Anbieterfenster autorisieren. Hier keine Passwörter oder Token eingeben. Anschließend den Status aktualisieren.
Autorisierungsfenster blockiert. Pop-ups erlauben und erneut versuchen.
Unerwartete Autorisierungsadresse; Navigation blockiert.
Autorisierung geöffnet. Abschließen und Status aktualisieren.
Autorisierungsdienst nicht eingerichtet. Lokale Konfigurationen bleiben bearbeitbar; es erfolgte keine externe Autorisierung.
Modell bestätigt
Prüfung fehlgeschlagen
Nicht geprüft
API erreichbar · Modell unbestätigt
Konfiguration oder Schlüssel geändert. Erneut prüfen.
Serververwaltete Modelle auf der Seite Modelle und Nutzung prüfen.
Geprüft am
`;

rows["es-ES"] = `
Ajusta el idioma y tu entorno de trabajo.
Gestiona tu perfil público y tu cuenta.
Consulta el uso real y tu plan.
Ajusta el tema, el texto y los espacios.
Personaliza los atajos de teclado.
Elige los valores de las nuevas tareas.
Gestiona los recuerdos guardados con tu consentimiento.
Activa roles y edita sus instrucciones.
Gestiona los modelos y sus verificaciones.
Configura la asignación de expertos y las extensiones.
Consulta los dispositivos registrados.
Haz copias o borra los datos locales.
Gestiona la configuración y autorización de aplicaciones.
Revisa la contraseña y el historial de seguridad.
Registro de cuenta
Actualización del perfil
Cambio de contraseña
Inicio de sesión con proveedor
Registro con proveedor
Activación de cuenta
Desactivación de cuenta
Nombre visible
Correo electrónico
Nombre de usuario
Cuenta
La operación ha fallado. Inténtalo de nuevo.
Procesando…
No hay registros
Los invitados pueden consultar los datos locales de este dispositivo.
Conexión de datos
Recuerdos guardados
Solo contenido guardado con consentimiento explícito. No es aprendizaje automático.
Aún no hay recuerdos
Aquí aparecerá el contenido que aceptes guardar.
Añadir recuerdo
Contenido del recuerdo
Acepto guardar este contenido en la memoria de la cuenta.
¿Eliminar este recuerdo?
¿Eliminar todos los recuerdos? No se puede deshacer.
Borrar todos los recuerdos
Memoria actualizada.
Acciones irreversibles
Comprueba su efecto sobre los datos antes de continuar.
Buscar roles
Las instrucciones se aplican a tareas futuras, sin garantizar resultados.
Ver detalles
Extensiones
No hay extensiones instaladas
Estado de extensiones realmente instaladas. Figurar en el catálogo no autoriza su ejecución.
Activado
Desactivado
Alternar {name}
Estado de la extensión actualizado.
Conexiones de aplicaciones
Solo autorizaciones verificadas. Guardar la configuración no establece una conexión.
No hay conexiones autorizadas
Conectado
Desconectado
Autorización pendiente
Error de conexión
Dispositivos registrados en el servidor, no su estado en línea en tiempo real.
Último registro
Cambiar contraseña
Entre 10 y 128 caracteres. Al cambiarla se cerrarán las demás sesiones.
Contraseña actual
Nueva contraseña
Contraseña actualizada. Las demás sesiones se han cerrado.
Actividad de seguridad
Acciones registradas realmente por el servidor.
Facturación
El servicio de créditos no está conectado. No se muestran saldos ni recompensas.
Almacenamiento local que utiliza realmente este navegador.
Vista previa del texto
Espacios cómodos para concentrarte en tu trabajo.
Texto y distribución
Detalles e interacciones
Lectura
Comportamiento
Elige las seis acciones rápidas del inicio.
Aún no hay modelos añadidos
Cerrar editor
Configurado
Guardado localmente
Sincronizando…
Sincronizado
Sin sincronización · guardado localmente
Configuración del rol
Activar rol: {name}
Este rol está desactivado. Actívalo primero en Ajustes.
Descripción del rol
Instrucciones adicionales
Los roles desactivados se excluyen de la asignación y selección. Las instrucciones afectan a tareas nuevas, no a las existentes.
Preferencias del asistente
Asignación automática de expertos
Al activar se envían borradores, fragmentos legibles de adjuntos y perfiles al modelo elegido; puede haber costes. Al desactivar se detienen las solicitudes automáticas.
Espera tras escribir
Usar instrucciones de colaboradores
Desactiva para excluir estas instrucciones de las tareas nuevas.
Extensiones disponibles
Instalar
Desinstalar
¿Desinstalar {name}?
Incompatible
Permisos
Requisitos
Operación de extensión completada.
Configurar
Añadir aplicación personalizada
Nombre de la aplicación
Descripción de la aplicación
URL HTTPS del servicio
Transporte
Solo se guarda la configuración pública localmente; no se conecta. La URL no debe contener credenciales, parámetros ni fragmentos.
Introduce una URL HTTPS pública sin credenciales, parámetros ni fragmentos.
Autorizar
Desconectar
¿Desconectar {name}?
¿Eliminar la configuración local de {name}?
No hay adaptador de autorización para esta aplicación.
Autoriza en la ventana del proveedor. No introduzcas aquí contraseñas ni tokens. Actualiza el estado al volver.
Ventana bloqueada. Permite las ventanas emergentes y vuelve a intentarlo.
URL de autorización inesperada; navegación bloqueada.
Autorización abierta. Complétala y actualiza el estado.
Servicio de autorización sin configurar. Puedes gestionar las configuraciones locales; no se ha realizado ninguna autorización externa.
Modelo verificado
Verificación fallida
Sin verificar
API accesible · modelo sin confirmar
La configuración o clave ha cambiado. Verifica de nuevo.
Verifica los modelos del servidor en Modelos y uso.
Fecha de verificación
`;

rows["pt-BR"] = `
Ajuste o idioma e seu ambiente de trabalho.
Gerencie seu perfil público e sua conta.
Consulte o uso real e seu plano.
Ajuste o tema, o texto e os espaçamentos.
Personalize os atalhos de teclado.
Escolha os padrões para novas tarefas.
Gerencie memórias salvas com seu consentimento.
Ative funções e edite suas instruções.
Gerencie modelos e verificações de conexão.
Configure a seleção de especialistas e extensões.
Consulte os dispositivos registrados.
Faça backup ou exclua os dados locais.
Gerencie configurações e autorizações de aplicativos.
Confira a senha e o histórico de segurança.
Cadastro de conta
Atualização do perfil
Alteração de senha
Login com provedor
Cadastro com provedor
Ativação de conta
Desativação de conta
Nome de exibição
E-mail
Nome de usuário
Conta
Falha na operação. Tente novamente.
Processando…
Nenhum registro
Visitantes podem consultar os dados locais deste dispositivo.
Conexão de dados
Memórias salvas
Somente conteúdo salvo com consentimento explícito. Não é aprendizado automático.
Nenhuma memória ainda
O conteúdo que você aceitar salvar aparecerá aqui.
Adicionar memória
Conteúdo da memória
Concordo em salvar este conteúdo na memória da conta.
Excluir esta memória?
Excluir todas as memórias? Esta ação é irreversível.
Limpar todas as memórias
Memória atualizada.
Ações irreversíveis
Confira o efeito nos dados antes de continuar.
Buscar funções
As instruções valem para tarefas futuras, sem garantir resultados.
Ver detalhes
Extensões
Nenhuma extensão instalada
Estado das extensões realmente instaladas. Uma entrada no catálogo não autoriza sua execução.
Ativado
Desativado
Alternar {name}
Estado da extensão atualizado.
Conexões de aplicativos
Somente autorizações verificadas. Salvar a configuração não estabelece conexão.
Nenhuma conexão autorizada
Conectado
Desconectado
Autorização pendente
Erro de conexão
Dispositivos registrados no servidor, não seu estado on-line em tempo real.
Último registro
Alterar senha
De 10 a 128 caracteres. A alteração encerra as outras sessões.
Senha atual
Nova senha
Senha atualizada. As outras sessões foram encerradas.
Atividade de segurança
Ações realmente registradas pelo servidor.
Faturamento
O serviço de créditos não está conectado. Não são exibidos saldos nem recompensas.
Armazenamento local realmente utilizado por este navegador.
Prévia do texto
Espaços confortáveis para se concentrar no trabalho.
Texto e layout
Detalhes e interações
Leitura
Comportamento
Escolha seis ações rápidas para a página inicial.
Nenhum modelo adicionado
Fechar editor
Configurado
Salvo localmente
Sincronizando…
Sincronizado
Sincronização indisponível · salvo localmente
Configuração da função
Ativar função: {name}
Esta função está desativada. Ative-a primeiro nas configurações.
Descrição da função
Instruções adicionais
Funções desativadas não participam da seleção. As instruções valem para tarefas novas, não para as existentes.
Preferências do assistente
Seleção automática de especialistas
Quando ativada, envia rascunhos, trechos legíveis de anexos e perfis ao modelo escolhido, podendo gerar custos. Desativar interrompe as solicitações automáticas.
Espera após digitar
Usar orientações dos colaboradores
Desative para excluir essas orientações das novas tarefas.
Extensões disponíveis
Instalar
Desinstalar
Desinstalar {name}?
Incompatível
Permissões
Requisitos
Operação da extensão concluída.
Configurar
Adicionar aplicativo personalizado
Nome do aplicativo
Descrição do aplicativo
URL HTTPS do serviço
Transporte
Apenas a configuração pública é salva localmente, sem conexão. URLs não podem conter credenciais, consultas ou fragmentos.
Informe uma URL HTTPS pública sem credenciais, consultas ou fragmentos.
Autorizar
Desconectar
Desconectar {name}?
Excluir a configuração local de {name}?
Não há adaptador de autorização para este aplicativo.
Autorize na janela do provedor. Não informe senhas ou tokens aqui. Atualize o estado ao voltar.
Janela bloqueada. Permita pop-ups e tente novamente.
URL de autorização inesperada; navegação bloqueada.
Autorização aberta. Conclua e atualize o estado.
Serviço de autorização não configurado. As configurações locais podem ser gerenciadas; nenhuma autorização externa foi realizada.
Modelo verificado
Falha na verificação
Não verificado
API acessível · modelo não confirmado
Configuração ou chave alterada. Verifique novamente.
Verifique os modelos do servidor na página Modelos e uso.
Verificado em
`;

rows["it"] = `
Imposta la lingua e l’ambiente di lavoro.
Gestisci il profilo pubblico e l’account.
Consulta l’utilizzo reale e il piano.
Regola tema, testo e spaziatura.
Personalizza le scorciatoie da tastiera.
Scegli le impostazioni per le nuove attività.
Gestisci i ricordi salvati con il tuo consenso.
Attiva i ruoli e modifica le istruzioni.
Gestisci modelli e verifiche di connessione.
Configura l’assegnazione degli esperti e le estensioni.
Consulta i dispositivi registrati.
Esegui il backup o elimina i dati locali.
Gestisci configurazioni e autorizzazioni delle applicazioni.
Controlla password e cronologia di sicurezza.
Registrazione account
Aggiornamento profilo
Modifica password
Accesso tramite fornitore
Registrazione tramite fornitore
Attivazione account
Disattivazione account
Nome visualizzato
E-mail
Nome utente
Account
Operazione non riuscita. Riprova.
Elaborazione…
Nessuna registrazione
Gli ospiti possono consultare i dati locali del dispositivo.
Connessione dati
Ricordi salvati
Solo contenuti salvati con consenso esplicito. Non è apprendimento automatico.
Nessun ricordo
Qui appariranno i contenuti che accetti di salvare.
Aggiungi ricordo
Contenuto del ricordo
Acconsento a salvare questo contenuto nella memoria dell’account.
Eliminare questo ricordo?
Eliminare tutti i ricordi? L’operazione è irreversibile.
Cancella tutti i ricordi
Memoria aggiornata.
Azioni irreversibili
Verifica gli effetti sui dati prima di continuare.
Cerca ruoli
Le istruzioni valgono per le attività future, senza garantire i risultati.
Mostra dettagli
Estensioni
Nessuna estensione installata
Stato delle estensioni realmente installate. La presenza nel catalogo non ne autorizza l’esecuzione.
Attivo
Disattivo
Attiva o disattiva {name}
Stato dell’estensione aggiornato.
Connessioni alle applicazioni
Solo autorizzazioni verificate. Salvare la configurazione non crea una connessione.
Nessuna connessione autorizzata
Connesso
Disconnesso
Autorizzazione in attesa
Errore di connessione
Dispositivi registrati sul server, non stato online in tempo reale.
Ultima registrazione
Modifica password
Da 10 a 128 caratteri. La modifica chiude le altre sessioni.
Password attuale
Nuova password
Password aggiornata. Le altre sessioni sono state chiuse.
Attività di sicurezza
Azioni realmente registrate dal server.
Fatturazione
Il servizio crediti non è collegato. Non vengono mostrati saldi o premi.
Spazio locale effettivamente usato dal browser.
Anteprima del testo
Spazi confortevoli per concentrarti sul lavoro.
Testo e disposizione
Dettagli e interazioni
Lettura
Comportamento
Scegli sei azioni rapide per la pagina iniziale.
Nessun modello aggiunto
Chiudi editor
Configurato
Salvato localmente
Sincronizzazione…
Sincronizzato
Sincronizzazione non disponibile · salvato localmente
Configurazione del ruolo
Attiva ruolo: {name}
Questo ruolo è disattivato. Attivalo prima nelle impostazioni.
Descrizione del ruolo
Istruzioni aggiuntive
I ruoli disattivati sono esclusi da assegnazione e selezione. Le istruzioni valgono per le nuove attività, non per quelle esistenti.
Preferenze dell’assistente
Assegnazione automatica degli esperti
Invia bozze, estratti leggibili degli allegati e profili al modello scelto; possono esserci costi. Disattivando si interrompono le richieste automatiche.
Attesa dopo la digitazione
Usa le indicazioni dei collaboratori
Disattiva per escludere queste indicazioni dalle nuove attività.
Estensioni disponibili
Installa
Disinstalla
Disinstallare {name}?
Non compatibile
Autorizzazioni
Requisiti
Operazione sull’estensione completata.
Configura
Aggiungi applicazione personalizzata
Nome applicazione
Descrizione applicazione
URL HTTPS del servizio
Trasporto
Viene salvata localmente solo la configurazione pubblica, senza connessione. Gli URL non devono contenere credenziali, query o frammenti.
Inserisci un URL HTTPS pubblico senza credenziali, query o frammenti.
Autorizza
Disconnetti
Disconnettere {name}?
Eliminare la configurazione locale di {name}?
Nessun adattatore di autorizzazione per questa applicazione.
Autorizza nella finestra del fornitore. Non inserire qui password o token. Aggiorna lo stato al ritorno.
Finestra bloccata. Consenti i popup e riprova.
URL di autorizzazione inatteso; navigazione bloccata.
Autorizzazione aperta. Completa e aggiorna lo stato.
Servizio di autorizzazione non configurato. Le configurazioni locali restano gestibili; nessuna autorizzazione esterna è avvenuta.
Modello verificato
Verifica non riuscita
Non verificato
API raggiungibile · modello non confermato
Configurazione o chiave modificata. Verifica di nuovo.
Verifica i modelli del server nella pagina Modelli e utilizzo.
Verificato il
`;

rows["id"] = `
Atur bahasa dan lingkungan kerja.
Kelola profil publik dan akun.
Lihat penggunaan nyata dan paket Anda.
Sesuaikan tema, teks, dan jarak.
Sesuaikan pintasan keyboard.
Pilih nilai awal untuk tugas baru.
Kelola ingatan yang disimpan dengan persetujuan.
Aktifkan peran dan edit petunjuk kerja.
Kelola model dan hasil verifikasi.
Atur pencocokan pakar dan ekstensi.
Lihat perangkat terdaftar.
Cadangkan atau hapus data lokal.
Kelola konfigurasi dan otorisasi aplikasi.
Periksa kata sandi dan riwayat keamanan.
Pendaftaran akun
Pembaruan profil
Perubahan kata sandi
Masuk melalui penyedia
Mendaftar melalui penyedia
Pengaktifan akun
Penonaktifan akun
Nama tampilan
Email
Nama pengguna
Akun
Operasi gagal. Coba lagi.
Memproses…
Belum ada catatan
Tamu dapat melihat data lokal perangkat ini.
Koneksi data
Ingatan tersimpan
Hanya konten yang disimpan dengan persetujuan tegas. Bukan pembelajaran otomatis.
Belum ada ingatan
Konten yang Anda setujui untuk disimpan akan muncul di sini.
Tambah ingatan
Isi ingatan
Saya setuju menyimpan konten ini dalam ingatan akun.
Hapus ingatan ini?
Hapus semua ingatan? Tindakan ini tidak dapat dibatalkan.
Hapus semua ingatan
Ingatan diperbarui.
Tindakan permanen
Periksa dampaknya pada data sebelum melanjutkan.
Cari peran
Petunjuk berlaku untuk tugas berikutnya, tanpa menjamin hasilnya.
Lihat detail
Ekstensi
Belum ada ekstensi terpasang
Status ekstensi yang benar-benar terpasang. Terdaftar di katalog bukan izin untuk menjalankan.
Aktif
Nonaktif
Ubah status {name}
Status ekstensi diperbarui.
Koneksi aplikasi
Hanya otorisasi terverifikasi. Menyimpan konfigurasi tidak membuat koneksi.
Belum ada koneksi terotorisasi
Terhubung
Terputus
Menunggu otorisasi
Kesalahan koneksi
Data perangkat yang tercatat di server, bukan status daring waktu nyata.
Terakhir tercatat
Ubah kata sandi
10–128 karakter. Perubahan akan mengakhiri sesi lain.
Kata sandi saat ini
Kata sandi baru
Kata sandi diperbarui. Sesi lain telah diakhiri.
Aktivitas keamanan
Tindakan yang benar-benar dicatat server.
Penagihan
Layanan kredit belum terhubung. Saldo atau hadiah tidak ditampilkan.
Penyimpanan lokal yang benar-benar digunakan browser ini.
Pratinjau teks
Jarak yang nyaman untuk fokus bekerja.
Teks dan tata letak
Detail dan interaksi
Membaca
Perilaku
Pilih enam tindakan cepat di beranda.
Belum ada model ditambahkan
Tutup editor
Dikonfigurasi
Tersimpan secara lokal
Menyinkronkan…
Tersinkron
Sinkronisasi tidak tersedia · tersimpan lokal
Konfigurasi peran
Aktifkan peran: {name}
Peran ini nonaktif. Aktifkan dahulu di Pengaturan.
Deskripsi peran
Petunjuk tambahan
Peran nonaktif tidak ikut pencocokan atau pemilihan. Petunjuk berlaku untuk tugas baru, bukan tugas yang sudah ada.
Preferensi asisten
Pencocokan pakar otomatis
Saat aktif, draf, kutipan lampiran yang terbaca, dan profil dikirim ke model terpilih dan dapat dikenai biaya. Nonaktifkan untuk menghentikan permintaan otomatis.
Jeda setelah mengetik
Gunakan panduan pakar pendamping
Nonaktifkan untuk mengecualikan panduan ini dari tugas baru.
Ekstensi tersedia
Pasang
Copot
Copot {name}?
Tidak kompatibel
Izin
Persyaratan
Operasi ekstensi selesai.
Konfigurasi
Tambah aplikasi khusus
Nama aplikasi
Deskripsi aplikasi
URL layanan HTTPS
Transportasi
Hanya konfigurasi publik disimpan secara lokal; tidak membuat koneksi. URL tidak boleh memuat kredensial, kueri, atau fragmen.
Masukkan URL HTTPS publik tanpa kredensial, kueri, atau fragmen.
Otorisasi
Putuskan
Putuskan koneksi {name}?
Hapus konfigurasi lokal {name}?
Adaptor otorisasi untuk aplikasi ini belum tersedia.
Lakukan otorisasi di jendela penyedia. Jangan masukkan kata sandi atau token di sini. Segarkan status setelah kembali.
Jendela diblokir. Izinkan pop-up dan coba lagi.
URL otorisasi tidak sesuai; navigasi diblokir.
Otorisasi dibuka. Selesaikan lalu segarkan status.
Layanan otorisasi belum dikonfigurasi. Konfigurasi lokal tetap dapat dikelola; tidak ada otorisasi eksternal yang dilakukan.
Model terverifikasi
Verifikasi gagal
Belum diverifikasi
API dapat diakses · model belum dikonfirmasi
Konfigurasi atau kunci berubah. Verifikasi lagi.
Verifikasi model yang dikelola server di halaman Model dan penggunaan.
Waktu verifikasi
`;

rows["tr"] = `
Dili ve çalışma ortamını ayarlayın.
Herkese açık profilinizi ve hesabınızı yönetin.
Gerçek kullanımı ve planınızı inceleyin.
Temayı, metni ve boşlukları ayarlayın.
Klavye kısayollarını özelleştirin.
Yeni görevlerin varsayılanlarını seçin.
Onayla kaydedilen anıları yönetin.
Rolleri etkinleştirin ve talimatları düzenleyin.
Modelleri ve doğrulama sonuçlarını yönetin.
Uzman eşleştirmeyi ve uzantıları ayarlayın.
Kayıtlı cihazları inceleyin.
Yerel verileri yedekleyin veya silin.
Uygulama ayarlarını ve yetkilendirmeyi yönetin.
Parolayı ve güvenlik geçmişini inceleyin.
Hesap kaydı
Profil güncellemesi
Parola değişikliği
Sağlayıcı ile giriş
Sağlayıcı ile kayıt
Hesap etkinleştirme
Hesap devre dışı bırakma
Görünen ad
E-posta
Kullanıcı adı
Hesap
İşlem başarısız. Yeniden deneyin.
İşleniyor…
Kayıt yok
Misafirler bu cihazın yerel verilerini görebilir.
Veri bağlantısı
Kayıtlı anılar
Yalnızca açık onayla kaydedilen içerik. Otomatik öğrenme değildir.
Henüz anı yok
Kaydetmeyi onayladığınız içerik burada görünür.
Anı ekle
Anı içeriği
Bu içeriğin hesap belleğine kaydedilmesini kabul ediyorum.
Bu anı silinsin mi?
Tüm anılar silinsin mi? Bu işlem geri alınamaz.
Tüm anıları temizle
Bellek güncellendi.
Geri alınamayan işlemler
Devam etmeden önce verilere etkisini kontrol edin.
Rol ara
Talimatlar sonraki görevlerde kullanılır; sonuç garantisi değildir.
Ayrıntıları gör
Uzantılar
Yüklü uzantı yok
Gerçekten yüklü uzantıların durumu. Katalog kaydı çalıştırma yetkisi vermez.
Etkin
Devre dışı
{name} durumunu değiştir
Uzantı durumu güncellendi.
Uygulama bağlantıları
Yalnızca doğrulanmış yetkiler. Ayarları kaydetmek bağlantı kurmaz.
Yetkilendirilmiş bağlantı yok
Bağlı
Bağlı değil
Yetkilendirme bekliyor
Bağlantı hatası
Sunucuda kayıtlı cihazlar; anlık çevrimiçi durumu değildir.
Son kayıt
Parolayı değiştir
10–128 karakter. Değişiklik diğer oturumları kapatır.
Mevcut parola
Yeni parola
Parola güncellendi. Diğer oturumlar kapatıldı.
Güvenlik etkinliği
Sunucunun gerçekten kaydettiği işlemler.
Faturalandırma
Kredi hizmeti bağlı değil. Bakiye veya ödül gösterilmez.
Bu tarayıcının gerçekten kullandığı yerel depolama.
Metin önizlemesi
Rahat boşluklarla işinize odaklanın.
Metin ve düzen
Ayrıntılar ve etkileşimler
Okuma
Davranış
Ana sayfa için altı hızlı işlem seçin.
Henüz model eklenmedi
Düzenleyiciyi kapat
Yapılandırıldı
Yerel olarak kaydedildi
Eşitleniyor…
Eşitlendi
Eşitleme kullanılamıyor · yerel kaydedildi
Rol yapılandırması
Rolü etkinleştir: {name}
Bu rol devre dışı. Önce Ayarlar’dan etkinleştirin.
Rol açıklaması
Ek talimatlar
Devre dışı roller eşleştirme ve seçimden çıkarılır. Talimatlar mevcut değil, yeni görevlere uygulanır.
Asistan tercihleri
Otomatik uzman eşleştirme
Etkinleştirildiğinde taslaklar, okunabilir ek alıntıları ve profiller seçilen modele gönderilir; ücret doğabilir. Kapatmak otomatik istekleri durdurur.
Yazma sonrası bekleme
İş birliği yapan uzmanların rehberliğini kullan
Kapatmak bu rehberliği yeni görevlerden çıkarır.
Kullanılabilir uzantılar
Yükle
Kaldır
{name} kaldırılsın mı?
Uyumsuz
İzinler
Gereksinimler
Uzantı işlemi tamamlandı.
Yapılandır
Özel uygulama ekle
Uygulama adı
Uygulama açıklaması
HTTPS hizmet URL’si
Aktarım
Yalnızca açık yapılandırma yerel kaydedilir; bağlantı kurulmaz. URL kimlik bilgisi, sorgu veya parça içermemelidir.
Kimlik bilgisi, sorgu ve parça içermeyen genel bir HTTPS URL’si girin.
Yetkilendir
Bağlantıyı kes
{name} bağlantısı kesilsin mi?
{name} yerel yapılandırması silinsin mi?
Bu uygulama için yetkilendirme bağdaştırıcısı yok.
Sağlayıcı penceresinde yetkilendirin. Buraya parola veya belirteç girmeyin. Dönüşte durumu yenileyin.
Pencere engellendi. Açılır pencerelere izin verip yeniden deneyin.
Beklenmeyen yetkilendirme URL’si; gezinme engellendi.
Yetkilendirme açıldı. Tamamlayıp durumu yenileyin.
Yetkilendirme hizmeti yapılandırılmadı. Yerel ayarlar yönetilebilir; dış yetkilendirme yapılmadı.
Model doğrulandı
Doğrulama başarısız
Doğrulanmadı
API erişilebilir · model onaylanmadı
Yapılandırma veya anahtar değişti. Yeniden doğrulayın.
Sunucu modellerini Modeller ve kullanım sayfasından doğrulayın.
Doğrulama zamanı
`;

rows["hu"] = `
Állítsa be a nyelvet és a munkakörnyezetet.
Kezelje nyilvános profilját és fiókját.
Tekintse meg a tényleges használatot és a csomagot.
Módosítsa a témát, szöveget és térközöket.
Szabja testre a billentyűparancsokat.
Válassza ki az új feladatok alapértékeit.
Kezelje a hozzájárulással mentett emlékeket.
Engedélyezze a szerepeket és szerkessze utasításaikat.
Kezelje a modelleket és ellenőrzéseiket.
Állítsa be a szakértőválasztást és a bővítményeket.
Tekintse meg a rögzített eszközöket.
Mentse vagy törölje a helyi adatokat.
Kezelje az alkalmazások beállításait és engedélyeit.
Ellenőrizze a jelszót és a biztonsági előzményeket.
Fiók regisztrálása
Profil frissítése
Jelszó módosítása
Bejelentkezés szolgáltatóval
Regisztráció szolgáltatóval
Fiók engedélyezése
Fiók letiltása
Megjelenített név
E-mail
Felhasználónév
Fiók
A művelet sikertelen. Próbálja újra.
Feldolgozás…
Nincsenek bejegyzések
A vendégek ezen eszköz helyi adatait láthatják.
Adatkapcsolat
Mentett emlékek
Csak kifejezett hozzájárulással mentett tartalom. Nem automatikus tanulás.
Még nincsenek emlékek
A jóváhagyással mentett tartalom itt jelenik meg.
Emlék hozzáadása
Emlék tartalma
Hozzájárulok a tartalom mentéséhez a fiók memóriájába.
Törli ezt az emléket?
Törli az összes emléket? Ez nem vonható vissza.
Összes emlék törlése
Memória frissítve.
Visszavonhatatlan műveletek
Folytatás előtt ellenőrizze az adatokra gyakorolt hatást.
Szerepek keresése
Az utasítások a későbbi feladatokra érvényesek, de nem garantálnak eredményt.
Részletek
Bővítmények
Nincs telepített bővítmény
A valóban telepített bővítmények állapota. A katalógusbejegyzés nem ad futtatási engedélyt.
Engedélyezve
Letiltva
{name} átkapcsolása
Bővítmény állapota frissítve.
Alkalmazáskapcsolatok
Csak ellenőrzött engedélyek. A beállítás mentése nem hoz létre kapcsolatot.
Nincs engedélyezett kapcsolat
Kapcsolódva
Nincs kapcsolat
Engedélyezésre vár
Kapcsolódási hiba
A szerveren rögzített eszközök, nem valós idejű online állapot.
Utolsó bejegyzés
Jelszó módosítása
10–128 karakter. A módosítás kijelentkezteti a többi munkamenetet.
Jelenlegi jelszó
Új jelszó
Jelszó frissítve. A többi munkamenet lezárult.
Biztonsági tevékenység
A szerver által ténylegesen naplózott műveletek.
Számlázás
A kreditszolgáltatás nincs csatlakoztatva. Nem jelenik meg egyenleg vagy jutalom.
A böngésző által ténylegesen használt helyi tárhely.
Szöveg előnézete
Kényelmes térközök az összpontosításhoz.
Szöveg és elrendezés
Részletek és interakciók
Olvasás
Működés
Válasszon hat gyorsműveletet a kezdőlapra.
Még nincs hozzáadott modell
Szerkesztő bezárása
Beállítva
Helyben mentve
Szinkronizálás…
Szinkronizálva
Szinkronizálás nem elérhető · helyben mentve
Szerep beállításai
Szerep engedélyezése: {name}
Ez a szerep le van tiltva. Először engedélyezze a beállításokban.
Szerep leírása
További utasítások
A letiltott szerepek nem választhatók. Az utasítások az új, nem a meglévő feladatokra érvényesek.
Asszisztens beállításai
Automatikus szakértőválasztás
Bekapcsolva a vázlatok, olvasható mellékletrészletek és profilok a kiválasztott modellhez kerülnek, ami díjköteles lehet. Kikapcsolva leállnak az automatikus kérések.
Várakozás gépelés után
Közreműködő szakértők útmutatásának használata
Kikapcsolva ezek az útmutatások kimaradnak az új feladatokból.
Elérhető bővítmények
Telepítés
Eltávolítás
Eltávolítja ezt: {name}?
Nem kompatibilis
Engedélyek
Követelmények
Bővítményművelet befejezve.
Beállítás
Egyéni alkalmazás hozzáadása
Alkalmazás neve
Alkalmazás leírása
HTTPS-szolgáltatás URL-je
Átvitel
Csak nyilvános beállítások mentődnek helyben; kapcsolat nem jön létre. Az URL nem tartalmazhat hitelesítő adatokat, lekérdezést vagy töredéket.
Adjon meg nyilvános HTTPS URL-t hitelesítő adatok, lekérdezés és töredék nélkül.
Engedélyezés
Leválasztás
Leválasztja ezt: {name}?
Törli {name} helyi beállításait?
Ehhez az alkalmazáshoz nincs engedélyezési adapter.
Engedélyezzen a szolgáltató ablakában. Ide ne írjon jelszót vagy tokent. Visszatéréskor frissítse az állapotot.
Az ablak blokkolva. Engedélyezze a felugró ablakokat, és próbálja újra.
Váratlan engedélyezési URL; a navigáció blokkolva.
Engedélyezési ablak megnyitva. Befejezés után frissítse az állapotot.
Az engedélyezési szolgáltatás nincs beállítva. A helyi beállítások kezelhetők; külső engedélyezés nem történt.
Modell ellenőrizve
Sikertelen ellenőrzés
Nincs ellenőrizve
API elérhető · modell nem igazolt
A beállítás vagy kulcs változott. Ellenőrizze újra.
A szervermodell ellenőrzéséhez nyissa meg a Modellek és használat oldalt.
Ellenőrzés ideje
`;

rows["ru"] = `
Настройте язык и рабочую среду.
Управляйте открытым профилем и аккаунтом.
Просматривайте реальные показатели использования и тариф.
Настройте тему, текст и интервалы.
Измените сочетания клавиш.
Выберите параметры новых задач.
Управляйте записями памяти, сохранёнными с согласия.
Включайте роли и редактируйте инструкции.
Управляйте моделями и результатами проверок.
Настройте подбор экспертов и расширения.
Просматривайте зарегистрированные устройства.
Создавайте резервные копии и удаляйте локальные данные.
Управляйте настройками и авторизацией приложений.
Проверьте пароль и журнал безопасности.
Регистрация аккаунта
Обновление профиля
Смена пароля
Вход через провайдера
Регистрация через провайдера
Включение аккаунта
Отключение аккаунта
Отображаемое имя
Электронная почта
Имя пользователя
Аккаунт
Операция не выполнена. Повторите попытку.
Обработка…
Нет записей
Гости могут просматривать локальные данные устройства.
Подключение данных
Сохранённые записи памяти
Только содержимое, сохранённое с явного согласия. Это не автоматическое обучение.
Память пока пуста
Здесь появится содержимое, которое вы согласитесь сохранить.
Добавить запись
Содержимое записи
Я согласен сохранить это содержимое в памяти аккаунта.
Удалить эту запись?
Удалить все записи памяти? Это нельзя отменить.
Очистить всю память
Память обновлена.
Необратимые действия
Перед продолжением проверьте влияние на данные.
Поиск ролей
Инструкции применяются к будущим задачам и не гарантируют результат.
Подробнее
Расширения
Нет установленных расширений
Статус реально установленных расширений. Запись в каталоге не разрешает выполнение.
Включено
Отключено
Переключить {name}
Статус расширения обновлён.
Подключения приложений
Только проверенные авторизации. Сохранение настроек не устанавливает соединение.
Нет авторизованных подключений
Подключено
Отключено
Ожидается авторизация
Ошибка подключения
Устройства, записанные на сервере, без статуса присутствия в реальном времени.
Последняя запись
Изменить пароль
От 10 до 128 символов. После смены другие сеансы завершатся.
Текущий пароль
Новый пароль
Пароль обновлён. Другие сеансы завершены.
Журнал безопасности
Действия, фактически записанные сервером.
Оплата
Сервис кредитов не подключён. Баланс и награды не отображаются.
Фактический объём локального хранилища этого браузера.
Предпросмотр текста
Удобные интервалы помогают сосредоточиться на работе.
Текст и макет
Детали и взаимодействие
Чтение
Поведение
Выберите шесть быстрых действий на главной странице.
Модели ещё не добавлены
Закрыть редактор
Настроено
Сохранено локально
Синхронизация…
Синхронизировано
Синхронизация недоступна · сохранено локально
Настройка роли
Включить роль: {name}
Эта роль отключена. Сначала включите её в настройках.
Описание роли
Дополнительные инструкции
Отключённые роли исключены из подбора и выбора. Инструкции применяются к новым, но не к существующим задачам.
Настройки помощника
Автоматический подбор экспертов
При включении черновики, читаемые фрагменты вложений и профили отправляются выбранной модели; возможна плата. Отключение останавливает автоматические запросы.
Задержка после ввода
Использовать указания помощников
Отключите, чтобы не добавлять эти указания в новые задачи.
Доступные расширения
Установить
Удалить
Удалить {name}?
Несовместимо
Разрешения
Требования
Операция с расширением завершена.
Настроить
Добавить своё приложение
Название приложения
Описание приложения
HTTPS-адрес сервиса
Транспорт
Локально сохраняются только открытые настройки, без подключения. URL не должен содержать учётные данные, запрос или фрагмент.
Введите общедоступный HTTPS URL без учётных данных, запроса и фрагмента.
Авторизовать
Отключить
Отключить {name}?
Удалить локальные настройки {name}?
Для этого приложения нет адаптера авторизации.
Пройдите авторизацию в окне провайдера. Не вводите здесь пароли или токены. После возврата обновите статус.
Окно заблокировано. Разрешите всплывающие окна и повторите попытку.
Неожиданный URL авторизации; переход заблокирован.
Окно авторизации открыто. Завершите и обновите статус.
Сервис авторизации не настроен. Локальные настройки доступны; внешняя авторизация не выполнялась.
Модель проверена
Ошибка проверки
Не проверено
API доступен · модель не подтверждена
Настройки или ключ изменены. Проверьте снова.
Проверяйте серверные модели на странице «Модели и использование».
Время проверки
`;

rows["uk"] = `
Налаштуйте мову та робоче середовище.
Керуйте відкритим профілем і обліковим записом.
Переглядайте фактичне використання та тариф.
Налаштуйте тему, текст та інтервали.
Змініть клавіатурні скорочення.
Виберіть початкові параметри нових завдань.
Керуйте спогадами, збереженими за згодою.
Вмикайте ролі та редагуйте інструкції.
Керуйте моделями й результатами перевірки.
Налаштуйте добір експертів і розширення.
Переглядайте зареєстровані пристрої.
Створюйте резервні копії та видаляйте локальні дані.
Керуйте налаштуваннями й авторизацією застосунків.
Перевірте пароль та історію безпеки.
Реєстрація облікового запису
Оновлення профілю
Зміна пароля
Вхід через провайдера
Реєстрація через провайдера
Увімкнення облікового запису
Вимкнення облікового запису
Відображуване ім’я
Електронна пошта
Ім’я користувача
Обліковий запис
Помилка операції. Спробуйте ще раз.
Обробка…
Немає записів
Гості можуть переглядати локальні дані пристрою.
З’єднання з даними
Збережені спогади
Лише вміст, збережений за явною згодою. Це не автоматичне навчання.
Спогадів ще немає
Тут з’явиться вміст, який ви погодитеся зберегти.
Додати спогад
Вміст спогаду
Я погоджуюся зберегти цей вміст у пам’яті облікового запису.
Видалити цей спогад?
Видалити всі спогади? Це незворотна дія.
Очистити всі спогади
Пам’ять оновлено.
Незворотні дії
Перед продовженням перевірте вплив на дані.
Пошук ролей
Інструкції діють для майбутніх завдань, але не гарантують результат.
Докладніше
Розширення
Немає встановлених розширень
Стан дійсно встановлених розширень. Запис у каталозі не дає дозволу на запуск.
Увімкнено
Вимкнено
Перемкнути {name}
Стан розширення оновлено.
З’єднання застосунків
Лише перевірені авторизації. Збереження налаштувань не встановлює з’єднання.
Немає авторизованих з’єднань
Підключено
Відключено
Очікується авторизація
Помилка з’єднання
Пристрої, записані на сервері, а не стан присутності в реальному часі.
Останній запис
Змінити пароль
Від 10 до 128 символів. Зміна завершує інші сеанси.
Поточний пароль
Новий пароль
Пароль оновлено. Інші сеанси завершено.
Події безпеки
Дії, фактично записані сервером.
Оплата
Сервіс кредитів не підключено. Баланс і винагороди не відображаються.
Фактичний обсяг локального сховища цього браузера.
Перегляд тексту
Зручні інтервали допомагають зосередитися на роботі.
Текст і компонування
Деталі та взаємодія
Читання
Поведінка
Виберіть шість швидких дій на головній сторінці.
Моделі ще не додано
Закрити редактор
Налаштовано
Збережено локально
Синхронізація…
Синхронізовано
Синхронізація недоступна · збережено локально
Налаштування ролі
Увімкнути роль: {name}
Цю роль вимкнено. Спочатку ввімкніть її в налаштуваннях.
Опис ролі
Додаткові інструкції
Вимкнені ролі виключено з добору й вибору. Інструкції діють для нових, але не для наявних завдань.
Налаштування помічника
Автоматичний добір експертів
Коли ввімкнено, чернетки, читабельні фрагменти вкладень і профілі надсилаються вибраній моделі; можлива плата. Вимкнення зупиняє автоматичні запити.
Затримка після введення
Використовувати вказівки співвиконавців
Вимкніть, щоб не додавати ці вказівки до нових завдань.
Доступні розширення
Установити
Видалити
Видалити {name}?
Несумісне
Дозволи
Вимоги
Операцію з розширенням завершено.
Налаштувати
Додати власний застосунок
Назва застосунку
Опис застосунку
HTTPS-адреса сервісу
Транспорт
Локально зберігаються лише відкриті налаштування, без з’єднання. URL не має містити облікових даних, запиту чи фрагмента.
Введіть загальнодоступний HTTPS URL без облікових даних, запиту й фрагмента.
Авторизувати
Відключити
Відключити {name}?
Видалити локальні налаштування {name}?
Для цього застосунку немає адаптера авторизації.
Авторизуйтеся у вікні провайдера. Не вводьте тут паролі чи токени. Після повернення оновіть стан.
Вікно заблоковано. Дозвольте спливні вікна й повторіть спробу.
Неочікуваний URL авторизації; перехід заблоковано.
Вікно авторизації відкрито. Завершіть і оновіть стан.
Сервіс авторизації не налаштовано. Локальні налаштування доступні; зовнішня авторизація не відбувалася.
Модель перевірено
Помилка перевірки
Не перевірено
API доступний · модель не підтверджено
Налаштування або ключ змінено. Перевірте знову.
Перевіряйте серверні моделі на сторінці «Моделі й використання».
Час перевірки
`;

rows["pl"] = `
Ustaw język i środowisko pracy.
Zarządzaj profilem publicznym i kontem.
Sprawdź rzeczywiste użycie i plan.
Dostosuj motyw, tekst i odstępy.
Dostosuj skróty klawiaturowe.
Wybierz ustawienia nowych zadań.
Zarządzaj wspomnieniami zapisanymi za zgodą.
Włączaj role i edytuj instrukcje.
Zarządzaj modelami i wynikami weryfikacji.
Ustaw dobór ekspertów i rozszerzenia.
Sprawdź zarejestrowane urządzenia.
Twórz kopie lub usuwaj dane lokalne.
Zarządzaj konfiguracją i autoryzacją aplikacji.
Sprawdź hasło i historię zabezpieczeń.
Rejestracja konta
Aktualizacja profilu
Zmiana hasła
Logowanie przez dostawcę
Rejestracja przez dostawcę
Włączenie konta
Wyłączenie konta
Nazwa wyświetlana
E-mail
Nazwa użytkownika
Konto
Operacja nie powiodła się. Spróbuj ponownie.
Przetwarzanie…
Brak wpisów
Goście mogą przeglądać lokalne dane tego urządzenia.
Połączenie danych
Zapisane wspomnienia
Tylko treści zapisane za wyraźną zgodą. To nie jest automatyczne uczenie.
Brak wspomnień
Tutaj pojawią się treści, na których zapis wyrazisz zgodę.
Dodaj wspomnienie
Treść wspomnienia
Zgadzam się na zapisanie tej treści w pamięci konta.
Usunąć to wspomnienie?
Usunąć wszystkie wspomnienia? Nie można tego cofnąć.
Wyczyść wszystkie wspomnienia
Pamięć zaktualizowana.
Nieodwracalne operacje
Przed kontynuowaniem sprawdź wpływ na dane.
Szukaj ról
Instrukcje dotyczą przyszłych zadań, ale nie gwarantują wyników.
Zobacz szczegóły
Rozszerzenia
Brak zainstalowanych rozszerzeń
Stan rzeczywiście zainstalowanych rozszerzeń. Wpis w katalogu nie daje prawa do uruchomienia.
Włączone
Wyłączone
Przełącz {name}
Stan rozszerzenia zaktualizowany.
Połączenia aplikacji
Tylko zweryfikowane autoryzacje. Zapis konfiguracji nie nawiązuje połączenia.
Brak autoryzowanych połączeń
Połączono
Rozłączono
Oczekiwanie na autoryzację
Błąd połączenia
Urządzenia zapisane na serwerze, bez stanu online w czasie rzeczywistym.
Ostatni zapis
Zmień hasło
Od 10 do 128 znaków. Zmiana zakończy pozostałe sesje.
Obecne hasło
Nowe hasło
Hasło zmieniono. Pozostałe sesje zakończono.
Aktywność zabezpieczeń
Operacje rzeczywiście zapisane przez serwer.
Rozliczenia
Usługa kredytów nie jest połączona. Salda i nagrody nie są wyświetlane.
Rzeczywiste użycie lokalnej pamięci tej przeglądarki.
Podgląd tekstu
Wygodne odstępy ułatwiają skupienie na pracy.
Tekst i układ
Szczegóły i interakcje
Czytanie
Zachowanie
Wybierz sześć szybkich działań na stronie głównej.
Nie dodano jeszcze modeli
Zamknij edytor
Skonfigurowano
Zapisano lokalnie
Synchronizacja…
Zsynchronizowano
Synchronizacja niedostępna · zapisano lokalnie
Konfiguracja roli
Włącz rolę: {name}
Ta rola jest wyłączona. Najpierw włącz ją w ustawieniach.
Opis roli
Dodatkowe instrukcje
Wyłączone role są pomijane w doborze i wyborze. Instrukcje dotyczą nowych, a nie istniejących zadań.
Preferencje asystenta
Automatyczny dobór ekspertów
Po włączeniu szkice, czytelne fragmenty załączników i profile są wysyłane do wybranego modelu, co może kosztować. Wyłączenie zatrzymuje automatyczne żądania.
Opóźnienie po pisaniu
Używaj wskazówek współpracujących ekspertów
Wyłącz, aby pominąć te wskazówki w nowych zadaniach.
Dostępne rozszerzenia
Zainstaluj
Odinstaluj
Odinstalować {name}?
Niezgodne
Uprawnienia
Wymagania
Operacja rozszerzenia zakończona.
Konfiguruj
Dodaj własną aplikację
Nazwa aplikacji
Opis aplikacji
Adres HTTPS usługi
Transport
Lokalnie zapisywana jest tylko publiczna konfiguracja, bez połączenia. URL nie może zawierać danych logowania, zapytań ani fragmentów.
Wpisz publiczny adres HTTPS bez danych logowania, zapytań i fragmentów.
Autoryzuj
Rozłącz
Rozłączyć {name}?
Usunąć lokalną konfigurację {name}?
Brak adaptera autoryzacji dla tej aplikacji.
Autoryzuj w oknie dostawcy. Nie wpisuj tu haseł ani tokenów. Po powrocie odśwież stan.
Okno zablokowane. Zezwól na wyskakujące okna i spróbuj ponownie.
Nieoczekiwany adres autoryzacji; przejście zablokowane.
Otwarto autoryzację. Zakończ ją i odśwież stan.
Usługa autoryzacji nie jest skonfigurowana. Konfiguracje lokalne można edytować; nie przeprowadzono autoryzacji zewnętrznej.
Model zweryfikowany
Weryfikacja nieudana
Niezweryfikowano
API dostępne · model niepotwierdzony
Konfiguracja lub klucz uległy zmianie. Zweryfikuj ponownie.
Modele serwera zweryfikuj na stronie Modele i użycie.
Czas weryfikacji
`;

rows["ar"] = `
اضبط اللغة وبيئة العمل.
أدر ملفك العام وحسابك.
راجع الاستخدام الفعلي والخطة.
اضبط السمة والنص والمسافات.
خصص اختصارات لوحة المفاتيح.
اختر الإعدادات الافتراضية للمهام الجديدة.
أدر الذكريات المحفوظة بموافقتك.
فعّل الأدوار وعدّل تعليماتها.
أدر النماذج ونتائج التحقق.
اضبط اختيار الخبراء والإضافات.
راجع الأجهزة المسجلة.
انسخ البيانات المحلية احتياطيًا أو احذفها.
أدر إعدادات التطبيقات وتفويضها.
راجع كلمة المرور وسجل الأمان.
تسجيل حساب
تحديث الملف
تغيير كلمة المرور
تسجيل الدخول عبر مزود
التسجيل عبر مزود
تفعيل الحساب
تعطيل الحساب
الاسم المعروض
البريد الإلكتروني
اسم المستخدم
الحساب
فشلت العملية. حاول مجددًا.
جارٍ التنفيذ…
لا توجد سجلات
يمكن للضيوف عرض البيانات المحلية لهذا الجهاز.
اتصال البيانات
الذكريات المحفوظة
المحتوى المحفوظ بموافقة صريحة فقط. ليس تعلمًا تلقائيًا.
لا توجد ذكريات بعد
سيظهر هنا المحتوى الذي توافق على حفظه.
إضافة ذكرى
محتوى الذكرى
أوافق على حفظ هذا المحتوى في ذاكرة الحساب.
هل تريد حذف هذه الذكرى؟
هل تريد حذف جميع الذكريات؟ لا يمكن التراجع.
مسح جميع الذكريات
تم تحديث الذاكرة.
إجراءات لا يمكن التراجع عنها
تحقق من أثرها على البيانات قبل المتابعة.
البحث عن أدوار
تُطبق التعليمات على المهام اللاحقة ولا تضمن النتائج.
عرض التفاصيل
الإضافات
لا توجد إضافات مثبتة
حالة الإضافات المثبتة فعليًا. الإدراج في الدليل لا يمنح إذن التشغيل.
مفعّل
معطّل
تبديل {name}
تم تحديث حالة الإضافة.
اتصالات التطبيقات
التفويضات المتحقق منها فقط. حفظ الإعدادات لا ينشئ اتصالًا.
لا توجد اتصالات مفوضة
متصل
غير متصل
بانتظار التفويض
خطأ في الاتصال
أجهزة مسجلة على الخادم، وليست حالة اتصال فورية.
آخر سجل
تغيير كلمة المرور
من 10 إلى 128 حرفًا. سيؤدي التغيير إلى إنهاء الجلسات الأخرى.
كلمة المرور الحالية
كلمة المرور الجديدة
تم تحديث كلمة المرور وإنهاء الجلسات الأخرى.
نشاط الأمان
الإجراءات المسجلة فعليًا على الخادم.
الفوترة
خدمة الرصيد غير متصلة. لا تُعرض أرصدة أو مكافآت.
مساحة التخزين المحلية المستخدمة فعليًا في هذا المتصفح.
معاينة النص
مسافات مريحة للتركيز على عملك.
النص والتخطيط
التفاصيل والتفاعلات
القراءة
السلوك
اختر ستة إجراءات سريعة للصفحة الرئيسية.
لم تُضف نماذج بعد
إغلاق المحرر
تم الإعداد
محفوظ محليًا
جارٍ المزامنة…
تمت المزامنة
المزامنة غير متاحة · محفوظ محليًا
إعداد الدور
تفعيل الدور: {name}
هذا الدور معطّل. فعّله أولًا في الإعدادات.
وصف الدور
تعليمات إضافية
تُستبعد الأدوار المعطلة من المطابقة والاختيار. تنطبق التعليمات على المهام الجديدة دون الحالية.
تفضيلات المساعد
مطابقة الخبراء تلقائيًا
عند التفعيل تُرسل المسودات ومقتطفات المرفقات المقروءة وملفات الأدوار إلى النموذج المختار وقد تُفرض رسوم. التعطيل يوقف الطلبات التلقائية.
الانتظار بعد الكتابة
استخدام إرشادات الخبراء المتعاونين
عطّل لاستبعاد هذه الإرشادات من المهام الجديدة.
الإضافات المتاحة
تثبيت
إلغاء التثبيت
هل تريد إلغاء تثبيت {name}؟
غير متوافق
الأذونات
المتطلبات
اكتملت عملية الإضافة.
إعداد
إضافة تطبيق مخصص
اسم التطبيق
وصف التطبيق
عنوان خدمة HTTPS
طريقة النقل
تُحفظ الإعدادات العامة محليًا فقط دون إنشاء اتصال. يجب ألا يتضمن العنوان بيانات اعتماد أو استعلامًا أو جزءًا.
أدخل عنوان HTTPS عامًا دون بيانات اعتماد أو استعلام أو جزء.
تفويض
قطع الاتصال
هل تريد قطع اتصال {name}؟
هل تريد حذف الإعدادات المحلية لتطبيق {name}؟
لا يتوفر محول تفويض لهذا التطبيق.
فوّض من نافذة المزود. لا تُدخل كلمات مرور أو رموزًا هنا. حدّث الحالة عند العودة.
حُظرت النافذة. اسمح بالنوافذ المنبثقة وحاول مجددًا.
عنوان تفويض غير متوقع؛ تم حظر الانتقال.
فُتحت نافذة التفويض. أكمل العملية وحدّث الحالة.
خدمة التفويض غير مهيأة. يمكن إدارة الإعدادات المحلية؛ لم يُنفّذ أي تفويض خارجي.
تم التحقق من النموذج
فشل التحقق
لم يتم التحقق
الواجهة متاحة · النموذج غير مؤكد
تغيرت الإعدادات أو المفتاح. تحقق مجددًا.
تحقق من نماذج الخادم في صفحة النماذج والاستخدام.
وقت التحقق
`;

rows["fa"] = `
زبان و محیط کار را تنظیم کنید.
نمایه عمومی و حساب خود را مدیریت کنید.
مصرف واقعی و طرح خود را ببینید.
پوسته، متن و فاصله‌ها را تنظیم کنید.
میانبرهای صفحه‌کلید را شخصی‌سازی کنید.
پیش‌فرض کارهای جدید را انتخاب کنید.
خاطرات ذخیره‌شده با رضایت را مدیریت کنید.
نقش‌ها را فعال و دستورالعمل‌ها را ویرایش کنید.
مدل‌ها و نتایج بررسی را مدیریت کنید.
تطبیق متخصص و افزونه‌ها را تنظیم کنید.
دستگاه‌های ثبت‌شده را ببینید.
از داده‌های محلی پشتیبان بگیرید یا آن‌ها را حذف کنید.
تنظیمات و مجوز برنامه‌ها را مدیریت کنید.
گذرواژه و سابقه امنیتی را بررسی کنید.
ثبت حساب
به‌روزرسانی نمایه
تغییر گذرواژه
ورود با ارائه‌دهنده
ثبت‌نام با ارائه‌دهنده
فعال‌سازی حساب
غیرفعال‌سازی حساب
نام نمایشی
ایمیل
نام کاربری
حساب
عملیات ناموفق بود. دوباره تلاش کنید.
در حال پردازش…
رکوردی نیست
مهمان‌ها می‌توانند داده‌های محلی این دستگاه را ببینند.
اتصال داده
خاطرات ذخیره‌شده
فقط محتوای ذخیره‌شده با رضایت صریح. یادگیری خودکار نیست.
هنوز خاطره‌ای نیست
محتوایی که با ذخیره آن موافقت کنید اینجا نمایش داده می‌شود.
افزودن خاطره
محتوای خاطره
با ذخیره این محتوا در حافظه حساب موافقم.
این خاطره حذف شود؟
همه خاطرات حذف شوند؟ این کار برگشت‌پذیر نیست.
پاک کردن همه خاطرات
حافظه به‌روز شد.
عملیات برگشت‌ناپذیر
پیش از ادامه، اثر آن بر داده‌ها را بررسی کنید.
جستجوی نقش‌ها
دستورالعمل‌ها برای کارهای بعدی هستند و نتیجه را تضمین نمی‌کنند.
نمایش جزئیات
افزونه‌ها
افزونه‌ای نصب نشده است
وضعیت افزونه‌های واقعاً نصب‌شده. حضور در فهرست مجوز اجرا نیست.
فعال
غیرفعال
تغییر وضعیت {name}
وضعیت افزونه به‌روز شد.
اتصال برنامه‌ها
فقط مجوزهای تأییدشده. ذخیره تنظیمات اتصال ایجاد نمی‌کند.
اتصال مجاز وجود ندارد
متصل
قطع‌شده
در انتظار مجوز
خطای اتصال
دستگاه‌های ثبت‌شده در سرور، نه وضعیت برخط لحظه‌ای.
آخرین رکورد
تغییر گذرواژه
۱۰ تا ۱۲۸ نویسه. تغییر، نشست‌های دیگر را می‌بندد.
گذرواژه فعلی
گذرواژه جدید
گذرواژه به‌روز و نشست‌های دیگر بسته شدند.
فعالیت امنیتی
عملیات واقعاً ثبت‌شده در سرور.
صورتحساب
سرویس اعتبار متصل نیست. موجودی یا پاداش نمایش داده نمی‌شود.
فضای محلی واقعاً مصرف‌شده توسط این مرورگر.
پیش‌نمایش متن
فاصله‌های راحت برای تمرکز بر کار.
متن و چیدمان
جزئیات و تعامل‌ها
خواندن
رفتار
شش اقدام سریع صفحه اصلی را انتخاب کنید.
هنوز مدلی اضافه نشده است
بستن ویرایشگر
پیکربندی‌شده
ذخیره‌شده در دستگاه
در حال همگام‌سازی…
همگام‌شده
همگام‌سازی در دسترس نیست · ذخیره محلی
تنظیم نقش
فعال‌سازی نقش: {name}
این نقش غیرفعال است. ابتدا آن را در تنظیمات فعال کنید.
شرح نقش
دستورالعمل‌های تکمیلی
نقش‌های غیرفعال از تطبیق و انتخاب حذف می‌شوند. دستورالعمل‌ها فقط بر کارهای جدید اعمال می‌شوند، نه کارهای موجود.
ترجیحات دستیار
تطبیق خودکار متخصص
با فعال‌سازی، پیش‌نویس‌ها، بخش‌های خوانای پیوست‌ها و نمایه‌ها به مدل انتخابی فرستاده می‌شوند و ممکن است هزینه داشته باشد. غیرفعال‌سازی درخواست‌های خودکار را متوقف می‌کند.
تأخیر پس از تایپ
استفاده از راهنمای متخصصان همکار
برای حذف این راهنما از کارهای جدید غیرفعال کنید.
افزونه‌های موجود
نصب
حذف نصب
نصب {name} حذف شود؟
ناسازگار
مجوزها
پیش‌نیازها
عملیات افزونه تمام شد.
پیکربندی
افزودن برنامه سفارشی
نام برنامه
شرح برنامه
نشانی HTTPS سرویس
روش انتقال
فقط تنظیمات عمومی محلی ذخیره می‌شوند؛ اتصالی ایجاد نمی‌شود. نشانی نباید شامل اطلاعات ورود، پرس‌وجو یا بخش باشد.
نشانی عمومی HTTPS بدون اطلاعات ورود، پرس‌وجو یا بخش وارد کنید.
اعطای مجوز
قطع اتصال
اتصال {name} قطع شود؟
تنظیمات محلی {name} حذف شوند؟
برای این برنامه مبدل مجوز موجود نیست.
در پنجره ارائه‌دهنده مجوز دهید. اینجا گذرواژه یا توکن وارد نکنید. پس از بازگشت وضعیت را تازه کنید.
پنجره مسدود شد. پنجره‌های بازشو را مجاز کنید و دوباره تلاش کنید.
نشانی غیرمنتظره مجوز؛ انتقال مسدود شد.
پنجره مجوز باز شد. پس از تکمیل وضعیت را تازه کنید.
سرویس مجوز پیکربندی نشده است. تنظیمات محلی قابل مدیریت‌اند؛ هیچ مجوز خارجی صادر نشده است.
مدل تأیید شد
بررسی ناموفق
بررسی‌نشده
رابط در دسترس · مدل تأیید نشده
تنظیمات یا کلید تغییر کرده است. دوباره بررسی کنید.
مدل‌های سرور را در صفحه مدل‌ها و مصرف بررسی کنید.
زمان بررسی
`;

rows["th"] = `
ตั้งค่าภาษาและสภาพแวดล้อมการทำงาน
จัดการโปรไฟล์สาธารณะและบัญชี
ดูการใช้งานจริงและแผนบริการ
ปรับธีม ข้อความ และระยะห่าง
ปรับแต่งแป้นพิมพ์ลัด
เลือกค่าเริ่มต้นสำหรับงานใหม่
จัดการความทรงจำที่บันทึกโดยได้รับความยินยอม
เปิดใช้บทบาทและแก้ไขคำแนะนำ
จัดการโมเดลและผลการตรวจสอบ
ตั้งค่าการจับคู่ผู้เชี่ยวชาญและส่วนขยาย
ดูอุปกรณ์ที่ลงทะเบียนไว้
สำรองหรือลบข้อมูลในเครื่อง
จัดการการตั้งค่าและการอนุญาตแอป
ตรวจสอบรหัสผ่านและประวัติความปลอดภัย
ลงทะเบียนบัญชี
อัปเดตโปรไฟล์
เปลี่ยนรหัสผ่าน
เข้าสู่ระบบผ่านผู้ให้บริการ
ลงทะเบียนผ่านผู้ให้บริการ
เปิดใช้บัญชี
ปิดใช้บัญชี
ชื่อที่แสดง
อีเมล
ชื่อผู้ใช้
บัญชี
ดำเนินการไม่สำเร็จ โปรดลองอีกครั้ง
กำลังดำเนินการ…
ไม่มีรายการ
ผู้เยี่ยมชมดูข้อมูลในอุปกรณ์นี้ได้
การเชื่อมต่อข้อมูล
ความทรงจำที่บันทึก
เฉพาะเนื้อหาที่บันทึกโดยยินยอมอย่างชัดเจน ไม่ใช่การเรียนรู้อัตโนมัติ
ยังไม่มีความทรงจำ
เนื้อหาที่คุณยินยอมให้บันทึกจะแสดงที่นี่
เพิ่มความทรงจำ
เนื้อหาความทรงจำ
ฉันยินยอมให้บันทึกเนื้อหานี้ในความทรงจำของบัญชี
ลบความทรงจำนี้หรือไม่?
ลบความทรงจำทั้งหมดหรือไม่? การกระทำนี้ย้อนกลับไม่ได้
ล้างความทรงจำทั้งหมด
อัปเดตความทรงจำแล้ว
การกระทำที่ย้อนกลับไม่ได้
ตรวจสอบผลกระทบต่อข้อมูลก่อนดำเนินการ
ค้นหาบทบาท
คำแนะนำใช้กับงานถัดไป แต่ไม่รับประกันผลลัพธ์
ดูรายละเอียด
ส่วนขยาย
ยังไม่มีส่วนขยายที่ติดตั้ง
สถานะของส่วนขยายที่ติดตั้งจริง การอยู่ในแค็ตตาล็อกไม่ได้หมายถึงได้รับอนุญาตให้ทำงาน
เปิดใช้
ปิดใช้
สลับ {name}
อัปเดตสถานะส่วนขยายแล้ว
การเชื่อมต่อแอป
เฉพาะการอนุญาตที่ตรวจสอบแล้ว การบันทึกการตั้งค่าไม่ใช่การเชื่อมต่อ
ยังไม่มีการเชื่อมต่อที่ได้รับอนุญาต
เชื่อมต่อแล้ว
ไม่ได้เชื่อมต่อ
รอการอนุญาต
การเชื่อมต่อผิดพลาด
ข้อมูลอุปกรณ์ที่บันทึกบนเซิร์ฟเวอร์ ไม่ใช่สถานะออนไลน์แบบเรียลไทม์
บันทึกล่าสุด
เปลี่ยนรหัสผ่าน
10–128 อักขระ การเปลี่ยนจะสิ้นสุดเซสชันอื่น
รหัสผ่านปัจจุบัน
รหัสผ่านใหม่
อัปเดตรหัสผ่านและสิ้นสุดเซสชันอื่นแล้ว
กิจกรรมความปลอดภัย
การกระทำที่เซิร์ฟเวอร์บันทึกจริง
การเรียกเก็บเงิน
ยังไม่เชื่อมต่อบริการเครดิต จึงไม่แสดงยอดหรือรางวัล
พื้นที่จัดเก็บในเครื่องที่เบราว์เซอร์นี้ใช้จริง
ตัวอย่างข้อความ
ระยะห่างสบายตาช่วยให้มีสมาธิกับงาน
ข้อความและเค้าโครง
รายละเอียดและการโต้ตอบ
การอ่าน
พฤติกรรม
เลือกการทำงานด่วนหกรายการสำหรับหน้าหลัก
ยังไม่ได้เพิ่มโมเดล
ปิดตัวแก้ไข
ตั้งค่าแล้ว
บันทึกในเครื่องแล้ว
กำลังซิงค์…
ซิงค์แล้ว
ซิงค์ไม่ได้ · บันทึกในเครื่องแล้ว
การตั้งค่าบทบาท
เปิดใช้บทบาท: {name}
บทบาทนี้ปิดอยู่ โปรดเปิดใช้ในการตั้งค่าก่อน
คำอธิบายบทบาท
คำแนะนำเพิ่มเติม
บทบาทที่ปิดจะไม่เข้าร่วมการจับคู่หรือการเลือก คำแนะนำใช้กับงานใหม่ ไม่เปลี่ยนงานเดิม
การตั้งค่าผู้ช่วย
จับคู่ผู้เชี่ยวชาญอัตโนมัติ
เมื่อเปิด ระบบจะส่งร่าง ข้อความแนบที่อ่านได้ และข้อมูลบทบาทไปยังโมเดลที่เลือก ซึ่งอาจมีค่าใช้จ่าย ปิดเพื่อหยุดคำขออัตโนมัติ
เวลารอหลังหยุดพิมพ์
ใช้คำแนะนำจากผู้เชี่ยวชาญร่วมงาน
ปิดเพื่อไม่เพิ่มคำแนะนำเหล่านี้ในงานใหม่
ส่วนขยายที่พร้อมติดตั้ง
ติดตั้ง
ถอนการติดตั้ง
ถอนการติดตั้ง {name} หรือไม่?
ไม่รองรับ
สิทธิ์
ข้อกำหนด
ดำเนินการส่วนขยายเสร็จแล้ว
ตั้งค่า
เพิ่มแอปที่กำหนดเอง
ชื่อแอป
คำอธิบายแอป
ที่อยู่บริการ HTTPS
วิธีส่งข้อมูล
บันทึกเฉพาะการตั้งค่าสาธารณะในเครื่อง โดยไม่เชื่อมต่อ URL ต้องไม่มีข้อมูลรับรอง พารามิเตอร์ หรือส่วนย่อย
ป้อน URL HTTPS สาธารณะที่ไม่มีข้อมูลรับรอง พารามิเตอร์ หรือส่วนย่อย
อนุญาต
ตัดการเชื่อมต่อ
ตัดการเชื่อมต่อ {name} หรือไม่?
ลบการตั้งค่าในเครื่องของ {name} หรือไม่?
ยังไม่มีตัวเชื่อมการอนุญาตสำหรับแอปนี้
อนุญาตในหน้าต่างผู้ให้บริการ อย่าป้อนรหัสผ่านหรือโทเคนที่นี่ เมื่อกลับมาให้รีเฟรชสถานะ
หน้าต่างถูกบล็อก อนุญาตป๊อปอัปแล้วลองอีกครั้ง
ที่อยู่อนุญาตไม่ตรงตามคาด จึงบล็อกการนำทาง
เปิดหน้าต่างอนุญาตแล้ว ดำเนินการให้เสร็จและรีเฟรชสถานะ
ยังไม่ตั้งค่าบริการอนุญาต จัดการการตั้งค่าในเครื่องได้ แต่ยังไม่มีการอนุญาตภายนอก
ตรวจสอบโมเดลแล้ว
ตรวจสอบไม่สำเร็จ
ยังไม่ตรวจสอบ
เข้าถึง API ได้ · ยังไม่ยืนยันโมเดล
การตั้งค่าหรือคีย์เปลี่ยนไป โปรดตรวจสอบอีกครั้ง
ตรวจสอบโมเดลที่เซิร์ฟเวอร์จัดการในหน้าโมเดลและการใช้งาน
เวลาที่ตรวจสอบ
`;

export const settingsDesignLocales: Partial<
  Record<Locale, Record<string, string>>
> = {};
function registerRows() {
  for (const [locale, raw] of Object.entries(rows)) {
    const values = raw
      .trim()
      .split("\n")
      .map((value) => value.trim());
    if (values.length !== keys.length)
      throw new Error(
        `settings translations ${locale}: ${values.length}/${keys.length}`,
      );
    settingsDesignLocales[locale as Locale] = Object.fromEntries(
      keys.map((key, index) => [key, values[index]]),
    );
  }
}

settingsDesignLocales["zh-TW"] = {
  "intro.general": "讓工作空間更符合你的使用習慣。",
  "intro.profile": "管理個人資料與賬號資訊。",
  "intro.plan": "瞭解當前版本與真實使用情況。",
  "intro.appearance": "用熟悉的配色、字形與佈局，專注創作。",
  "intro.shortcuts": "少一點點選，讓靈感更流暢。",
  "intro.personalization": "把常用工作方式設為預設。",
  "intro.memory": "由你決定哪些資訊值得被記住。",
  "intro.agents": "按任務選擇專業角色，檢視職責與邊界。",
  "intro.models": "管理模型與服務商，安全配置連線。",
  "intro.assistant": "檢視已安裝的助理擴充套件與執行能力。",
  "intro.devices": "檢視當前身份與已記錄裝置，遷移你的設定。",
  "intro.data": "看清資料去向，備份與清理都由你掌控。",
  "intro.apps": "核驗外部應用狀態，管理授權與連線。",
  "intro.security": "管理密碼並檢視真實賬號活動。",
  "audit.account.register": "建立賬號",
  "audit.account.profile.update": "更新賬號資料",
  "audit.account.password.change": "修改登入密碼",
  "audit.account.oauth.login": "第三方賬號登入",
  "audit.account.oauth.register": "第三方賬號註冊",
  "audit.account.enable": "恢復賬號",
  "audit.account.disable": "停用賬號",
  defaultModel: "預設使用",
  identity: "賬號資料",
  displayName: "顯示名稱",
  email: "郵箱",
  username: "使用者名稱",
  guest: "遊客會話",
  account: "賬號",
  edit: "編輯資料",
  save: "儲存更改",
  cancel: "取消",
  saved: "更改已儲存。",
  loading: "正在讀取…",
  retry: "重新載入",
  failure: "無法讀取資料，請檢查後臺連線後重試。",
  busy: "處理中…",
  empty: "暫無記錄",
  accountData: "賬號與資料",
  accountHelp: "更多賬號資料與匯出操作可在個人主頁中管理。",
  guestHelp: "遊客身份不能修改賬號資料或密碼，請先在賬號頁面登入。",
  connection: "後臺連線狀態",
  memoryList: "已儲存的記憶",
  memoryHelp: "只展示你明確同意儲存的資訊；記憶不是自動學習或訓練開關。",
  memoryEmpty: "還沒有長期記憶",
  memoryEmptyHelp: "可主動新增偏好或工作背景，儲存前需要你的同意。",
  memoryAdd: "新增記憶",
  memoryContent: "記憶內容",
  memoryConsent: "我同意將這段內容儲存為長期記憶",
  remove: "刪除",
  memoryRemoveConfirm: "確定刪除這條記憶？此操作不可撤銷。",
  memoryClearConfirm: "確定清空全部長期記憶？此操作不可撤銷。",
  memoryClear: "清空全部記憶",
  memoryUpdated: "記憶已更新。",
  danger: "危險操作",
  dangerHelp: "刪除後無法恢復，請先確認是否需要備份。",
  searchExperts: "搜尋專業角色",
  expertHelp: "角色提供職責與任務方法，實際執行仍依賴可用模型和工具。",
  expertDetails: "檢視職責",
  expertManage: "管理專家",
  plugins: "已安裝擴充套件",
  pluginsEmpty: "尚未安裝助理擴充套件",
  pluginsHelp: "在擴充套件管理中檢視技能、所需許可權與安裝條件。",
  pluginsManage: "管理助理擴充套件",
  enabled: "已啟用",
  disabled: "已停用",
  pluginToggle: "切換擴充套件：{name}",
  pluginUpdated: "擴充套件狀態已更新。",
  connections: "應用連線",
  connectionsHelp: "狀態來自當前後臺查詢，不根據本地快取推斷授權有效性。",
  connectionsEmpty: "暫無應用連線記錄",
  connectionsManage: "管理聯結器",
  "status.connected": "已連線",
  "status.disconnected": "未連線",
  "status.pending": "等待授權",
  "status.error": "連線異常",
  devices: "裝置記錄",
  devicesHelp:
    "這是賬號記錄的訪問裝置，不代表裝置當前線上，也不是遠端同步狀態。",
  lastSeen: "最近訪問",
  password: "修改密碼",
  passwordHelp: "使用當前密碼驗證身份，新密碼需 10–128 位。",
  currentPassword: "當前密碼",
  newPassword: "新密碼",
  passwordUpdated: "密碼已更新。",
  activity: "近期賬號活動",
  activityHelp: "來自服務端的審計記錄，不包含密碼或記憶正文。",
  notConnected: "未接入",
  billing: "本機免費版",
  billingHelp: "訂閱、積分與支付服務尚未接入，不會產生訂閱或扣費。",
  credits: "積分餘額",
  creditsHelp: "未連線積分服務，不展示示例餘額、到期日或虛構用量。",
  planInfo: "瞭解版本與服務狀態",
  storage: "瀏覽器儲存概覽",
  storageHelp:
    "僅統計當前瀏覽器可讀取的本地資料，不包含服務端資料庫或裝置總容量。",
  fontPreview: "閱讀預覽",
  fontSample: "每一個靈感，都值得清晰表達。",
  readingLayout: "閱讀與佈局",
  detailsLayout: "細節與互動",
  reading: "語言與閱讀",
  behavior: "連結行為",
  sceneHelp: "按順序配置首頁的六個快捷入口，選項不會重複。",
  advanced: "高階選項",
  modelEmpty: "還沒有自定義模型",
  modelEmptyHelp: "新增服務商、模型標識和金鑰。儲存配置不會自動證明連線可用。",
  closeEditor: "關閉模型編輯器",
  provider: "服務商",
  configured: "已配置 · 未核驗",
  "sync.idle": "偏好儲存在當前瀏覽器",
  "sync.syncing": "正在同步偏好…",
  "sync.synced": "偏好已同步至當前賬號 / 會話",
  "sync.offline": "偏好僅在本地儲存 · 同步失敗",
  roleConfiguration: "角色配置",
  roleEnabled: "啟用角色：{name}",
  roleDisabled: "該角色已停用，請先在設定中啟用。",
  roleDescription: "職責說明",
  roleInstructions: "補充工作規範",
  roleScope:
    "停用後不參與自動匹配或手動候選。儲存的規範會用於後續任務，不改寫已有任務。",
  assistantPreferences: "助理偏好",
  autoMatch: "自動匹配專家",
  autoMatchHelp:
    "開啟後會將草稿、可讀附件片段和角色資料傳送給所選模型，可能產生費用。關閉後停止自動請求。",
  matchDelay: "停止輸入後的等待時間",
  collaborators: "使用協作專家規範",
  collaboratorsHelp: "關閉後不將協作角色規範加入後續任務。",
  availablePlugins: "可安裝擴充套件",
  install: "安裝",
  uninstall: "解除安裝",
  uninstallConfirm: "確定解除安裝「{name}」？",
  incompatible: "不相容",
  permissions: "許可權",
  requirements: "執行要求",
  lifecycleUpdated: "擴充套件操作已完成。",
  configure: "配置",
  addConnector: "新增自定義應用",
  connectorName: "應用名稱",
  connectorDescription: "應用說明",
  connectorEndpoint: "HTTPS 服務地址",
  connectorTransport: "傳輸協議",
  connectorLocalHelp:
    "僅儲存本地公開配置，不會自動建立連線。地址不得包含憑據、查詢引數或片段。",
  invalidEndpoint: "請輸入不含憑據、查詢引數或片段的 HTTPS 公網地址。",
  authorize: "授權連線",
  disconnect: "斷開連線",
  disconnectConfirm: "確定斷開「{name}」的授權？",
  deleteConnectorConfirm: "確定刪除「{name}」的本地配置？",
  unsupportedConnector: "該應用尚無授權介面卡，不能在此建立連線。",
  oauthHelp:
    "授權在服務商視窗完成；請勿在此填寫第三方密碼或令牌。返回後重新整理核驗狀態。",
  popupBlocked: "瀏覽器阻止了授權視窗，請允許彈窗後重試。",
  unsafeAuthorization: "服務端返回了非預期的授權地址，已阻止跳轉。",
  authorizationStarted: "已開啟授權視窗，請完成授權後重新整理狀態。",
  serviceUnavailable: "授權服務未配置；本地配置仍可管理，未進行外部授權。",
  testConnection: "測試連線",
  connectionChecking: "正在核驗…",
  connectionVerified: "模型已核驗",
  connectionFailed: "核驗失敗",
  connectionUnverified: "未核驗",
  connectionReachable: "介面可達 · 模型未確認",
  connectionChanged: "配置或金鑰已變化，請重新核驗。",
  keyMissing: "請先在編輯器中填寫 API Key。",
  serverProbeHelp:
    "服務端預設模型不在此傳送使用者金鑰，請使用模型與用量頁核驗。",
  verifiedAt: "核驗時間",
};

registerRows();

Object.assign(settingsDesignLocales["ja"]!, {
  advanced: "高度な設定",
  provider: "提供元",
  testConnection: "接続テスト",
  connectionChecking: "検証中…",
  keyMissing: "先にエディターでAPIキーを入力してください。",
  publicPreferencesHelp:
    "公開設定はアカウントと同期される場合があります。パスワードやキーを入力しないでください。",
});

Object.assign(settingsDesignLocales["ko"]!, {
  advanced: "고급 설정",
  provider: "제공업체",
  testConnection: "연결 테스트",
  connectionChecking: "검증 중…",
  keyMissing: "먼저 편집기에서 API 키를 입력하세요.",
  publicPreferencesHelp:
    "공개 설정은 계정과 동기화될 수 있습니다. 비밀번호나 키를 입력하지 마세요.",
});

Object.assign(settingsDesignLocales["fr"]!, {
  advanced: "Paramètres avancés",
  provider: "Fournisseur",
  testConnection: "Tester la connexion",
  connectionChecking: "Vérification…",
  keyMissing: "Saisissez une clé API dans l’éditeur.",
  publicPreferencesHelp:
    "Ces paramètres publics peuvent être synchronisés avec le compte. Ne saisissez aucun mot de passe ni clé.",
});

Object.assign(settingsDesignLocales["de"]!, {
  advanced: "Erweiterte Einstellungen",
  provider: "Anbieter",
  testConnection: "Verbindung testen",
  connectionChecking: "Wird geprüft…",
  keyMissing: "Zuerst einen API-Schlüssel im Editor eingeben.",
  publicPreferencesHelp:
    "Diese öffentlichen Einstellungen können mit dem Konto synchronisiert werden. Keine Passwörter oder Schlüssel eingeben.",
});

Object.assign(settingsDesignLocales["es-ES"]!, {
  advanced: "Configuración avanzada",
  provider: "Proveedor",
  testConnection: "Probar conexión",
  connectionChecking: "Verificando…",
  keyMissing: "Introduce una clave API en el editor.",
  publicPreferencesHelp:
    "Estos ajustes públicos pueden sincronizarse con la cuenta. No introduzcas contraseñas ni claves.",
});

Object.assign(settingsDesignLocales["pt-BR"]!, {
  advanced: "Configurações avançadas",
  provider: "Provedor",
  testConnection: "Testar conexão",
  connectionChecking: "Verificando…",
  keyMissing: "Informe uma chave API no editor.",
  publicPreferencesHelp:
    "Essas configurações públicas podem ser sincronizadas com a conta. Não informe senhas nem chaves.",
});

Object.assign(settingsDesignLocales["it"]!, {
  advanced: "Impostazioni avanzate",
  provider: "Fornitore",
  testConnection: "Verifica connessione",
  connectionChecking: "Verifica…",
  keyMissing: "Inserisci prima una chiave API nell’editor.",
  publicPreferencesHelp:
    "Queste impostazioni pubbliche possono essere sincronizzate con l’account. Non inserire password o chiavi.",
});

Object.assign(settingsDesignLocales["id"]!, {
  advanced: "Pengaturan lanjutan",
  provider: "Penyedia",
  testConnection: "Uji koneksi",
  connectionChecking: "Memverifikasi…",
  keyMissing: "Masukkan kunci API di editor terlebih dahulu.",
  publicPreferencesHelp:
    "Pengaturan publik ini dapat disinkronkan dengan akun. Jangan masukkan kata sandi atau kunci.",
});

Object.assign(settingsDesignLocales["hu"]!, {
  advanced: "Speciális beállítások",
  provider: "Szolgáltató",
  testConnection: "Kapcsolat tesztelése",
  connectionChecking: "Ellenőrzés…",
  keyMissing: "Először adja meg az API-kulcsot a szerkesztőben.",
  publicPreferencesHelp:
    "Ezek a nyilvános beállítások szinkronizálhatók a fiókkal. Ne adjon meg jelszót vagy kulcsot.",
});

Object.assign(settingsDesignLocales["pl"]!, {
  advanced: "Ustawienia zaawansowane",
  provider: "Dostawca",
  testConnection: "Testuj połączenie",
  connectionChecking: "Weryfikacja…",
  keyMissing: "Najpierw wpisz klucz API w edytorze.",
  publicPreferencesHelp:
    "Te publiczne ustawienia mogą być synchronizowane z kontem. Nie wpisuj haseł ani kluczy.",
});

Object.assign(settingsDesignLocales["ru"]!, {
  advanced: "Расширенные настройки",
  provider: "Провайдер",
  testConnection: "Проверить соединение",
  connectionChecking: "Проверка…",
  keyMissing: "Сначала введите ключ API в редакторе.",
  publicPreferencesHelp:
    "Эти открытые настройки могут синхронизироваться с аккаунтом. Не вводите пароли и ключи.",
});

Object.assign(settingsDesignLocales["uk"]!, {
  advanced: "Розширені налаштування",
  provider: "Провайдер",
  testConnection: "Перевірити з’єднання",
  connectionChecking: "Перевірка…",
  keyMissing: "Спочатку введіть ключ API в редакторі.",
  publicPreferencesHelp:
    "Ці відкриті налаштування можуть синхронізуватися з обліковим записом. Не вводьте паролі та ключі.",
});

Object.assign(settingsDesignLocales["ar"]!, {
  advanced: "إعدادات متقدمة",
  provider: "المزود",
  testConnection: "اختبار الاتصال",
  connectionChecking: "جارٍ التحقق…",
  keyMissing: "أدخل مفتاح API في المحرر أولًا.",
  publicPreferencesHelp:
    "قد تتم مزامنة هذه الإعدادات العامة مع الحساب. لا تُدخل كلمات مرور أو مفاتيح.",
});

Object.assign(settingsDesignLocales["fa"]!, {
  advanced: "تنظیمات پیشرفته",
  provider: "ارائه‌دهنده",
  testConnection: "آزمایش اتصال",
  connectionChecking: "در حال بررسی…",
  keyMissing: "ابتدا کلید API را در ویرایشگر وارد کنید.",
  publicPreferencesHelp:
    "این تنظیمات عمومی ممکن است با حساب همگام شوند. گذرواژه یا کلید وارد نکنید.",
});

Object.assign(settingsDesignLocales["zh-TW"]!, {
  advanced: "進階設定",
  provider: "供應商",
  testConnection: "測試連線",
  connectionChecking: "正在驗證…",
  keyMissing: "請先在編輯器中填寫 API Key。",
  publicPreferencesHelp: "這些公開設定可能同步至帳號，請勿填寫密碼或金鑰。",
});

Object.assign(settingsDesignLocales["th"]!, {
  advanced: "การตั้งค่าขั้นสูง",
  provider: "ผู้ให้บริการ",
  testConnection: "ทดสอบการเชื่อมต่อ",
  connectionChecking: "กำลังตรวจสอบ…",
  keyMissing: "ป้อนคีย์ API ในตัวแก้ไขก่อน",
  publicPreferencesHelp:
    "การตั้งค่าสาธารณะเหล่านี้อาจซิงค์กับบัญชี อย่าป้อนรหัสผ่านหรือคีย์",
});

Object.assign(settingsDesignLocales["tr"]!, {
  advanced: "Gelişmiş ayarlar",
  provider: "Sağlayıcı",
  testConnection: "Bağlantıyı test et",
  connectionChecking: "Doğrulanıyor…",
  keyMissing: "Önce düzenleyicide bir API anahtarı girin.",
  publicPreferencesHelp:
    "Bu açık ayarlar hesabınızla eşitlenebilir. Parola veya anahtar girmeyin.",
});

// Explicit feedback for the bounded public configuration store.
for (const [locale, roleLimit] of Object.entries({
  ja: "役割の設定は100件までです。不要な設定を先に削除してください。",
  ko: "역할 설정은 최대 100개입니다. 사용하지 않는 설정을 먼저 삭제하세요.",
  "zh-TW": "最多設定 100 個角色，請先移除不再使用的角色設定。",
  id: "Maksimal 100 konfigurasi peran. Hapus konfigurasi yang tidak digunakan dahulu.",
  de: "Maximal 100 Rollenkonfigurationen. Zuerst nicht verwendete Konfigurationen entfernen.",
  "es-ES":
    "Se admiten hasta 100 configuraciones de roles. Elimina primero las que no uses.",
  "pt-BR":
    "São permitidas até 100 configurações de funções. Remova as que não usa primeiro.",
  fr: "Maximum 100 configurations de rôles. Supprimez d’abord celles qui sont inutilisées.",
  it: "Sono consentite 100 configurazioni di ruolo. Elimina prima quelle inutilizzate.",
  pl: "Można skonfigurować 100 ról. Najpierw usuń nieużywane konfiguracje.",
  ru: "Можно сохранить до 100 настроек ролей. Сначала удалите неиспользуемые.",
  ar: "الحد الأقصى 100 إعداد دور. احذف الإعدادات غير المستخدمة أولًا.",
  fa: "حداکثر ۱۰۰ تنظیم نقش مجاز است. ابتدا تنظیمات بدون استفاده را حذف کنید.",
  hu: "Legfeljebb 100 szerepbeállítás menthető. Először törölje a nem használtakat.",
  th: "ตั้งค่าบทบาทได้สูงสุด 100 รายการ โปรดลบการตั้งค่าที่ไม่ใช้ก่อน",
  tr: "En fazla 100 rol yapılandırması desteklenir. Önce kullanılmayanları kaldırın.",
  uk: "Можна зберегти до 100 налаштувань ролей. Спочатку видаліть невикористані.",
}))
  settingsDesignLocales[locale as Locale]!.roleLimit = roleLimit;
