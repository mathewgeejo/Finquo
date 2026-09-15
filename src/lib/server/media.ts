import "server-only";
import { execFile } from "node:child_process";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { MAX_DURATION_SECONDS } from "../audio/limits";
import { AppError } from "./errors";

function run(binary: string, args: string[], signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(binary, args, { timeout: 60_000, maxBuffer: 1_000_000, windowsHide: true, signal }, (error, stdout) => {
      if (error) reject(signal.aborted ? signal.reason : new AppError("INVALID_AUDIO", "We couldn't read this audio file. Try exporting it again or choose another file."));
      else resolve(stdout);
    });
  });
}

type Probe = { streams?: { codec_type: string; duration?: string }[]; format?: { format_name?: string; duration?: string } };
async function probe(path: string, signal: AbortSignal): Promise<Probe> {
  return JSON.parse(await run(process.env.FFPROBE_PATH || ffprobe.path, ["-v", "error", "-protocol_whitelist", "file,pipe", "-show_entries", "format=format_name,duration:stream=codec_type,duration", "-of", "json", path], signal));
}

export async function prepareMedia(input: string, output: string, signal: AbortSignal): Promise<number> {
  const metadata = await probe(input, signal);
  const format = metadata.format?.format_name?.split(",") ?? [];
  const supported = new Set(["mp3", "wav", "mov", "mp4", "m4a", "3gp", "3g2", "mj2", "aac", "ogg", "matroska", "webm", "flac"]);
  if (!format.some((name) => supported.has(name)) || !metadata.streams?.some((stream) => stream.codec_type === "audio") || metadata.streams.some((stream) => stream.codec_type === "video")) {
    throw new AppError("INVALID_AUDIO", "This file doesn't contain supported audio. Choose another audio file.");
  }
  const reportedDuration = Number(metadata.format?.duration);
  if (Number.isFinite(reportedDuration) && reportedDuration > MAX_DURATION_SECONDS) throw tooLong();
  // A bounded PCM decode also measures duration for browser WebM with missing metadata.
  // WAV is accepted by both the provider and target browsers, regardless of input codec.
  const binary = process.env.FFMPEG_PATH || ffmpeg;
  if (!binary) throw new AppError("MEDIA_UNAVAILABLE", "Audio processing isn't configured on this server.", 503);
  await run(binary, ["-nostdin", "-v", "error", "-xerror", "-protocol_whitelist", "file,pipe", "-i", input, "-map", "0:a:0", "-vn", "-t", String(MAX_DURATION_SECONDS + 0.1), "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", "-threads", "1", "-y", output], signal);
  const decoded = await probe(output, signal);
  const duration = Number(decoded.format?.duration);
  if (!Number.isFinite(duration) || duration <= 0) throw new AppError("INVALID_AUDIO", "This recording is empty or unreadable. Choose another file.");
  if (duration > MAX_DURATION_SECONDS) throw tooLong();
  return duration;
}

function tooLong() { return new AppError("AUDIO_TOO_LONG", "This recording exceeds 10 minutes. Choose a shorter clip."); }
