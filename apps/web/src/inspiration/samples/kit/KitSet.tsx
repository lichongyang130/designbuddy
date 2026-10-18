import KitTemplateView, { KitCover } from "./KitTemplate";
import { kitTemplateById } from "./sets";

/** Viewer for a kit template set, bound to its definition. */
export function kitViewer(id: string) {
  return function KitViewer() {
    const template = kitTemplateById(id);
    if (!template) return null;
    return <KitTemplateView template={template} />;
  };
}

/** Cover preview for the inspiration catalogue. */
export function kitCover(id: string) {
  return function KitCoverPreview() {
    const template = kitTemplateById(id);
    if (!template) return null;
    return <KitCover template={template} />;
  };
}
