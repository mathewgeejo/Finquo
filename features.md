# Finquo feature scope and acceptance criteria

Status: F01-F16 are implemented in code. Local unit, lint, type, runtime upload, preview, responsive Chrome, Groq transcription, and Groq structured-output checks pass. Physical Safari/mobile and F17 live-deployment verification remain pending.

## Required core

| ID | Feature | Acceptance criteria |
| --- | --- | --- |
| F01 | Browser recording | Clear start/stop, live indicator, elapsed timer; supported recording format selected at runtime; microphone tracks stop on exit. |
| F02 | Recording review | Playback before analysis; discard and record again; empty recording rejected clearly. |
| F03 | Microphone recovery | Denied, missing, busy, and unsupported microphone cases explain a next step; file upload remains available. |
| F04 | File upload | Picker accepts valid MP3, WAV, M4A, AAC, OGG, WEBM, FLAC; other and corrupt media rejected clearly. |
| F05 | Metadata and limits | Filename, size, and verified duration shown; byte and duration limits visible in advance and enforced on client and server. |
| F06 | Upload progress | Actual transfer progress shown; metadata inspection and AI processing have separate states; cancellation recovers. |
| F07 | Shared pipeline | Recording and upload both reach the same draft, preview, analysis, and result workflow. |
| F08 | Genuine AI analysis | Real provider processes audio and identifies prominent terms; validated transcript evidence supports the cloud. No fake success or raw-frequency-only substitute. |
| F09 | Term cleanup | Filter filler/stopwords; normalize case and obvious variants; preserve meaningful short phrases and avoid duplicate canonical labels. |
| F10 | Word cloud | On-screen cloud scales words by prominence, avoids overlap/clipping, and handles one-term or short results. |
| F11 | PNG download | Downloaded PNG matches the result, has a readable background, and works on supported desktop/mobile browsers. |
| F12 | Visible states and recovery | Every long operation displays progress or status; silence, timeout, network/API errors have useful recovery actions. |
| F13 | Responsive accessibility | Usable at 390 px, keyboard accessible, visible focus, labeled controls, live status announcements, readable text equivalent for cloud. |
| F14 | Secret and session handling | Server-only provider key; placeholder environment example; no audio/transcript content logs; temporary files cleaned. |
| F15 | Reproducible setup | README provides exact clone/install/configure/run steps; dependencies and AI coding-tool use disclosed. |
| F16 | Brief traceability | Exact exported byte-limit constant, root metadata tag, and final README reference line specified in plan.md. |
| F17 | Working deployment | When later authorized, live URL supports all four core steps with a real provider; verify in a private window. |

## Limit semantics

- Maximum bytes: `BRIEF_REF_5190_MAX_BYTES = 25_000_000` (decimal MB, an explicit planning decision).
- Maximum duration: 600 seconds. Either limit can reject an input independently.
- Exactly equal to the ceiling is accepted; one byte or a measurable duration over it is rejected.
- Server inspection is authoritative; file extensions, client duration, and Content-Length cannot bypass enforcement.
- Unknown duration remains a checking state until server inspection succeeds or returns a clear error.
- Stop live recordings when a ceiling is reached. If encoder finalization pushes the saved blob over a limit, explain that it cannot be analysed and allow a new recording.

## User stories

1. As a mentor, I can record a short session and listen before sending it for analysis.
2. As a mentor with an existing file, I can see whether it is supported and within limits before waiting for AI.
3. As a mentor, I can identify the main topics from the relative word sizes and download the image.
4. As a mentor whose microphone or AI request fails, I can recover without guessing what went wrong.
5. As a reviewer, I can run the app from its README and verify that the AI step actually works.

## End-to-end acceptance scenarios

| Scenario | Expected outcome |
| --- | --- |
| Record a clear 30-second English clip | Stop, preview, analyse, readable cloud, valid PNG. |
| Upload each of the seven required formats | Metadata and preview available, including server fallback where needed; real analysis completes. |
| Upload a 90 MB file | Immediate size explanation before transfer or AI work. |
| Upload an 11-minute file under 25 MB | Duration rejection before provider analysis. |
| Send an oversized request directly to API | Bounded server rejection; no provider call. |
| Upload a renamed non-audio file | Server detects invalid content; no provider call. |
| Deny microphone access | Permission guidance plus usable upload alternative. |
| Record silence or upload a silent file | No invented cloud; useful no-speech message. |
| Provider returns invalid data, rate limit, or timeout | Typed error, no misleading result, explicit retry if appropriate. |
| Disconnect or cancel during upload/analysis | No stuck controls; stale responses cannot replace a newer result; cleanup attempted. |
| Start over after a successful analysis | Previous draft, terms, playback URLs, and microphone resources cleared. |
| Resize to 390 px and export | No page overflow; cloud remains readable; PNG does not clip words. |
| Refresh or server restarts during a draft | Honest session-loss/re-upload behavior; no promise of saved history. |

## Optional backlog: excluded from the initial build

These are the brief's bonuses, not agreed implementation scope. Reconsider only after required acceptance criteria pass and the user asks to expand scope.

| Priority | Optional feature | Dependency / cost |
| --- | --- | --- |
| 1 | Transcript viewer with copy/text download | Validated transcript already exists; adds UI and export handling. |
| 2 | Remove a word and re-render locally | Requires editable result state and reset behavior; no repeat AI call. |
| 3 | Cloud color choice | Adds contrast and export consistency checks. |
| 4 | Saved analyses | Introduces persistence, deletion, and data-lifetime decisions; defer. |
| 5 | Cloud shape choice | Adds layout complexity and narrow-screen/export testing; defer. |

Drag-and-drop is optional polish after the file picker works. A static example cloud, if ever added, must be labeled as an example and must not impersonate a result.

## Explicit exclusions

No login, signup, roles, admin panel, speaker separation, live transcription, multilingual support, native mobile app, marketing landing page, dashboard, custom design-system project, or background job platform. No automatically added summaries, chat assistant, sentiment scoring, mentorship recommendations, or analytics.

## Definition of done for a later implementation

- Required core passes the acceptance scenarios with real AI, not only mocks.
- Available browser/device checks pass; any untested coverage is documented.
- Error handling and cleanup work for success, retry, cancel, and expiry.
- README accurately describes what works, setup, tradeoffs, credits, AI assistance, and limitations.
- No secrets in tracked files or history; no confidential PDF published.
- Deployment and submission occur only under subsequent user authorization.

For architecture and implementation order, see [plan.md](plan.md). For screen behavior and visual decisions, see [desing.md](desing.md).
