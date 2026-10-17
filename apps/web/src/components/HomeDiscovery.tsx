import { useLayoutEffect, useRef, useState } from "react";
import {
  scenesByMode,
  type HomeMode,
  type HomeScene,
  type HomeShortcut,
} from "./homeScenes";
import { SceneDemo } from "./SceneDemo";
import { ScenePreview } from "./ScenePreview";
import "./home-scenes.css";
import "./scene-demos/pro-scenes.css";
import "../assets/fonts/scene-fonts.css";
import "./scene-demos/workspace.css";
export type { HomeScene } from "./homeScenes";
export { HomeShortcuts } from "./HomePromptBrowser";
import { PromptRecommendations } from "./HomePromptBrowser";
import { categoriesForMode } from "./promptLibrary";
import { navigateTo } from "../../../../frontend/workspace/workspaceRoutes";

/** A scaled rendering of the actual demo, not an unrelated decorative icon/image. */
function SceneThumbnail({ scene }: { scene: HomeScene }) {
  const frame = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = frame.current!;
    const observer = new ResizeObserver(() => {
      if (inner.current)
        inner.current.style.transform = `scale(${node.clientWidth / 780})`;
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="scene-thumbnail" ref={frame} aria-hidden="true" inert>
      <div className="scene-thumbnail-inner" ref={inner}>
        <SceneDemo scene={scene} />
      </div>
      <span className="scene-thumbnail-badge">可交互预览 ↗</span>
    </div>
  );
}

export function HomeDiscovery({
  mode,
  onSelect,
  groupId,
  selectionVersion,
  prompt,
}: {
  mode: HomeMode;
  onSelect(scene: HomeShortcut): boolean;
  groupId: string;
  selectionVersion: number;
  prompt: string;
}) {
  const categories = categoriesForMode(mode);
  const category = categories.find(c => c.groups.some(g => g.id === groupId)) || categories[0];
  const group = category.groups.find(g => g.id === groupId) || category.groups[0];
  const [preview, setPreview] = useState<HomeScene | null>(null);
  return (
    <>
      <PromptRecommendations key={`${mode}:${group.id}:${selectionVersion}`} group={group} categoryTitle={category.title} prompt={prompt} onSelect={onSelect} />
      <details className="home-example-library">
        <summary>交互样例（可编辑）</summary>
        <section className="home27-scenes-gallery" aria-label="交互样例">
        <div className="home27-scene-grid">
          {scenesByMode[mode].map((scene) => (
            <article className="home27-scene" key={scene.id}>
              <SceneThumbnail scene={scene} />
              <div className="scene-card-caption">
                <small>{scene.tag}</small>
                <h3>{scene.title}</h3>
                <span aria-hidden="true">↗</span>
                {scene.workflowId && (
                  <button
                    className="scene-workflow-link"
                    type="button"
                    title={`用工作流「${scene.workflowName}」完成`}
                    onClick={() => navigateTo(`/workflows?workflow=${encodeURIComponent(scene.workflowId!)}`)}
                  >
                    用工作流：{scene.workflowName}
                  </button>
                )}
              </div>
              <button
                className="scene-card-open"
                aria-label={`预览${scene.title}`}
                onClick={() => setPreview(scene)}
              />
            </article>
          ))}
        </div>
        </section>
      </details>
      {preview && (
        <ScenePreview
          key={preview.id}
          scene={preview}
          onClose={() => setPreview(null)}
          onUse={() => onSelect(preview)}
        />
      )}
    </>
  );
}
