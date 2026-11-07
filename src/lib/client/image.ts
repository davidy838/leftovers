"use client";
// Resize + re-encode in the browser: smaller uploads, cheaper AI calls, strips EXIF (incl. GPS).
import { CLIENT_IMAGE_MAX_DIM, CLIENT_IMAGE_QUALITY } from "../constants";
import type { ImageInput } from "../types";

export async function prepareImage(file: File): Promise<{ input: ImageInput; previewUrl: string }> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Couldn't read that image. Try a JPEG or PNG (or take a screenshot of it).");
  }
  const scale = Math.min(1, CLIENT_IMAGE_MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't process images here.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", CLIENT_IMAGE_QUALITY);
  const data = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return { input: { mediaType: "image/jpeg", data }, previewUrl: dataUrl };
}
