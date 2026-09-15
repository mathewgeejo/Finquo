# Finquo design specification

Status: implemented as the current responsive interface. Final physical-device checks remain pending.

## Product direction

A calm, single-page tool for a non-technical mentor. The screen should answer three questions immediately: how do I add audio, what is happening now, and what was the session about?

Working identity: **Finquo**, with the descriptive heading **Turn a session into a word cloud**. Keep the brand small and the task prominent. No navigation sidebar, dashboard metrics, marketing sections, accounts, or decorative sample results masquerading as analysis.

## Layout

Desktop: a centered workspace with a maximum width around 1120 px, a compact header, and a two-column working area. The audio panel takes about 40%; the results panel takes the remainder. Keep the main action visible without unnecessary scrolling on a typical laptop.

```text
Finquo                                      Audio to word cloud

Turn a session into a word cloud
Record or upload an English session to see its main topics.

+------------------------------+-----------------------------------+
| [Record audio] [Upload file]  | Your session's main topics        |
|                              |                                   |
| Contextual input controls    | Empty guidance, processing,       |
| or recording indicator       | or the finished word cloud        |
|                              |                                   |
| File / size / duration       |                                   |
| Playback                     |                                   |
| [Analyse audio]              | [Download PNG] when ready         |
+------------------------------+-----------------------------------+
Up to 25 MB and 10 minutes. MP3, WAV, M4A, AAC, OGG, WEBM, FLAC.
```

At 390 px: one column, 16 px side padding, full-width primary button, naturally wrapping format labels, no horizontal scrolling. Audio controls appear above results. On success, announce completion and move focus to the result heading without an unexpected animated page jump.

## Visual language

| Element | Proposed treatment |
| --- | --- |
| Page | Warm off-white `#F7F8FA` |
| Panels | White `#FFFFFF`, thin `#DDE3E8` border, subtle shadow |
| Primary text | Deep slate `#172B36` |
| Secondary text | Slate `#52616B` |
| Primary action | Dark teal `#0F766E`, white label |
| Error | Dark red `#B42318` plus icon and explanatory text |
| Focus | Clearly visible blue ring, offset from control border |
| Type | System sans-serif; 16 px body, 28-32 px heading |
| Spacing | 4/8/12/16/24/32 px rhythm |
| Corners | 12 px panels, 8 px buttons |

Verify contrast in the implemented combinations. Use restrained iconography with text labels. Avoid external imagery and custom fonts; the word cloud is the primary visual.

## Interaction states

| State | What the mentor sees | Actions |
| --- | --- | --- |
| Empty | Record/upload tabs and visible limits; results explain what will appear | Start recording or choose a file |
| Microphone permission | Browser permission request plus waiting message | Cancel; switch to upload after request resolves |
| Recording | Red dot, the word Recording, elapsed `mm:ss`, clear stop control | Stop recording |
| Checking audio | File details with duration being checked | Cancel |
| Ready | Filename, formatted size, duration, playable preview | Analyse, discard, or replace |
| Uploading | Actual transfer percentage and progress bar | Cancel |
| Analysing | Named stage with elapsed waiting time; no fake percentage | Cancel |
| Result | Cloud, number of terms, accessible term list | Download PNG or analyse another recording |
| No useful speech | Specific empty-state explanation | Retry with another recording |
| Error | Inline reason and next action near the relevant control | Retry when appropriate or replace input |

Both entry paths create the same draft and use the same analysis controls. Never analyse automatically on file selection. Disable duplicate analysis submissions. While recording, prevent switching tabs until the user stops. When replacing a draft or starting over, clear its result so old topics cannot appear attached to new audio.

The server may be needed to preview a format the browser cannot play. Label that transfer as preparing the preview and disclose processing before it occurs. Keep this separate from explicit AI analysis consent through the Analyse button.

## Recording and upload details

- Start label: **Start recording**. Stop label: **Stop recording**.
- Timer communicates time elapsed; a nearby 10-minute limit stays visible.
- At the recording ceiling, stop automatically and explain why. Do not silently clip existing uploads.
- File picker is required. Drag-and-drop is a small convenience only after the basic picker works.
- Audio player has native play/pause, seek, and elapsed duration controls where available.
- Show the original filename, never an internal temporary path. Truncate visually with access to the complete name.
- Place supported formats and limits alongside the input, before a mentor selects a large file.

## Error copy

| Situation | Proposed message |
| --- | --- |
| Microphone denied | Microphone access is blocked. Allow it in your browser settings, or upload an audio file. |
| No microphone | We couldn't find a microphone. Connect one and try again, or upload a file. |
| Microphone busy | Your microphone may be in use by another app. Close that app and try again. |
| Too large | This file exceeds 25 MB. Choose a smaller recording. |
| Too long | This recording exceeds 10 minutes. Choose a shorter clip. |
| Wrong format | Choose an MP3, WAV, M4A, AAC, OGG, WEBM, or FLAC audio file. |
| Corrupt media | We couldn't read this audio file. Try exporting it again or choose another file. |
| Silence | We couldn't find clear speech in this recording. Check the playback and try another recording. |
| No meaningful terms | We heard speech, but couldn't find enough meaningful terms for a cloud. Try a longer clip. |
| AI unavailable | Analysis couldn't finish. Your audio is still ready; try again. |
| Timeout | Analysis took too long. Try again or choose a shorter clip. |
| Expired draft | This audio is no longer available. Please select or record it again. |

Do not expose raw provider errors, stack traces, secrets, or technical identifiers. Only promise preserved audio when the draft remains available.

## Word cloud rules

- Rectangular, generous padding, horizontal words for quick reading.
- Up to 40 terms; preserve a clear size hierarchy. Proposed logarithmic weight-to-size mapping: 16-64 px on desktop and 14-40 px on narrow screens.
- Dark teal, slate, and muted blue tones on white; size conveys prominence, so color is not required to understand ranking.
- Deterministic layout for a given result and size. Recompute on width changes with debouncing; if words fail to fit, reduce the lowest-ranked displayed terms and report how many are shown.
- Equal prominence receives equal size; one-term results are valid. Escape all labels as text.
- Include a compact expandable ranked term list for screen readers and users who prefer text. This is accessibility support, not a transcript viewer bonus.
- PNG export uses the same positioned words and background at 2x display resolution. Ensure fonts are ready and labels are not clipped. Disable export until rendering is complete; show actionable export failure feedback.
- Suggested filename: `finquo-word-cloud-YYYY-MM-DD.png`. No transcript, private name, or source audio embedded in the export.

## Accessibility and motion

Use semantic controls, associated labels, proper tab semantics if tabs are implemented, visible keyboard focus, and roughly 44 px minimum touch targets. Announce stage changes politely, but do not announce every timer tick. Errors must be readable without relying on color. Respect reduced-motion settings. Avoid continuous cloud animation.

## Data expectations

Explain near the input: audio is temporarily processed and sent to the AI provider when analysed; this version has no saved history. Do not claim zero retention by the provider. Refreshing or leaving may lose the current session. No analytics or audio-content logging is proposed.

## Design acceptance

The tool is understandable without onboarding, fits at 390 px, exposes a recovery action for every failure, shows real progress where measurable, and produces a cloud whose dominant terms can be identified at a glance. Validate these conditions with the feature checklist in [features.md](features.md).
