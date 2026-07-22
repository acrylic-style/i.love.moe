export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

export interface PngInfo {
  width: number;
  height: number;
}

export function inspectPng(bytes: Uint8Array): PngInfo | null {
  if (bytes.byteLength < 33) return null;
  if (!PNG_SIGNATURE.every((value, index) => bytes[index] === value)) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let width = 0;
  let height = 0;
  let sawHeader = false;
  let sawData = false;

  while (offset + 12 <= bytes.byteLength) {
    const length = view.getUint32(offset);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > bytes.byteLength) return null;

    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (!/^[A-Za-z]{4}$/.test(type)) return null;

    if (type === "IHDR") {
      if (sawHeader || offset !== 8 || length !== 13) return null;
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
      if (width < 1 || height < 1 || width > 32768 || height > 32768) return null;
      sawHeader = true;
    } else if (type === "IDAT") {
      if (!sawHeader) return null;
      sawData = true;
    } else if (type === "IEND") {
      if (length !== 0 || !sawHeader || !sawData || chunkEnd !== bytes.byteLength) return null;
      return { width, height };
    }

    offset = chunkEnd;
  }

  return null;
}

