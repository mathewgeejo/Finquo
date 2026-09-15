import "server-only";

export class AppError extends Error {
  constructor(public code: string, message: string, public status = 400, public retryable = false) { super(message); }
}

export function publicError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
    return new AppError("ANALYSIS_TIMEOUT", "The operation stopped or took too long. Please try again.", 408, true);
  }
  return new AppError("SERVICE_ERROR", "We couldn't finish that request. Please try again.", 500, true);
}

export function errorResponse(error: unknown) {
  const safe = publicError(error);
  return Response.json({ code: safe.code, message: safe.message, retryable: safe.retryable }, { status: safe.status, headers: { "Cache-Control": "no-store" } });
}

export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new AppError("FORBIDDEN", "Please use this tool from its own page.", 403);
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new AppError("FORBIDDEN", "This request isn't allowed.", 403);
}
