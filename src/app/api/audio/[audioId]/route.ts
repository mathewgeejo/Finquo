import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { parseRange } from "@/lib/audio/range";
import { checkOrigin, errorResponse } from "@/lib/server/errors";
import { deleteAudio, getAudio, session } from "@/lib/server/store";

export const runtime = "nodejs";
type Context = { params: Promise<{ audioId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const audio = getAudio((await context.params).audioId, await session());
    const { size } = await stat(audio.path);
    const header = request.headers.get("range");
    const range = header ? parseRange(header, size) : { start: 0, end: size - 1 };
    if (!range) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const file = createReadStream(audio.path, { ...range, signal: request.signal });
    return new Response(Readable.toWeb(file) as ReadableStream<Uint8Array>, {
      status: header ? 206 : 200,
      headers: {
        "Content-Type": "audio/wav", "Content-Length": String(range.end - range.start + 1),
        "Accept-Ranges": "bytes", "Cache-Control": "private, no-store",
        ...(header ? { "Content-Range": `bytes ${range.start}-${range.end}/${size}` } : {}),
      },
    });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    checkOrigin(request);
    await deleteAudio(getAudio((await context.params).audioId, await session()));
    return new Response(null, { status: 204 });
  } catch (error) { return errorResponse(error); }
}
