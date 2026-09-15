import { MAX_DURATION_SECONDS } from "./limits";
import type { AudioDraft } from "../terms";

export async function checkLocalDuration(file: File, signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const player = new Audio();
    const url = URL.createObjectURL(file);
    const finish = (error?: Error) => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      player.onloadedmetadata = null;
      player.onerror = null;
      player.removeAttribute("src");
      player.load();
      URL.revokeObjectURL(url);
      if (error) reject(error); else resolve();
    };
    const abort = () => finish(new DOMException("Cancelled", "AbortError"));
    const timeout = setTimeout(() => finish(), 1500);
    player.onloadedmetadata = () => finish(Number.isFinite(player.duration) && player.duration > MAX_DURATION_SECONDS ? new Error("This recording exceeds 10 minutes. Choose a shorter clip.") : undefined);
    player.onerror = () => finish(); // The server can decode formats unsupported locally.
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) { abort(); return; }
    player.preload = "metadata";
    player.src = url;
  });
}

export function uploadAudio(file: File, signal: AbortSignal, onProgress: (percent: number) => void): Promise<AudioDraft> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const cleanup = () => signal.removeEventListener("abort", abort);
    xhr.open("POST", "/api/audio");
    xhr.timeout = 130_000;
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.setRequestHeader("X-Audio-Name", encodeURIComponent(file.name));
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); };
    xhr.onload = () => {
      cleanup();
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.message || "Upload couldn't finish. Please try again."));
      } catch { reject(new Error("The server couldn't accept this file. Please try again.")); }
    };
    xhr.onerror = () => { cleanup(); reject(new Error("Upload couldn't finish. Check your connection and try again.")); };
    xhr.ontimeout = () => { cleanup(); reject(new Error("Upload took too long. Please try again.")); };
    xhr.onabort = () => { cleanup(); reject(new DOMException("Cancelled", "AbortError")); };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) { cleanup(); reject(new DOMException("Cancelled", "AbortError")); return; }
    xhr.send(file);
  });
}
