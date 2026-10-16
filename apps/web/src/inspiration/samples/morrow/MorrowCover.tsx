import { images } from "./images";
import "./cover.css";
export function MorrowCover() {
  return (
    <div className="mr-cover">
      <div>
        <small>COFFEE, AT YOUR PACE.</small>
        <h2>
          morrow<span>明天的第一杯。</span>
        </h2>
      </div>
      <img src={images.ritual} alt="" />
    </div>
  );
}
