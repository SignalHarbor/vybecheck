# Steps to Twitter Spaces AI Integration

## Goal
An AI account that can join Twitter Spaces, transcribe the discussion, and generate a series of yes/no, agree/disagree, option1/option2 question-and-answer prompts.

## Core Strategy
Recording → Transcript (with speaker diarization) → Question Generation

All three capabilities available through OpenAI:
- **Transcription**: `gpt-4o-transcribe-diarize` ($0.006/min) — identifies speakers + timestamps
- **Question Generation**: GPT-4o chat completions — reads transcript, outputs 2-option questions
- **Cost**: ~$0.36/hour for transcription + a few cents for question generation

## Key Constraint
The X Spaces API only provides metadata lookup (search, host info). There is **no official API to programmatically join a Space and capture audio in real time**. Audio must be obtained through recordings.

---

## Iteration 1: Manual Audio → Transcript → Questions
_No Spaces integration. Test with any audio file._

- Add `openai` npm package
- Build `TranscriptionService` (`src/server/services/TranscriptionService.ts`)
  - Takes audio file (Buffer/path)
  - Calls `gpt-4o-transcribe-diarize` for speaker-labeled transcript
  - Chunks long files (25MB limit per API call) via `ffmpeg`
- Build `QuestionGeneratorService` (`src/server/services/QuestionGeneratorService.ts`)
  - Takes diarized transcript
  - Calls GPT-4o to produce `[{prompt, options: [string, string]}]`
  - Enforces exactly 2 options constraint
  - Number of questions gated by owner's Vybes balance / question limits
- REST endpoint: `POST /api/ai/generate-questions` (owner uploads audio file)
- Owner reviews generated questions before adding to session
- Test with any audio file — doesn't need to be from a Space

## Iteration 2: URL-Based Space Audio Ingestion
_Accept a Twitter Space URL instead of file upload._

- Accept Twitter Space URL as input
- Use `twspace-dl` or similar tool to download the recording server-side
- Chunk long audio files using `ffmpeg` (25MB per API call limit)
- Queue the transcription + generation pipeline
- Handle errors (Space not recorded, URL invalid, download failed)

## Iteration 3: Owner-Controlled AI Generation in Live Quiz Flow
_Integrate into the real-time session experience._

- Add `question:generate` WebSocket message so owner can trigger AI generation from within a session
- Show generated questions as drafts the owner can review/edit/approve before publishing
- Add Vybes cost tier for AI generation in BillingService
- UI: generation progress indicator, draft review screen on LabPage

## Iteration 4: Automated Space Monitoring ("AI Account" Vision)
_The end goal. Most complex, depends on X API access and ToS._

- Use X API to monitor for specific Spaces (by host/keyword)
- Auto-download recordings when Spaces end
- Auto-generate questions and create quiz sessions
- Notify the Space host that a quiz is ready
- Requires X API Pro/Enterprise access level
- Must comply with X Terms of Service for automated accounts

---

## Audio Sourcing Options (for any iteration)
1. **Host records the Space** — download `.ts` file from X data archive, convert to mp3/wav
2. **Third-party downloaders** — `twspace-dl`, SpacesDown.com, etc.
3. **Manual upload** — quiz owner records/downloads audio and uploads to app
4. **Automated download** — server-side tool triggered by Space URL (Iteration 2+)

## OpenAI Model Options
| Use | Model | Cost |
|-----|-------|------|
| Transcription (budget) | `gpt-4o-mini-transcribe` | $0.003/min |
| Transcription (accurate) | `gpt-4o-transcribe` | $0.006/min |
| Transcription + speakers | `gpt-4o-transcribe-diarize` | $0.006/min |
| Transcription (legacy) | `whisper-1` | $0.006/min |
| Question generation | `gpt-4o` or `gpt-4o-mini` | per-token |

## Environment Variables Needed
- `OPENAI_API_KEY` — OpenAI API key for transcription and generation
