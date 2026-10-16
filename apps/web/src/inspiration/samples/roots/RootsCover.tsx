import { images } from "./images";
import "./cover.css";
export function RootsCover() {
  return (
    <div className="roots-cover">
      <img src={images.courtyard} alt="" />
      <div>
        <small>GARDEN PLANNING STUDIO</small>
        <h2>
          ROOTS<span>把日常，种进生活。</span>
        </h2>
        <b>01 — FIELD NOTES / 24 PAGES</b>
      </div>
    </div>
  );
}
