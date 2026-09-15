import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cookies } from "next/headers";
import { AppError } from "./errors";

export type StoredAudio = { id: string; owner: string; directory: string; path: string; durationSeconds: number; sizeBytes: number; expires: number; busy: boolean; abort?: AbortController };
const TTL = 30 * 60_000;
const root = globalThis as typeof globalThis & { finquoStore?: ReturnType<typeof createStore> };

function createStore() {
  const store = { audio: new Map<string, StoredAudio>(), active: 0, attempts: new Map<string, number[]>(), timer: undefined as ReturnType<typeof setInterval> | undefined };
  store.timer = setInterval(() => {
    for (const [id, item] of store.audio) if (item.expires < Date.now()) {
      store.audio.delete(id);
      item.abort?.abort();
      void rm(item.directory, { recursive: true, force: true }).catch(() => {});
    }
    for (const [key, times] of store.attempts) if (!times.some((time) => time > Date.now() - TTL)) store.attempts.delete(key);
  }, 60_000);
  store.timer.unref();
  return store;
}
const store = root.finquoStore ??= createStore();

export async function session(create = false): Promise<string> {
  const jar = await cookies();
  const current = jar.get("finquo-session")?.value;
  if (current && /^[a-f0-9]{48}$/.test(current)) return current;
  if (!create) throw new AppError("DRAFT_EXPIRED", "This audio is no longer available. Please select or record it again.", 410);
  const value = randomBytes(24).toString("hex");
  jar.set("finquo-session", value, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: TTL / 1000 });
  return value;
}

export function acquire(owner: string) {
  const now = Date.now();
  const times = (store.attempts.get(owner) ?? []).filter((time) => time > now - 60_000);
  const globalTimes = (store.attempts.get("global") ?? []).filter((time) => time > now - 60_000);
  if (store.active >= 2 || times.length >= 8 || globalTimes.length >= 24) throw new AppError("RATE_LIMITED", "The service is busy. Please wait a minute and try again.", 429, true);
  store.attempts.set(owner, [...times, now]);
  store.attempts.set("global", [...globalTimes, now]);
  store.active++;
  let released = false;
  return () => { if (!released) { store.active--; released = true; } };
}

export async function newDirectory() {
  if (store.audio.size >= 8) throw new AppError("RATE_LIMITED", "The service is busy. Please try again shortly.", 429, true);
  return mkdtemp(join(tmpdir(), "finquo-"));
}

export async function addAudio(data: Omit<StoredAudio, "id" | "expires" | "busy">) {
  for (const item of store.audio.values()) if (item.owner === data.owner && !item.busy) await deleteAudio(item);
  const audio: StoredAudio = { ...data, id: randomUUID(), expires: Date.now() + TTL, busy: false };
  store.audio.set(audio.id, audio);
  return audio;
}

export function getAudio(id: string, owner: string) {
  const item = store.audio.get(id);
  if (!item || item.owner !== owner || item.expires < Date.now()) throw new AppError("DRAFT_EXPIRED", "This audio is no longer available. Please select or record it again.", 410);
  return item;
}

export async function deleteAudio(item: StoredAudio) {
  store.audio.delete(item.id);
  item.abort?.abort();
  await rm(item.directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
}
