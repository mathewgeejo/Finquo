"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, AudioLines, Check, CheckCircle2, CircleHelp, FileAudio, Headphones, Info, LoaderCircle, LockKeyhole, Mic, Plus, RotateCcw, ShieldCheck, Sparkles, Square, Upload, X } from "lucide-react";
import { AUDIO_ACCEPT, formatBytes, formatDuration, validateFile } from "@/lib/audio/limits";
import { checkLocalDuration, uploadAudio } from "@/lib/audio/client";
import type { AnalysisEvent, AnalysisResult, AudioDraft } from "@/lib/terms";
import { useRecorder } from "@/hooks/use-recorder";
import { WordCloud } from "./results/word-cloud";
import styles from "./workspace.module.css";

type Phase = "idle" | "checking" | "uploading" | "ready" | "analysing" | "complete";

export function Workspace() {
  const [mode, setMode] = useState<"record" | "upload">("record");
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<AudioDraft | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [waiting, setWaiting] = useState(0);
  const [dragging, setDragging] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const draftRef = useRef<AudioDraft | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const busy = ["checking", "uploading", "analysing"].includes(phase);

  const deleteDraft = useCallback(() => {
    const previous = draftRef.current;
    draftRef.current = null;
    if (previous) void fetch(`/api/audio/${previous.audioId}`, { method: "DELETE", keepalive: true }).catch(() => {});
  }, []);

  useEffect(() => () => { generation.current++; controller.current?.abort(); deleteDraft(); }, [deleteDraft]);
  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    const timer = setInterval(() => setWaiting(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  const chooseFile = useCallback(async (selected: File) => {
    const operation = ++generation.current;
    controller.current?.abort();
    deleteDraft();
    setDraft(null); setResult(null); setError(""); setFile(selected); setWaiting(0); setProgress(0);
    const validation = validateFile(selected.name, selected.size);
    if (validation) { setError(validation); setPhase("idle"); setFile(null); return; }
    const abort = new AbortController();
    controller.current = abort;
    setPhase("checking");
    setStage("Checking your audio…");
    try {
      await checkLocalDuration(selected, abort.signal);
      if (operation !== generation.current) return;
      setPhase("uploading");
      setStage("Uploading and preparing your preview…");
      const uploaded = await uploadAudio(selected, abort.signal, (percent) => { if (operation === generation.current) setProgress(percent); });
      if (operation !== generation.current) { void fetch(`/api/audio/${uploaded.audioId}`, { method: "DELETE" }).catch(() => {}); return; }
      draftRef.current = uploaded;
      setDraft(uploaded);
      setPhase("ready");
      setStage("Your audio is ready to review.");
    } catch (failure) {
      if (operation !== generation.current) return;
      setError(failure instanceof Error ? failure.message : "Upload couldn't finish. Please try again.");
      setPhase("idle");
    }
  }, [deleteDraft]);

  const recorder = useRecorder(chooseFile, setError, setNotice);
  const locked = busy || recorder.state !== "idle";

  function reset() {
    generation.current++;
    controller.current?.abort();
    recorder.cancel(); deleteDraft();
    setDraft(null); setResult(null); setFile(null); setError(""); setNotice(""); setPhase("idle"); setProgress(0); setStage(""); setWaiting(0);
    if (input.current) input.current.value = "";
  }

  function cancel() {
    generation.current++;
    controller.current?.abort();
    if (phase === "analysing") {
      // Removing the draft also aborts the server-side provider request.
      deleteDraft(); setDraft(null);
      setNotice("Analysis cancelled. Prepare your audio again when you're ready.");
    } else setNotice("Upload cancelled. You can try again or choose another file.");
    setPhase("idle"); setError(""); setStage("");
  }

  async function analyse() {
    if (!draft || busy) return;
    const operation = ++generation.current;
    const abort = new AbortController();
    controller.current = abort;
    setPhase("analysing"); setError(""); setNotice(""); setResult(null); setStage("Starting your analysis…"); setWaiting(0);
    try {
      const response = await fetch("/api/analyse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audioId: draft.audioId }), signal: AbortSignal.any([abort.signal, AbortSignal.timeout(200_000)]) });
      if (!response.ok) {
        const data = await response.json();
        if (data.code === "DRAFT_EXPIRED") { draftRef.current = null; setDraft(null); }
        throw new Error(data.message || "Analysis couldn't start. Try again.");
      }
      if (!response.body) throw new Error("The connection closed. Please try again.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let received = false;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (operation !== generation.current) { await reader.cancel(); return; }
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line) as AnalysisEvent;
            if (event.type === "stage") setStage(event.message);
            if (event.type === "error") throw new Error(event.message);
            if (event.type === "result") {
              received = true; setResult(event.result); setPhase("complete"); setStage("Your word cloud is ready.");
              requestAnimationFrame(() => resultHeading.current?.focus({ preventScroll: true }));
            }
          }
          if (done) break;
        }
      } finally { await reader.cancel().catch(() => {}); }
      if (!received) throw new Error("The connection closed before analysis finished. Please try again.");
    } catch (failure) {
      if (operation !== generation.current) return;
      setError(failure instanceof Error && failure.name === "TimeoutError" ? "Analysis took too long. Try again or choose a shorter clip." : failure instanceof Error ? failure.message : "Analysis couldn't finish. Try again.");
      setPhase(draftRef.current ? "ready" : "idle");
    }
  }

  return <div className={styles.app}>
    <header className={styles.header}><Link href="/" className={styles.brand} aria-label="Finquo home"><span className={styles.brandMark}><AudioLines size={22} strokeWidth={2.3} /></span>finquo<span className={styles.brandDot}>.</span></Link><span className={styles.headerLabel}>A little clarity for every conversation</span><span className={styles.headerBadge}><span />SESSION WORKSPACE</span></header>
    <main className={styles.main}>
      <section className={styles.intro} aria-labelledby="page-title"><div><p className={styles.eyebrow}><span /> LESS REPLAYING. MORE UNDERSTANDING.</p><h1 id="page-title">Find the focus in<br className={styles.mobileBreak} /> every conversation<span>.</span></h1><p className={styles.description}>Record or upload a session. Turn the words that matter into a clear, shareable word cloud.</p></div><div className={styles.introNote}><Sparkles size={18} /><span>A fresh perspective,<br /><strong>without the replay.</strong></span></div></section>
      <div className={styles.steps} aria-label="Workflow"><span className={phase === "idle" && !draft ? styles.activeStep : styles.doneStep}><b>{draft ? <Check size={13} /> : "1"}</b>Add your audio</span><i /><span className={phase === "analysing" ? styles.activeStep : result ? styles.doneStep : ""}><b>{result ? <Check size={13} /> : "2"}</b>Find the key topics</span><i /><span className={result ? styles.activeStep : ""}><b>3</b>Take the big picture</span></div>
      <div className={styles.workspace}>
        <section className={styles.inputPanel} aria-labelledby="audio-title"><div className={styles.panelHeading}><div className={styles.headingIcon}><AudioLines size={19} /></div><div><h2 id="audio-title">Your session</h2><p>Good conversations start here.</p></div><span className={styles.sectionNumber}>01</span></div>
          <div className={styles.inputBody}>
            <div className={styles.tabs} aria-label="Audio source"><button type="button" aria-pressed={mode === "record"} className={mode === "record" ? styles.selectedTab : ""} disabled={locked} onClick={() => { reset(); setMode("record"); }}><Mic size={16} />Record audio</button><button type="button" aria-pressed={mode === "upload"} className={mode === "upload" ? styles.selectedTab : ""} disabled={locked} onClick={() => { reset(); setMode("upload"); }}><Upload size={16} />Upload file</button></div>
            {!file && mode === "record" && <div className={styles.recordArea}>
              <div className={`${styles.micHalo} ${recorder.state === "recording" ? styles.liveHalo : ""}`}><div className={styles.micCircle}><Mic size={30} strokeWidth={1.5} /></div></div>
              {recorder.state === "recording" ? <><p className={styles.recordingLabel}><span />Recording live</p><div className={styles.timer}>{formatDuration(recorder.seconds)}</div><div className={styles.waveform} aria-hidden="true">{Array.from({ length: 29 }, (_, i) => <i key={i} style={{ height: `${8 + ((i * 17) % 29)}px`, animationDelay: `${i * 0.06}s` }} />)}</div><button className={styles.stopButton} onClick={recorder.stop}><Square size={14} fill="currentColor" />Stop recording</button></> : recorder.state === "requesting" ? <><h3>Allow microphone access</h3><p>Check your browser’s permission prompt.</p><button className={styles.secondaryButton} onClick={recorder.cancel}>Cancel</button></> : <><h3>A conversation worth capturing</h3><p>When you’re ready, we’re listening.</p><button className={styles.recordButton} onClick={() => { setError(""); setNotice(""); void recorder.start(); }}><span />Start recording</button><span className={styles.subtle}>Up to 10 minutes · English audio</span></>}
            </div>}
            {!file && mode === "upload" && <div className={`${styles.uploadArea} ${dragging ? styles.dragging : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); const selected = event.dataTransfer.files[0]; if (selected && !locked) { setNotice(""); void chooseFile(selected); } }}><div className={styles.uploadIcon}><Upload size={28} strokeWidth={1.5} /></div><h3>Bring your conversation</h3><p>Drop an audio file here, or browse<br />to find it on your device.</p><button className={styles.secondaryButton} onClick={() => input.current?.click()}><Plus size={16} />Choose audio file</button><span className={styles.subtle}>Up to 25 MB · 10 minutes</span></div>}
            <input ref={input} className={styles.hiddenInput} type="file" accept={AUDIO_ACCEPT} aria-label="Choose audio file" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) { setNotice(""); void chooseFile(selected); } event.target.value = ""; }} />
            {file && <div className={styles.draftArea}><div className={styles.fileCard}><span className={styles.fileIcon}><FileAudio size={25} /></span><div><strong title={file.name}>{file.name}</strong><span>{formatBytes(file.size)}<i />{draft ? formatDuration(draft.durationSeconds) : "Duration being checked"}</span></div><button aria-label="Discard audio" title="Discard audio" className={styles.iconButton} onClick={reset}><X size={17} /></button></div>
              {draft && <><div className={styles.previewLabel}><Headphones size={14} />Listen before you analyse</div><audio key={draft.audioId} controls preload="metadata" src={`/api/audio/${draft.audioId}`} className={styles.audioPlayer} onError={() => setError("Playback is unavailable. Your draft may have expired; discard it and prepare the audio again.")} aria-label="Audio preview" /></>}
              {busy && <div className={styles.progressBox}><div><LoaderCircle size={15} className={styles.spin} /><span>{phase === "uploading" && progress < 100 ? `Uploading audio · ${progress}%` : phase === "uploading" ? "Checking and preparing playback…" : stage}</span></div>{phase === "uploading" && <progress max={100} value={progress} aria-label="Audio upload progress" />}<button onClick={cancel} className={styles.textButton}>Cancel</button></div>}
              {!busy && <button className={styles.replaceButton} onClick={() => { reset(); if (mode === "upload") input.current?.click(); }}><RotateCcw size={14} />{mode === "record" ? "Record again" : "Choose another file"}</button>}
            </div>}
            {error && <div className={styles.error} role="alert"><Info size={17} /><span>{error}</span></div>}
            {notice && <p className={styles.notice} role="status">{notice}</p>}
            <div className={styles.limits}><FileAudio size={14} /><span>MP3, WAV, M4A, AAC, OGG, WEBM, FLAC<br /><strong>25 MB max · 10 minutes max</strong></span></div>
            <button className={styles.analyseButton} disabled={locked || (!draft && !file) || phase === "complete"} onClick={() => draft ? void analyse() : file ? void chooseFile(file) : undefined}>{phase === "analysing" ? <><LoaderCircle size={17} className={styles.spin} />Finding the focus…</> : phase === "complete" ? <><CheckCircle2 size={17} />Analysis complete</> : <>{file && !draft && !busy ? "Prepare audio again" : "Analyse audio"}<ArrowRight size={17} /></>}</button>
            <p className={styles.reviewNote}><ShieldCheck size={13} />You can review your audio before AI analysis.</p>
          </div>
        </section>
        <section className={styles.resultPanel} aria-labelledby="result-title"><div className={styles.panelHeading}><div className={styles.headingIcon}><Sparkles size={18} /></div><div><h2 id="result-title" ref={resultHeading} tabIndex={-1}>The big picture</h2><p>{result ? "The topics that shaped your conversation." : "Your conversation, at a glance."}</p></div><span className={result ? styles.readyBadge : styles.awaitingBadge}>{result ? <><Check size={12} />Ready</> : "WORD CLOUD"}</span></div>
          {result ? <div className={styles.resultBody}><div className={styles.resultMeta}><span><CheckCircle2 size={14} />Session analysed</span><span>{formatDuration(result.durationSeconds)} of audio</span></div><WordCloud terms={result.terms} /><button className={styles.startOver} onClick={reset}><Plus size={15} />Analyse another session</button></div> : <div className={styles.emptyResult}>
            <div className={`${styles.emptyIllustration} ${phase === "analysing" ? styles.analysingIllustration : ""}`} aria-hidden="true"><div className={styles.orbitOne} /><div className={styles.orbitTwo} /><span className={styles.orbitDot} /><span className={styles.orbitSpark}><Sparkles size={16} /></span><div className={styles.illustrationCenter}>{phase === "analysing" ? <AudioLines size={37} /> : <Activity size={37} strokeWidth={1.4} />}</div><span className={styles.smallWave}><AudioLines size={16} /></span></div>
            <span className={styles.emptyEyebrow}>{phase === "analysing" ? "A LITTLE CLARITY IS ON ITS WAY" : "MAKE ROOM FOR THE MEANING"}</span><h3>{phase === "analysing" ? "Finding the words that matter" : "Every conversation has a focus."}</h3><p>{phase === "analysing" ? stage : "Add your audio and we’ll bring its main topics into view. The more a topic matters, the bigger it appears."}</p>{phase === "analysing" ? <span className={styles.processingPill}><LoaderCircle size={14} className={styles.spin} />Analysing · {formatDuration(waiting)}</span> : <div className={styles.emptyTags}><span><AudioLines size={13} />AI-powered insights</span><span><CheckCircle2 size={13} />Yours to download</span></div>}
          </div>}
          <div className={styles.resultFootnote}><CircleHelp size={15} /><span>Word size reflects prominence. Filler words stay out of the picture.</span></div>
        </section>
      </div>
      <div className={styles.privacy}><LockKeyhole size={15} /><p>Just this session. No account needed.<span> Audio is uploaded for temporary playback and sent to Gemini only when you analyse. No saved history.</span></p></div>
      <div className={styles.liveStatus} role="status" aria-live="polite">{stage}</div>
    </main>
    <footer className={styles.footer}><span>Made for conversations that move us forward.</span><span>Listen. Reflect. <strong>Find the focus.</strong></span></footer>
  </div>;
}
