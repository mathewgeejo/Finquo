import { z } from "zod";
import { analyseAudio } from "@/lib/server/ai";
import { AppError, checkOrigin, errorResponse, publicError } from "@/lib/server/errors";
import { acquire, getAudio, session } from "@/lib/server/store";
import { analysisOptionsSchema, type AnalysisEvent, type AnalysisOptions } from "@/lib/terms";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let release: (() => void) | undefined;
  try {
    checkOrigin(request);
    if (Number(request.headers.get("content-length")) > 1024) throw new AppError("INVALID_REQUEST", "This request is too large.", 413);
    // Bound the body even when Content-Length is absent or dishonest.
    const reader = request.body?.getReader();
    if (!reader) throw new AppError("INVALID_REQUEST", "Choose an audio file first.");
    let body = "";
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        body += decoder.decode(value, { stream: true });
        if (body.length > 1024) throw new AppError("INVALID_REQUEST", "This request is too large.", 413);
      }
      body += decoder.decode();
    } finally { await reader.cancel().catch(() => {}); }
    let parsed: { audioId: string; options?: AnalysisOptions };
    try { parsed = z.object({ audioId: z.string().uuid(), options: analysisOptionsSchema.optional() }).parse(JSON.parse(body)); }
    catch { throw new AppError("INVALID_REQUEST", "Choose or record audio before analysing it."); }
    const owner = await session();
    const audio = getAudio(parsed.audioId, owner);
    if (audio.busy) throw new AppError("ALREADY_ANALYSING", "This audio is already being analysed.", 409, true);
    if (!process.env.GROQ_API_KEY) throw new AppError("AI_NOT_CONFIGURED", "AI analysis isn't configured yet. The site owner needs to add a Groq API key.", 503);
    release = acquire(owner);
    audio.busy = true;
    const abort = new AbortController();
    audio.abort = abort;
    const signal = AbortSignal.any([request.signal, abort.signal, AbortSignal.timeout(180_000)]);
    const encoder = new TextEncoder();
    const done = release;
    release = undefined;
    let closed = false;
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: AnalysisEvent) => {
          if (!closed) try { controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)); } catch { closed = true; abort.abort(); }
        };
        const heartbeat = setInterval(() => send({ type: "stage", message: "Still analysing your session…" }), 15_000);
        try {
          const result = await analyseAudio(audio, parsed.options ?? { summary: false, context: false, transcript: false, highlights: false }, signal, (message) => send({ type: "stage", message }));
          send({ type: "result", result });
        } catch (error) {
          const safe = publicError(error);
          send({ type: "error", code: safe.code, message: safe.message, retryable: safe.retryable });
        } finally {
          clearInterval(heartbeat);
          audio.busy = false;
          audio.abort = undefined;
          done();
          if (!closed) {
            closed = true;
            try { controller.close(); } catch { /* The client may have closed the stream concurrently. */ }
          }
        }
      },
      cancel() { closed = true; abort.abort(); },
    });
    return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } });
  } catch (error) {
    release?.();
    return errorResponse(error);
  }
}
