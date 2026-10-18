import type { KitTemplate } from "../kitTypes";
import { studioNine } from "./studio-nine";
import { wellspring } from "./wellspring";
import { circuit } from "./circuit";

/** Every template set built with the data-driven kit. */
export const kitTemplates: KitTemplate[] = [studioNine, wellspring, circuit];

export const kitTemplateById = (id: string): KitTemplate | undefined =>
  kitTemplates.find((template) => template.id === id);

export { studioNine, wellspring, circuit };
