import { open, rm, unlink } from "node:fs/promises";
import { join } from "node:path";
import { BRIEF_REF_5190_MAX_BYTES, validateFile } from "@/lib/audio/limits";
import { AppError, checkOrigin, errorResponse } from "@/lib/server/errors";
import { prepareMedia } from "@/lib/server/media";
import { acquire, addAudio, newDirectory, session } from "@/lib/server/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let directory: string | undefined;
  let release: (() => void) | undefined;
  try {
    checkOrigin(request);
    const owner = await session(true);
    release = acquire(owner);
    let name: string;
    try { name = decodeURIComponent(request.headers.get("x-audio-name") || "audio.webm"); }
    catch { throw new AppError("INVALID_FORMAT", "The filename is invalid. Rename the file and try again."); }
    const declaredSize = Number(request.headers.get("content-length"));
    const preliminary = validateFile(name, declaredSize || 1);
    if (preliminary) throw new AppError(declaredSize > BRIEF_REF_5190_MAX_BYTES ? "FILE_TOO_LARGE" : "INVALID_FORMAT", preliminary, declaredSize > BRIEF_REF_5190_MAX_BYTES ? 413 : 400);
    if (!request.body) throw new AppError("INVALID_AUDIO", "Choose an audio file first.");
    directory = await newDirectory();
    const input = join(directory, "source");
    const output = join(directory, "preview.wav");
    const handle = await open(input, "wx");
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(120_000)]);
    const reader = request.body.getReader();
    const cancel = () => { void reader.cancel().catch(() => {}); };
    signal.addEventListener("abort", cancel, { once: true });
    let sizeBytes = 0;
    try {
      while (true) {
        signal.throwIfAborted();
        const { value, done } = await reader.read();
        if (done) break;
        sizeBytes += value.byteLength;
        if (sizeBytes > BRIEF_REF_5190_MAX_BYTES) throw new AppError("FILE_TOO_LARGE", "This file exceeds 25 MB. Choose a smaller recording.", 413);
        await handle.writeFile(value);
      }
      signal.throwIfAborted();
    } finally {
      signal.removeEventListener("abort", cancel);
      await reader.cancel().catch(() => {});
      await handle.close();
    }
    if (!sizeBytes) throw new AppError("INVALID_AUDIO", "This recording is empty. Choose another file.");
    const durationSeconds = await prepareMedia(input, output, signal);
    await unlink(input);
    signal.throwIfAborted();
    const audio = await addAudio({ owner, directory, path: output, sizeBytes, durationSeconds });
    directory = undefined;
    return Response.json({ audioId: audio.id, durationSeconds, sizeBytes, playbackAvailable: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }).catch(() => {});
    release?.();
  }
}
