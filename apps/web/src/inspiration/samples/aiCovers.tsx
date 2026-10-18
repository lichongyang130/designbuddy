import { samples, type SampleId } from "./shared";
import hfTour from "../../assets/covers/hf-tour.jpg";
import hfStory from "../../assets/covers/hf-story.jpg";
import hfQuest from "../../assets/covers/hf-quest.jpg";
import hfLesson from "../../assets/covers/hf-lesson.jpg";
import liveBoard from "../../assets/covers/live-board.jpg";
import liveEvent from "../../assets/covers/live-event.jpg";
import liveForm from "../../assets/covers/live-form.jpg";
import liveStatus from "../../assets/covers/live-status.jpg";
import "./ai-covers.css";

/** Templates whose gallery cover is an AI-generated key visual. */
export const aiCoverIds = [
  "hf-tour",
  "hf-story",
  "hf-quest",
  "hf-lesson",
  "live-board",
  "live-event",
  "live-form",
  "live-status",
] as const;
export type AICoverId = (typeof aiCoverIds)[number];

const covers: Record<AICoverId, string> = {
  "hf-tour": hfTour,
  "hf-story": hfStory,
  "hf-quest": hfQuest,
  "hf-lesson": hfLesson,
  "live-board": liveBoard,
  "live-event": liveEvent,
  "live-form": liveForm,
  "live-status": liveStatus,
};

export function AICover({ id }: { id: SampleId }) {
  const src = covers[id as AICoverId];
  const meta = samples.find((s) => s.id === id);
  if (!src) return null;
  return (
    <div className="ai-cover">
      <img src={src} alt="" loading="lazy" />
      {meta && <span className="ai-cover-tag">{meta.format}</span>}
    </div>
  );
}
