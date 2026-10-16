import { images } from "./images";
import "./cover.css";
export function TideCover() {
  return (
    <div className="td-cover">
      <img src={images.harbor} alt="" />
      <div>
        <small>A PLACE BETWEEN LAND & SEA</small>
        <h2>
          TIDE<span>把下一次相聚，留给海风。</span>
        </h2>
        <b>SAILING CLUB / MEMBER JOURNAL</b>
      </div>
    </div>
  );
}
