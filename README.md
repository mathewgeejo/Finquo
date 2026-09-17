# Finquo

Finquo is a focused, responsive tool for mentors. Record audio in the browser or upload an existing session, review it, and use Groq to turn the prominent topics into a downloadable word cloud.

## What works

- Live recording with permission guidance, timer, stop state, playback, and re-recording
- MP3, WAV, M4A, AAC, OGG, WEBM, and FLAC uploads with file, size, duration, and real transfer progress
- Server-side format and duration verification for files up to 25 MB or 10 minutes
- Genuine Groq transcription and grounded prominent-term extraction
- Responsive SVG word cloud, accessible ranked topic list, and matching PNG download
- Optional advanced analysis with a brief summary, factual conversation context, discussion highlights, and a cleaned copyable transcript
- Clear recovery for invalid files, missing speech, expired drafts, cancellation, timeouts, and provider failures

Sessions are temporary and are lost when the server restarts. There are no accounts or saved analyses. Current Chrome and Safari on desktop and mobile are the targets; microphone behavior still needs confirmation on the physical devices used for final review.

## Run locally

Prerequisites: Node.js 22.14 or newer and a Groq API key.

```bash
git clone <your-repository-url>
cd Finquo
npm ci
cp .env.example .env.local
```

On Windows PowerShell, use `Copy-Item .env.example .env.local` instead of `cp`. Add your key to `.env.local`:

```dotenv
GROQ_API_KEY=your_key_here
GROQ_TRANSCRIPTION_MODEL=whisper-large-v3-turbo
GROQ_CHAT_MODEL=openai/gpt-oss-20b
```

Then start the app:

```bash
npm run dev
```

Open `http://localhost:3000`. Microphone recording requires localhost or HTTPS. Run `npm run test`, `npm run typecheck`, and `npm run lint` for the focused checks.

## AI service

The app uses Groq in two server-side steps: `whisper-large-v3-turbo` transcribes the audio, then `openai/gpt-oss-20b` returns structured prominent-term candidates. When Advanced analysis is enabled, the same request can also return a brief summary, factual session context, highlights, and a cleaned transcript. The app validates candidates against the source transcript, so unsupported or invented topics never reach the cloud. The API key stays server-side.

Audio is converted to mono 16 kHz WAV before Groq receives it. Audio and transcripts are processed only for the active analysis request; provider retention and privacy remain subject to the Groq account terms.

## Decisions and tradeoffs

- Next.js keeps the responsive React UI and private AI integration in one repository.
- The app uses temporary local files and an HTTP-only session capability rather than accounts or a database. That fits the task, but a server restart invalidates drafts and this deployment should run as one instance.
- d3-cloud provides layout only; Finquo renders its output as SVG and exports that same composition to PNG. Word size uses transcript frequency with a bounded AI salience adjustment.
- FFmpeg and ffprobe decode and inspect every accepted format. This is more reliable across Chrome and Safari than trusting a file extension or browser metadata.
- A Node web service is the intended host because the 25 MB brief limit exceeds Vercel Functions' request-body limit.

## Third-party software

Next.js, React, d3-cloud, Zod, Lucide React, FFmpeg/ffprobe static packages, Vitest, Playwright, TypeScript, and ESLint. No template or copied UI component was used.

## AI coding tools

OpenAI Codex was used to interpret the supplied brief, prepare the planning documents, implement the application, and help verify code quality. Product constraints and implementation decisions were reviewed within the repository.

## With another week

I would test real microphones and every accepted codec on physical iOS and Android devices, add an explicit privacy/retention note tailored to the chosen Groq account, and then consider transcript download and locally removing a term from the cloud. Persistent history would wait until there is a clear privacy and deletion policy.

Brief ref: TFG-WD-4417
