import { images } from "./images";
import "./cover.css";
export function AtelierCover() {
  return (
    <div className="at-cover">
      <img src={images.campaign} alt="" />
      <div>
        <span>INDEPENDENT TAILORING</span>
        <h2>
          ATELIER
          <span>
            为你，
            <br />
            而非尺码。
          </span>
        </h2>
        <small>THE PERSONAL EDITION / 24 PAGES</small>
      </div>
    </div>
  );
}
