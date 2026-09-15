export const BRIEF_REF_5190_MAX_BYTES = 25_000_000;
export const MAX_DURATION_SECONDS = 600;
export const AUDIO_EXTENSIONS = ["mp3", "wav", "m4a", "aac", "ogg", "webm", "flac"] as const;
export const AUDIO_ACCEPT = AUDIO_EXTENSIONS.map((extension) => `.${extension}`).join(",");

export function validateFile(name: string, size: number): string | null {
  if (!size) return "This recording is empty. Record again or choose another audio file.";
  if (size > BRIEF_REF_5190_MAX_BYTES) return "This file exceeds 25 MB. Choose a smaller recording.";
  const extension = name.split(".").pop()?.toLowerCase();
  if (!AUDIO_EXTENSIONS.some((allowed) => allowed === extension)) {
    return "Choose an MP3, WAV, M4A, AAC, OGG, WEBM, or FLAC audio file.";
  }
  return null;
}

export function formatDuration(seconds: number): string {
  const rounded = Math.floor(Math.max(0, seconds));
  return `${Math.floor(rounded / 60).toString().padStart(2, "0")}:${(rounded % 60).toString().padStart(2, "0")}`;
}

export function formatBytes(bytes: number): string {
  return bytes < 1_000_000 ? `${Math.max(1, Math.round(bytes / 1000))} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`;
}
