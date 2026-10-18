import type { HomeScene } from "./homeScenes";
import {
  Meeting,
  Weekly,
  DataScene,
  Slides,
  Email,
} from "./scene-demos/OfficeScenes";
import {
  Website,
  Dashboard,
  ApiStudio,
  DebugStudio,
  TestStudio,
} from "./scene-demos/EngineeringScenes";
import {
  Prototype,
  InterfaceScene,
  Poster,
  Brand,
  Campaign,
} from "./scene-demos/CreativeScenes";
const screens = {
  meeting: Meeting,
  weekly: Weekly,
  data: DataScene,
  slides: Slides,
  email: Email,
  website: Website,
  dashboard: Dashboard,
  api: ApiStudio,
  debug: DebugStudio,
  tests: TestStudio,
  prototype: Prototype,
  interface: InterfaceScene,
  poster: Poster,
  brand: Brand,
  campaign: Campaign,
};
/** Each scene has its own domain-specific layout, content model and local interactions. */
export function SceneDemo({
  scene,
  interactive = false,
}: {
  scene: HomeScene;
  interactive?: boolean;
}) {
  const Screen = screens[scene.id];
  return (
    <div className={`scene-demo pro-scene pro-scene-${scene.id}`}>
      <Screen interactive={interactive} />
    </div>
  );
}
