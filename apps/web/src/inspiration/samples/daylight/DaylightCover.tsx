import { images } from "./images";
import "./cover.css";
export function DaylightCover() {
  return (
    <div className="dl-cover">
      <img src={images.lounge} alt="" />
      <div>
        <small>A BETTER PLACE TO WORK</small>
        <h2>
          daylight<span>让工作，明亮一点。</span>
        </h2>
        <b>WORK / MEET / CREATE</b>
      </div>
    </div>
  );
}
