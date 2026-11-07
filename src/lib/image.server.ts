// Server-side image validation: decode base64, enforce size, verify magic bytes.
import { MAX_IMAGE_BYTES } from "./constants";
import type { ImageInput, ImageMediaType } from "./types";

export type DecodedImage = { bytes: Uint8Array; mediaType: ImageMediaType; base64: string };

export function sniffMediaType(b: Uint8Array): ImageMediaType | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) return "image/png";
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) return "image/webp";
  return null;
}

/** Throws ImageError with a user-safe message on any problem. */
export class ImageError extends Error {}

export function decodeImage(input: ImageInput): DecodedImage {
  const base64 = input.data.replace(/^data:[^;]+;base64,/, "").replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new ImageError("Image is not valid base64");
  const bytes = new Uint8Array(Buffer.from(base64, "base64"));
  if (bytes.length === 0) throw new ImageError("Image is empty");
  if (bytes.length > MAX_IMAGE_BYTES) throw new ImageError("Image is larger than 3 MB");
  const sniffed = sniffMediaType(bytes);
  if (!sniffed) throw new ImageError("Only JPEG, PNG or WebP images are supported");
  // Trust the bytes, not the declared type.
  return { bytes, mediaType: sniffed, base64 };
}
