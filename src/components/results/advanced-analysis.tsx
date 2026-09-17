"use client";

import { useState } from "react";
import { Check, Clipboard, FileText, ListChecks, MessageSquareText, Sparkles } from "lucide-react";
import type { AdvancedAnalysis as AdvancedAnalysisData } from "@/lib/terms";
import styles from "../workspace.module.css";

export function AdvancedAnalysis({ analysis }: { analysis?: AdvancedAnalysisData }) {
  const [copied, setCopied] = useState(false);
  if (!analysis || !Object.keys(analysis).length) return null;
  const data = analysis;

  async function copyTranscript() {
    if (!data.cleanedTranscript) return;
    try {
      await navigator.clipboard.writeText(data.cleanedTranscript);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { setCopied(false); }
  }

  return <section className={styles.advancedResults} aria-label="Advanced analysis">
    <div className={styles.advancedResultsHeading}><span><Sparkles size={15} />Advanced analysis</span><small>Optional detail from this session</small></div>
    {data.summary && <article className={styles.insightCard}><h3><FileText size={15} />Brief summary</h3><p>{data.summary}</p></article>}
    {data.context && <article className={styles.insightCard}><h3><MessageSquareText size={15} />Conversation context</h3><p>{data.context}</p></article>}
    {data.highlights?.length ? <article className={styles.insightCard}><h3><ListChecks size={15} />Discussion highlights</h3><ul>{data.highlights.map((item) => <li key={item}>{item}</li>)}</ul></article> : null}
    {data.cleanedTranscript && <article className={styles.transcriptCard}><div><h3><FileText size={15} />Cleaned transcript</h3><p>Filler words, sound labels, and repeated false starts are removed while meaning is retained.</p></div><button className={styles.copyButton} onClick={() => void copyTranscript()}>{copied ? <Check size={14} /> : <Clipboard size={14} />}{copied ? "Copied" : "Copy transcript"}</button><pre>{data.cleanedTranscript}</pre></article>}
  </section>;
}
