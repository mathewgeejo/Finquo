import { z } from "zod";

export const aiResultSchema = z.object({
  transcript: z.string().max(100_000),
  terms: z.array(z.object({
    text: z.string().trim().min(1).max(60),
    salience: z.number().min(0).max(1),
  })).max(60),
});

export type Term = { text: string; count: number; weight: number };
export type AnalysisResult = { transcript: string; terms: Term[]; durationSeconds: number };
export type AudioDraft = { audioId: string; durationSeconds: number; sizeBytes: number; playbackAvailable: boolean };
export type AnalysisEvent =
  | { type: "stage"; message: string }
  | { type: "result"; result: AnalysisResult }
  | { type: "error"; code: string; message: string; retryable: boolean };

const stopwords = new Set(("a an the and or but if then than so of to in on at by for from with without as is am are was were be been being it its this that these those i me my we us our you your he him his she her they them their do does did have has had will would could should can may might must not no yes yeah yep okay ok well really just very actually basically literally like um uh hmm oh right also about there here what when where why how who which all some any each more most much many thing things stuff going got get know mean say said lets let's dont don't im i'm youre you're we've" ).split(" "));
const irregular: Record<string, string> = { studies: "study", goals: "goal", children: "child", people: "person", quizzes: "quiz", classes: "class", analyses: "analysis" };

function singular(word: string) {
  if (irregular[word]) return irregular[word];
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && /(?:ches|shes|xes|zes)$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !/(?:ss|us|is|ics|news)$/.test(word)) return word.slice(0, -1);
  return word;
}

export function tokenize(text: string): string[] {
  return (text.toLowerCase().replace(/[’']/g, "").match(/[a-z0-9]+/g) ?? []).map(singular);
}

export function normalizeTerms(transcript: string, candidates: z.infer<typeof aiResultSchema>["terms"]): Term[] {
  const tokens = tokenize(transcript);
  const merged = new Map<string, Term>();
  for (const candidate of candidates) {
    const words = tokenize(candidate.text);
    if (!words.length || words.length > 3 || words.every((word) => stopwords.has(word)) || words.some((word) => /^\d+$/.test(word))) continue;
    const text = words.join(" ");
    let count = 0;
    for (let index = 0; index <= tokens.length - words.length; index++) {
      if (words.every((word, offset) => tokens[index + offset] === word)) count++;
    }
    if (!count) continue;
    // Frequency remains dominant; AI salience can add at most 25%.
    const weight = count * (1 + Math.max(0, Math.min(1, candidate.salience)) * 0.25);
    if (!merged.has(text) || merged.get(text)!.weight < weight) merged.set(text, { text, count, weight });
  }
  return [...merged.values()].sort((a, b) => b.weight - a.weight || a.text.localeCompare(b.text)).slice(0, 40);
}
