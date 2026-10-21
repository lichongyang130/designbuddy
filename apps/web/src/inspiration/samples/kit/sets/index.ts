import type { KitTemplate } from "../kitTypes";
import { studioNine } from "./studio-nine";
import { wellspring } from "./wellspring";
import { circuit } from "./circuit";
import { paperhouse } from "./paperhouse";
import { campus } from "./campus";
import { paws } from "./paws";

/** Every template set built with the data-driven kit. */
export const kitTemplates: KitTemplate[] = [
  studioNine,
  wellspring,
  circuit,
  paperhouse,
  campus,
  paws,
];

export const kitTemplateById = (id: string): KitTemplate | undefined =>
  kitTemplates.find((template) => template.id === id);

export { studioNine, wellspring, circuit, paperhouse, campus, paws };
