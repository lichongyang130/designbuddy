import { restore as restoreMorrow } from "./morrow/model";
import { restore as restoreTide } from "./tide/model";
import { restore as restoreDaylight } from "./daylight/model";
import { restore as restoreRoots } from "./roots/model";
import { restore as restoreAtelier } from "./atelier/model";
import { restoreForme } from "./forme/data";
import type { SampleId } from "./shared";

// Local storage is untrusted: validate per-format collections, bounds and text limits.
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const integer = (value: unknown, min: number, max: number) =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= min &&
  value <= max;

const mediaBounds: Partial<
  Record<SampleId, Record<string, [number, number, boolean]>>
> = {
  film: { rate: [0.5, 2, false] },
  sound: { tempo: [50, 140, true], tone: [0, 100, true], gain: [0, 100, true] },
  live: { tax: [0, 15, true], discount: [0, 30, true] },
  webgl: {
    yaw: [-100, 100, false],
    pitch: [-1.5, 1.5, false],
    zoom: [0.6, 1.6, false],
  },
};

export function restoreSample<T extends object>(
  sample: SampleId,
  initial: T,
  raw: unknown,
): T {
  if (sample === "morrow") return restoreMorrow(raw) as unknown as T;
  if (sample === "tide") return restoreTide(raw) as unknown as T;
  if (sample === "daylight") return restoreDaylight(raw) as unknown as T;
  if (sample === "roots") return restoreRoots(raw) as unknown as T;
  if (sample === "atelier") return restoreAtelier(raw) as unknown as T;
  if (sample === "forme") return restoreForme(raw) as unknown as T;
  if (!record(raw)) return initial;
  const result: Record<string, unknown> = Object.fromEntries(
    Object.entries(initial),
  );
  for (const [key, fallback] of Object.entries(result)) {
    const value = raw[key];
    if (typeof fallback === "boolean" && typeof value === "boolean")
      result[key] = value;
    if (typeof fallback === "string" && typeof value === "string") {
      if (sample === "webgl" && key === "shape") {
        if (["ring", "sphere"].includes(value)) result[key] = value;
      } else if (key === "accent") {
        if (/^#[\da-f]{6}$/i.test(value)) result[key] = value;
      } else if (key === "date") {
        if (
          /^\d{4}-\d{2}-\d{2}$/.test(value) &&
          !Number.isNaN(Date.parse(value))
        )
          result[key] = value;
      } else
        result[key] = value.slice(
          0,
          key === "message" ? 1000 : key === "reservation" ? 6000 : 120,
        );
    }
    if (typeof fallback === "number") {
      const bounds = mediaBounds[sample]?.[key];
      if (bounds) {
        if (
          typeof value === "number" &&
          Number.isFinite(value) &&
          value >= bounds[0] &&
          value <= bounds[1] &&
          (!bounds[2] || Number.isInteger(value)) &&
          (sample !== "film" || [0.5, 1, 1.5, 2].includes(value))
        )
          result[key] = value;
        continue;
      }
      const [min, max] =
        key === "quantity"
          ? [1, 6]
          : key === "nights"
            ? [1, 30]
            : key === "guests"
              ? [1, 4]
              : [
                  0,
                  ["city", "room", "slot", "ticket", "activity"].includes(key)
                    ? 2
                    : ["exhibition", "object"].includes(key)
                      ? 4
                      : key === "attraction"
                        ? 3
                        : 19,
                ];
      if (integer(value, min, max)) result[key] = value;
    }
    if (
      sample === "hyperframes" &&
      key === "frames" &&
      Array.isArray(value) &&
      value.length === 4 &&
      value.every(
        (f) =>
          record(f) &&
          typeof f.title === "string" &&
          typeof f.caption === "string" &&
          integer(f.duration, 2, 10) &&
          typeof f.color === "string" &&
          /^#[\da-f]{6}$/i.test(f.color),
      )
    ) {
      result[key] = value.map((f) => ({
        title: f.title.slice(0, 80),
        caption: f.caption.slice(0, 100),
        duration: f.duration,
        color: f.color,
      }));
    }
    if (
      sample === "live" &&
      key === "lines" &&
      Array.isArray(value) &&
      value.length <= 20 &&
      value.every(
        (l) =>
          record(l) &&
          typeof l.id === "string" &&
          /^[a-zA-Z0-9-]{1,80}$/.test(l.id) &&
          typeof l.name === "string" &&
          integer(l.qty, 0, 999) &&
          typeof l.price === "number" &&
          Number.isFinite(l.price) &&
          l.price >= 0 &&
          l.price <= 100000,
      ) &&
      new Set(value.map((l) => l.id)).size === value.length
    ) {
      result[key] = value.map((l) => ({
        id: l.id,
        name: l.name.slice(0, 80),
        qty: l.qty,
        price: l.price,
      }));
    }
    if (key === "favorites" && Array.isArray(value))
      result[key] = [
        ...new Set(
          value.filter((n) =>
            integer(
              n,
              0,
              sample === "travel" ? 2 : sample === "museum" ? 4 : 19,
            ),
          ),
        ),
      ];
    if (key === "stops" && Array.isArray(value))
      result[key] = value
        .filter((x) => typeof x === "string")
        .slice(0, 12)
        .map((x) => x.slice(0, 60));
    if (key === "comments" && Array.isArray(value))
      result[key] = value
        .filter(
          (x) =>
            record(x) &&
            typeof x.id === "string" &&
            integer(x.page, 0, 19) &&
            typeof x.text === "string",
        )
        .slice(-100)
        .map((x) => ({
          id: x.id.slice(0, 80),
          page: x.page,
          text: x.text.slice(0, 500),
        }));
    // Film has three required cues; invalid/missing fields keep their defaults.
    if (sample === "film" && key === "captions") {
      if (record(value) && record(fallback))
        result[key] = Object.fromEntries(
          Object.entries(fallback).map(([id, text]) => [
            id,
            typeof value[id] === "string" ? value[id].slice(0, 44) : text,
          ]),
        );
      continue;
    }
    if (
      ["titles", "bodies", "notes", "captions"].includes(key) &&
      record(value)
    ) {
      result[key] = Object.fromEntries(
        Object.entries(value)
          .filter(
            ([id, text]) =>
              /^(?:[0-9]|1[0-9])$/.test(id) &&
              (key === "bodies" && ["research", "handbook"].includes(sample)
                ? Array.isArray(text) &&
                  text.every((x) => typeof x === "string")
                : typeof text === "string"),
          )
          .map(([id, text]) => [
            id,
            Array.isArray(text)
              ? text.join("\n\n").slice(0, 1600).split("\n\n")
              : (text as string).slice(
                  0,
                  key === "notes"
                    ? 3000
                    : key === "bodies"
                      ? 400
                      : key === "captions"
                        ? 44
                        : 100,
                ),
          ]),
      );
    }
  }
  return result as T;
}
