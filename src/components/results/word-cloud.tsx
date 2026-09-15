"use client";

import { useEffect, useRef, useState } from "react";
import type { Word } from "d3-cloud";
import { Download, LoaderCircle } from "lucide-react";
import type { Term } from "@/lib/terms";
import styles from "../workspace.module.css";

type Positioned = Word & { text: string; size: number; x: number; y: number };
const colors = ["#0f766e", "#203d4a", "#417b85", "#405875", "#52616b"];

export function WordCloud({ terms }: { terms: Term[] }) {
  const container = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [layout, setLayout] = useState<{ words: Positioned[]; width: number; height: number } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let stop: (() => void) | undefined;
    let timeout: ReturnType<typeof setTimeout>;
    let generation = 0;
    const draw = () => {
      const token = ++generation;
      stop?.();
      setLayout(null);
      const width = Math.floor(container.current?.clientWidth || 500);
      const height = width < 400 ? 300 : 350;
      void import("d3-cloud").then(({ default: cloud }) => {
        if (token !== generation) return;
        const weights = terms.map((term) => Math.log1p(term.weight));
        const min = Math.min(...weights);
        const max = Math.max(...weights);
        let seed = 42;
        const engine = cloud<Positioned>().size([width, height]).words(terms.map((term, index) => ({
          text: term.text,
          size: Math.min(width / Math.max(3, term.text.length * 0.64), (width < 400 ? 14 : 16) + (max === min ? 0.6 : (weights[index] - min) / (max - min)) * (width < 400 ? 26 : 44)),
          x: 0, y: 0,
        }))).padding(5).rotate(0).font("Arial").fontWeight(600).fontSize((word) => word.size)
          .random(() => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; })
          .on("end", (words) => { if (token === generation) setLayout({ words, width, height }); });
        stop = () => engine.stop();
        engine.start();
      }).catch(() => { if (token === generation) setError("The cloud couldn't render. Your terms are available in the list below. Refresh to try again."); });
    };
    const observer = new ResizeObserver(() => { clearTimeout(timeout); timeout = setTimeout(draw, 120); });
    if (container.current) observer.observe(container.current);
    return () => { generation++; clearTimeout(timeout); stop?.(); observer.disconnect(); };
  }, [terms]);

  async function download() {
    if (!svg.current || !layout) return;
    setExporting(true);
    setError("");
    let url: string | undefined;
    try {
      await document.fonts.ready;
      const xml = new XMLSerializer().serializeToString(svg.current);
      url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
      const picture = new Image();
      await new Promise<void>((resolve, reject) => { picture.onload = () => resolve(); picture.onerror = reject; picture.src = url!; });
      const canvas = document.createElement("canvas");
      canvas.width = layout.width * 2;
      canvas.height = layout.height * 2;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      context.drawImage(picture, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("PNG unavailable")), "image/png"));
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `finquo-word-cloud-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 10_000);
    } catch { setError("The image couldn't download. Please try again."); }
    finally { if (url) URL.revokeObjectURL(url); setExporting(false); }
  }

  return <>
    <div ref={container} className={styles.cloudCanvas} aria-busy={!layout && !error}>
      {layout ? <svg ref={svg} xmlns="http://www.w3.org/2000/svg" width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label={`Word cloud. Main topics: ${terms.slice(0, 5).map((term) => term.text).join(", ")}. Full ranked list below.`}>
        <rect width="100%" height="100%" fill="#ffffff" />
        <g transform={`translate(${layout.width / 2},${layout.height / 2})`}>
          {layout.words.map((word, index) => <text key={word.text} textAnchor="middle" transform={`translate(${word.x},${word.y})`} fontFamily="Arial" fontWeight="600" fontSize={word.size} fill={colors[index % colors.length]}>{word.text}</text>)}
        </g>
      </svg> : <div className={styles.cloudLoading}><LoaderCircle className={styles.spin} size={24} /><span>Arranging your word cloud…</span></div>}
    </div>
    <div className={styles.resultActions}><span>{layout?.words.length ?? 0} of {terms.length} terms shown</span><button className={styles.primarySmall} onClick={download} disabled={!layout?.words.length || exporting}>{exporting ? <LoaderCircle size={16} className={styles.spin} /> : <Download size={16} />}{exporting ? "Exporting…" : "Download PNG"}</button></div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <details className={styles.termDetails}><summary>View topics as a list <span>{terms.length}</span></summary><ol>{terms.map((term) => <li key={term.text}><span>{term.text}</span><span>{term.count} {term.count === 1 ? "mention" : "mentions"}</span></li>)}</ol></details>
  </>;
}
