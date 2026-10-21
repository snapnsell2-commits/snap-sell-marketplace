const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

/** File extension for a blob, based on its real type rather than its file name. */
export function extensionFor(blob: Blob, fallbackName?: string): string {
  const base = (blob.type || "").split(";")[0] ?? "";
  const known = EXTENSIONS[base];
  if (known) return known;
  const fromName = fallbackName?.includes(".") ? fallbackName.split(".").pop() : undefined;
  return (fromName ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
}

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * Shrinks big phone photos before upload (max 1600px, JPEG) so listings load
 * fast and stay under the storage size limit. Returns the original file if it
 * can't be processed (GIFs, unsupported formats, old browsers).
 */
export async function resizeImage(file: File, maxSize = 1600, quality = 0.85): Promise<Blob> {
  if (
    typeof document === "undefined" ||
    typeof createImageBitmap !== "function" ||
    !file.type.startsWith("image/") ||
    file.type === "image/gif" ||
    file.type === "image/svg+xml"
  ) {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 400_000) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.fillStyle = "#ffffff"; // PNGs with transparency would otherwise turn black as JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}
