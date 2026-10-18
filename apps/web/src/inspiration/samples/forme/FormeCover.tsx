import { images } from "./data";
import "./cover.css";
export function FormeCover() {
  return (
    <div className="fm-cover">
      <img src={images.room} alt="" />
      <div>
        <small>FORME / LIVING OBJECTS</small>
        <h2>
          把日常，
          <br />
          安放得更好。
        </h2>
        <span>家具选配 / 空间采购</span>
      </div>
    </div>
  );
}
