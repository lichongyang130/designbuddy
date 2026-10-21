import { Suspense, lazy } from "react";
import { translate } from "../../../frontend/workspace/i18n";
import { WorkBuddySidebar } from "./components/WorkBuddySidebar";
import { HomeCommandPalette } from "./components/HomeCommandPalette";
import { useAppDocumentPreferences } from "./features/shell/useAppDocumentPreferences";
import { HomeComposerSection } from "./features/home/HomeComposerSection";
import {
  PERMISSION_HINTS,
  useHomeComposerController,
} from "./features/home/useHomeComposerController";
import { renderWorkspaceRoute } from "./routes/WorkspaceRouteSwitch";
import "./styles.css";
import "./home-workspace.css";
import "./home-reference.css";
import "./home-layout.css";
import "./home-plugins.css";
import "./home-launcher.css";
import "./command-palette.css";
import "./components/auth.css";

const ScenePreview = lazy(() =>
  import("./components/ScenePreview").then((module) => ({ default: module.ScenePreview })),
);

export default function App() {
  const controller = useHomeComposerController();
  const { locale } = useAppDocumentPreferences(controller.busy);
  const t = (key: string, params?: Record<string, string | number>) =>
    translate(locale, key, params);

  const activeRoute = renderWorkspaceRoute({
    currentPath: controller.currentPath,
    publicRoute: controller.publicRoute,
    identity: controller.identity,
    identityFailed: controller.identityFailed,
    onRetryIdentity: controller.retryIdentity,
  });
  if (activeRoute !== null) return <>{activeRoute}</>;

  return (
    <div className="workbuddy-app">
      <WorkBuddySidebar
        active="home"
        projectCount={controller.projects.length}
        workspaceCount={controller.workspaceCount}
        assetCount={controller.assetCount}
        go={controller.go}
        setNotice={controller.setNotice}
      />

      <HomeComposerSection
        t={t}
        composerRef={controller.composerRef}
        fileInputRef={controller.fileInputRef}
        folderInputRef={controller.folderInputRef}
        modelMenuRef={controller.modelMenuRef}
        prompt={controller.prompt}
        setPrompt={controller.setPrompt}
        notice={controller.notice}
        setNotice={controller.setNotice}
        attachments={controller.attachments}
        setAttachments={controller.setAttachments}
        mode={controller.mode}
        setMode={controller.setMode}
        selectedExpert={controller.selectedExpert}
        setSelectedExpert={controller.setSelectedExpert}
        selectedSkill={controller.selectedSkill}
        setSelectedSkill={controller.setSelectedSkill}
        expertMatch={controller.expertMatch}
        model={controller.model}
        setModel={controller.setModel}
        modelOptions={controller.modelOptions}
        modelMenuOpen={controller.modelMenuOpen}
        setModelMenuOpen={controller.setModelMenuOpen}
        maxMode={controller.maxMode}
        setMaxMode={controller.setMaxMode}
        thinkingMode={controller.thinkingMode}
        setThinkingMode={controller.setThinkingMode}
        busy={controller.busy}
        workspace={controller.workspace}
        workspaceDisplay={controller.workspaceDisplay}
        workspaceStorageHint={controller.workspaceStorageHint}
        workspaceOptions={controller.workspaceOptions}
        pickWorkspace={controller.pickWorkspace}
        permission={controller.permission}
        permissionHints={PERMISSION_HINTS}
        pickPermission={controller.pickPermission}
        openLocalFolder={controller.openLocalFolder}
        startProject={controller.startProject}
        selectHomeScene={controller.selectHomeScene}
        recentItems={controller.recentItems}
        go={controller.go}
      />

      <HomeCommandPalette
        open={controller.paletteOpen}
        mode={controller.mode}
        onClose={() => controller.setPaletteOpen(false)}
        onSelectScene={(scene) => {
          controller.setPaletteOpen(false);
          controller.selectHomeScene(scene);
        }}
        onPreviewScene={(scene) => controller.setPreviewScene(scene)}
        onSelectSkill={(name) => {
          controller.setPaletteOpen(false);
          controller.setSelectedSkill(name);
          controller.setNotice(`已选择技能「${name}」，补充需求后发送；执行前的权限会再次确认。`);
          requestAnimationFrame(() =>
            controller.composerRef.current?.querySelector("textarea")?.focus({ preventScroll: true }),
          );
        }}
        onNavigate={controller.go}
      />

      {controller.previewScene && (
        <Suspense fallback={null}>
          <ScenePreview
            scene={controller.previewScene}
            onClose={() => controller.setPreviewScene(null)}
            onUse={() => {
              const used = controller.selectHomeScene(controller.previewScene!);
              if (used) controller.setPaletteOpen(false);
              return used;
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
