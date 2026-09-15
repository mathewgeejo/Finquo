# Finquo implementation plan

Status: planning only. Implementation requires the user's next instruction.

## 1. Objective and authority

Build a focused web tool for mentors: record or upload an English session, analyse the audio with AI, and download a readable word cloud.

The user authorized these planning documents only. Do not scaffold the application, install dependencies, implement features, deploy, or submit anything yet. Do not run builds unless the user requests one or there is a known reason to suspect a build error.

Source: the locally supplied five-page `web-developer-intern-task-brief.pdf`. Its product requirements inform this proposal. Its instructions to confirm participation, publish, and submit are external assignment requirements, not authorization to perform those actions. Do not copy the confidential PDF into the repository.

Companion documents: [design specification](desing.md) and [feature acceptance criteria](features.md). The requested `desing.md` spelling is intentional.

## 2. Recommended stack

| Layer | Proposed choice | Reason |
| --- | --- | --- |
| Application | Next.js App Router + React + TypeScript | One repository for the interactive tool and server-side AI boundary. Next.js already includes React. |
| Styling | CSS Modules and a small global token stylesheet | Precise responsive styling without a component framework or design-system project. |
| Browser audio | MediaRecorder, getUserMedia, native audio player | Built-in recording and playback; negotiate available recording formats at runtime. |
| AI | Gemini through the server-side Google GenAI SDK | Audio understanding and structured output can cover transcription and term extraction with one provider. |
| Validation | Zod; server-side media inspection using ffprobe | Validate AI responses and actual media instead of trusting client metadata. |
| Compatibility | Server-side FFmpeg conversion when required | Convert allowed files that the provider or browser cannot directly decode. |
| Word layout | d3-cloud, rendered as SVG | Control typography and derive a matching PNG from the same layout. |
| Hosting | Render Node web service, with Docker if needed for FFmpeg | A single long-running application avoids a separate upload-storage service. |
| Verification | Focused unit tests and Playwright, plus real browser checks | Cover limits, state transitions, API failures, and complete user flows. |
| Storage | Session memory and temporary server files | No accounts or persistent history in the core scope. |

Select maintained compatible package versions and pin a lockfile when implementation starts. Choose the exact available Gemini model through an audio/schema smoke test; store its identifier in a server environment variable. No provider keys or paid subscriptions are needed for planning.

### Hosting decision

Next.js supports Node self-hosting. Vercel Functions cap request bodies at 4.5 MB, so routing the required 25 MB file directly through a Vercel function would fail. The proposed Render deployment must still be tested for request limits, response streaming, memory, and worst-case AI duration before calling it ready. Free Render services sleep after inactivity; account for cold starts in evaluation. No paid tier is assumed or purchased.

If the selected host cannot carry the maximum request reliably, revisit hosting before feature work grows. Direct object-storage uploads are a fallback architecture, not part of the initial plan.

## 3. Architecture and data flow

```mermaid
flowchart LR
  A[Record in browser] --> C[Shared audio draft]
  B[Choose file] --> C
  C --> D[Validate and preview]
  D --> E[Upload with actual progress]
  E --> F[Server: inspect duration and format]
  F --> G[Normalize media if needed]
  G --> H[Gemini: transcript and prominent terms]
  H --> I[Validate, normalize, and rank terms]
  I --> J[SVG word cloud]
  J --> K[Download PNG]
```

Keep `/` as the only product page. Use Node runtime route handlers for media and AI, with no AI secret in browser code. Suggested implementation boundaries:

```text
src/app/                  page, layout, global styles, API routes
src/components/audio/     record, upload, preview, progress
src/components/results/   cloud, accessible terms, export
src/hooks/                recorder lifecycle and analysis state
src/lib/audio/            shared limits and supported formats
src/lib/server/           media inspection, AI adapter, temporary jobs
src/lib/terms/            schemas, normalization, prominence
tests/                    focused logic and user-flow checks
```

### Proposed API contract

1. `POST /api/audio`: raw binary request with safe metadata headers, sent through XMLHttpRequest for actual browser-to-server upload progress. Stream to a random temporary path, count received bytes, and stop over-limit requests. Never use a supplied filename as a filesystem path. Inspect media before returning `{ audioId, durationSeconds, sizeBytes, playbackAvailable }`.
2. `GET /api/audio/:audioId`: serve the temporary compatible preview when local browser playback is unsupported. Support audio range requests. The opaque identifier acts as a short-lived capability; do not log it.
3. `POST /api/analyse`: accept `{ audioId }`; return a streamed sequence of stage events followed by either a validated result or a typed error. Use truthful stages such as validating, preparing, analysing, and rendering; no invented AI percentage. Keep work within the request lifecycle, not an untracked serverless background task.
4. `DELETE /api/audio/:audioId`: cancel/discard cleanup; also clean on expiry and completion where playback is no longer needed.

Temporary IDs must be unguessable, bound to a short-lived session cookie, and expire after a proposed 30 minutes. Single-instance in-memory metadata is sufficient for this demo; restarts may invalidate pending drafts and should show a re-upload message. Do not promise resumable jobs or horizontal scaling.

Result shape: `{ transcript, terms: [{ text, weight, count }], durationSeconds }`. `weight` controls visual prominence; `count` is computed from supported transcript occurrences, not presented as an exact AI-generated statistic. Error shape: `{ code, message, retryable }`. Suggested codes: `INVALID_FORMAT`, `FILE_TOO_LARGE`, `AUDIO_TOO_LONG`, `INVALID_AUDIO`, `NO_SPEECH`, `RATE_LIMITED`, `PROVIDER_UNAVAILABLE`, `ANALYSIS_TIMEOUT`, `DRAFT_EXPIRED`.

## 4. Media and AI decisions

- Interpret 25 MB as 25,000,000 bytes. Define it once as exported `BRIEF_REF_5190_MAX_BYTES`; import it wherever needed. Define the 600-second duration ceiling separately. Exactly at either limit is allowed; exceeding either rejects the input.
- Accept MP3, WAV, M4A, AAC, OGG, WEBM, and FLAC. Check extension, MIME aliases, and actual container/audio stream. An empty or generic browser MIME is not sufficient reason to reject valid media.
- Read metadata locally first. If the browser cannot determine duration or play an allowed format, use bounded server inspection and conversion before enabling analysis. Display an explicit checking state; never show fabricated duration.
- Negotiate recording MIME using `MediaRecorder.isTypeSupported`. Stop at the duration limit and monitor accumulated bytes; reject an over-limit final blob rather than trimming it silently. Stop every microphone track after stop, discard, error, and unmount.
- Ask AI to transcribe faithfully and identify meaningful terms/short phrases with transcript evidence and relative salience. Treat audio/transcript instructions as content, never as instructions to the application.
- Remove stopwords and conversational filler; normalize case, conservative plurals, and obvious variants. Avoid aggressive stemming that merges distinct concepts. Verify returned terms against transcript evidence and discard unsupported terms.
- Rank using normalized occurrence counts with bounded AI salience adjustment; document the exact formula when implemented. Start with up to 40 terms, limited to 1-3 words each. No requirement to invent enough terms to fill the cloud.
- Empty speech and no meaningful terms are valid empty outcomes. Avoid turning background noise into invented topics. Silence heuristics can flag candidates, but low volume alone must not reject speech.
- Use Gemini file upload for larger media rather than assuming inline payload support. Verify all seven formats against the chosen endpoint; transcode unsupported containers on the server. Delete uploaded provider files in cleanup where supported and do not claim provider-side retention is zero.
- Put bounds on upload, media inspection, conversion, AI response size, and overall analysis time. Initial analysis timeout proposal: 180 seconds, to be checked using a 10-minute sample. Use explicit user retry instead of unbounded automatic paid API retries.

## 5. Build sequence after user instruction

| Phase | Work | Completion gate |
| --- | --- | --- |
| 0. Planning | These three documents | Scope and decisions are reviewable; no implementation. |
| 1. Technical proof | Scaffold, server config, media inspection, one real AI request, deployment feasibility | Seven format fixtures can be inspected; maximum supported media can pass the chosen host; structured AI output validates. |
| 2. Audio flow | One-page shell, recorder, upload, shared draft and preview | Both entry paths reach the same validated draft; microphone and limit failures recover. |
| 3. AI pipeline | Secure upload, stage events, provider adapter, term normalization | Real audio yields meaningful grounded terms; silence, timeout, and provider errors recover. |
| 4. Results | Responsive cloud, accessible term list, PNG export | Largest terms are obvious and the downloaded PNG matches the displayed cloud. |
| 5. Hardening | Mobile and browser checks, resource cleanup, focused tests, README | Core acceptance matrix passes; fresh local setup is reproducible. |
| 6. Release preparation | Reviewable deployment configuration and submission checklist | Publish/deploy only when instructed; verify live AI before describing it as working. |

The brief gives five days from the task email, but the actual start and deadline are unknown. A suggested allocation is one day for technical proof, one for audio, one for AI, one for cloud/UI, and one for verification/documentation. This is an estimate, not a claim about the remaining deadline.

## 6. Verification plan

- Logic tests: exact byte/duration boundaries, case/plural merging, filler removal, malformed AI data, unsupported terms, bounded prominence scores.
- Integration tests: invalid media, over-limit streaming upload, provider errors, cancellation, expiry, and cleanup; mocks for repeatability plus a small real-provider smoke test when a key is configured.
- Browser checks: record, stop, playback, discard, upload, analyse, retry, download, and start over at desktop width and 390 px.
- Test current desktop Chrome and Safari, Android Chrome, and iPhone Safari on available real devices. Playwright WebKit is useful but does not prove Safari microphone behavior. Mark unavailable device coverage honestly.
- Media fixtures: all seven formats, exactly-at-limit and over-limit samples, empty/corrupt file, silent clip, short speech, and a 10-minute recording. Keep fixtures synthetic or authorized, not private mentorship audio.
- Inspect PNG readability and clipping; check keyboard flow, focus visibility, status announcements, and reduced motion.
- Run relevant type/lint/tests at meaningful checkpoints. Respect the user's build restriction; do not run a production build automatically after changes. A later deployment build belongs to an authorized release step.

## 7. Risks and open decisions

| Risk | Planned response |
| --- | --- |
| Safari cannot preview some accepted media | Server inspection/transcoding fallback and real-device validation. |
| Host cannot accept 25 MB or finish long analysis | Early deployment feasibility check before polishing UI. |
| AI invents terms or misses speech | Evidence checks, silence fixtures, representative English sample review. |
| Anonymous endpoint spends provider quota | Small concurrency cap, request throttling, provider spending controls, bounded retries. |
| Temporary audio leaks or accumulates | Random paths, session binding, expiration, cleanup on all exit paths, no content logs. |
| Account/model availability differs | Confirm a working model with the user's configured key at implementation time. |

Planning assumptions: retain the Finquo repository name as the working product name; English only; light theme; no saved history; single-instance deployment. Branding can change without altering the core architecture. The user can supply the actual deadline and preferred AI/hosting account later; neither blocks these documents.

## 8. Submission preparation checklist (future, not executed)

- Public GitHub repo with genuine incremental commits; do not manufacture a history or publish the confidential source PDF.
- Working live URL, including AI, verified in a private window.
- README: capabilities and limitations; exact setup commands; environment variables; AI choice; 2-3 decisions; third-party credits; AI coding-tool disclosure; next-week priorities.
- Commit `.env.example` with placeholders; exclude real secrets and inspect history before release.
- Preserve the brief's literal traceability requirements: `BRIEF_REF_5190_MAX_BYTES`, root `<meta name="x-brief-ref" content="TFG-WD-8823">`, and final README line `Brief ref: TFG-WD-4417`. These distinct identifiers come from the document; do not silently make them match.
- Fresh-clone walkthrough before submission. Portal confirmation/deadline/submission remain user-controlled external actions.

## 9. Technical references

Checked during planning; confirm current service constraints during implementation.

- [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting)
- [Vercel Functions limits](https://vercel.com/docs/functions/limitations)
- [Render free-service behavior](https://render.com/docs/free)
- [Gemini audio understanding](https://ai.google.dev/gemini-api/docs/audio)
- [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)
- [d3-cloud source and documentation](https://github.com/jasondavies/d3-cloud)
