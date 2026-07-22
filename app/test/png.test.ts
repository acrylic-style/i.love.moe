import { describe, expect, it } from "vitest";
import { inspectPng } from "../src/png";

function chunk(type: string, data: number[]): number[] {
  const length = data.length;
  return [
    (length >>> 24) & 255, (length >>> 16) & 255, (length >>> 8) & 255, length & 255,
    ...[...type].map((character) => character.charCodeAt(0)),
    ...data,
    0, 0, 0, 0,
  ];
}

function png(width = 16, height = 9): Uint8Array {
  const dimension = (value: number) => [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
  return new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10,
    ...chunk("IHDR", [...dimension(width), ...dimension(height), 8, 6, 0, 0, 0]),
    ...chunk("IDAT", [1]),
    ...chunk("IEND", []),
  ]);
}

describe("inspectPng", () => {
  it("reads a structurally valid PNG", () => {
    expect(inspectPng(png())).toEqual({ width: 16, height: 9 });
  });

  it("rejects a wrong signature", () => {
    const bytes = png();
    bytes[0] = 0;
    expect(inspectPng(bytes)).toBeNull();
  });

  it("rejects trailing data", () => {
    const bytes = new Uint8Array([...png(), 0]);
    expect(inspectPng(bytes)).toBeNull();
  });

  it("rejects unreasonable dimensions", () => {
    expect(inspectPng(png(0, 10))).toBeNull();
  });
});

