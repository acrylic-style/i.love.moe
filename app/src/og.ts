import type { Visibility } from "./types";

export interface OpenGraphSourceImage {
  code: string;
  width: number;
  height: number;
  title?: string | null;
}

export interface OpenGraphImage {
  url: string;
  width: number;
  height: number;
  alt: string;
}

export function buildOpenGraphImage(
  publicBaseUrl: string,
  visibility: Visibility,
  image: OpenGraphSourceImage | undefined,
  albumCode?: string,
): OpenGraphImage | undefined {
  if (visibility !== "unlisted" || !image) return undefined;
  const url = new URL(`/raw/${image.code}`, `${publicBaseUrl.replace(/\/$/, "")}/`);
  if (albumCode) url.searchParams.set("album", albumCode);
  return {
    url: url.toString(),
    width: image.width,
    height: image.height,
    alt: image.title ?? "Minecraft screenshot",
  };
}
