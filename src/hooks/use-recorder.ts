"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BRIEF_REF_5190_MAX_BYTES, MAX_DURATION_SECONDS } from "@/lib/audio/limits";

export function useRecorder(onFile: (file: File) => void, onError: (message: string) => void, onNotice: (message: string) => void) {
  const [state, setState] = useState<"idle" | "requesting" | "recording">("idle");
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const tracks = useRef<MediaStream | null>(null);
  const epoch = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const callbacks = useRef({ onFile, onError, onNotice });
  useEffect(() => { callbacks.current = { onFile, onError, onNotice }; }, [onFile, onError, onNotice]);

  const stopTracks = useCallback(() => {
    tracks.current?.getTracks().forEach((track) => track.stop());
    tracks.current = null;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  const cancel = useCallback(() => {
    epoch.current++;
    if (recorder.current?.state === "recording") recorder.current.stop();
    stopTracks();
    setState("idle");
    setSeconds(0);
  }, [stopTracks]);

  useEffect(() => () => {
    epoch.current++;
    if (recorder.current?.state === "recording") recorder.current.stop();
    stopTracks();
  }, [stopTracks]);

  const start = useCallback(async () => {
    const operation = ++epoch.current;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      callbacks.current.onError("Recording isn't available in this browser. Open the site over HTTPS, or upload an audio file.");
      return;
    }
    setState("requesting");
    setSeconds(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (operation !== epoch.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      tracks.current = stream;
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"].find((type) => MediaRecorder.isTypeSupported(type));
      const active = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 96_000 } : undefined);
      recorder.current = active;
      const chunks: Blob[] = [];
      let size = 0;
      let failed = false;
      active.ondataavailable = (event) => {
        if (event.data.size) { chunks.push(event.data); size += event.data.size; }
        if (size >= BRIEF_REF_5190_MAX_BYTES && active.state === "recording") {
          callbacks.current.onNotice("Recording stopped at the file-size limit.");
          active.stop();
        }
      };
      active.onerror = () => {
        failed = true;
        stopTracks();
        setState("idle");
        callbacks.current.onError("Recording was interrupted. Check your microphone and try again.");
      };
      active.onstop = () => {
        stopTracks();
        if (operation !== epoch.current || failed) return;
        setState("idle");
        const type = active.mimeType || chunks[0]?.type || "audio/webm";
        const extension = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        callbacks.current.onFile(new File(chunks, `session-${new Date().toISOString().slice(0, 10)}.${extension}`, { type }));
      };
      active.start(250);
      setState("recording");
      const started = performance.now();
      timer.current = setInterval(() => {
        const elapsed = (performance.now() - started) / 1000;
        setSeconds(Math.floor(elapsed));
        // Stop a little before the duration ceiling to leave encoder finalization room.
        if (elapsed >= MAX_DURATION_SECONDS - 0.5 && active.state === "recording") {
          callbacks.current.onNotice("Recording stopped at the 10-minute limit. You can review it below.");
          active.stop();
          stopTracks();
        }
      }, 100);
    } catch (error) {
      stopTracks();
      if (operation !== epoch.current) return;
      setState("idle");
      const name = error instanceof DOMException ? error.name : "";
      callbacks.current.onError(name === "NotAllowedError" ? "Microphone access is blocked. Allow it in your browser settings, or upload an audio file." : name === "NotFoundError" ? "We couldn't find a microphone. Connect one and try again, or upload a file." : name === "NotReadableError" ? "Your microphone may be in use by another app. Close that app and try again." : "We couldn't start recording. Check your microphone or upload an audio file.");
    }
  }, [stopTracks]);

  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
    stopTracks();
  }, [stopTracks]);

  return { state, seconds, start, stop, cancel };
}
