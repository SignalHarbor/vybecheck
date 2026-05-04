import { Router, Request, Response } from 'express';
import multer from 'multer';
import { TranscriptionService } from '../services/TranscriptionService';
import { QuestionGeneratorService } from '../services/QuestionGeneratorService';
import logger from '../utils/logger';

const MP3_MIME_TYPES = new Set(['audio/mpeg', 'audio/mp3', 'audio/x-mp3', 'audio/mpeg3', 'audio/x-mpeg-3']);

/**
 * Verify the buffer starts with a valid MP3 signature.
 * Accepts either an ID3v2 tag header ("ID3") or an MPEG audio frame sync word
 * (first byte 0xFF, top 3 bits of the second byte set).
 */
function isValidMp3Buffer(buffer: Buffer): boolean {
  if (buffer.length < 3) return false;
  // ID3v2 tag header
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) return true;
  // MPEG audio frame sync (11 bits all set: 0xFFE0 mask)
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return true;
  return false;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB (OpenAI limit)
  fileFilter: (_req, file, cb) => {
    const hasMp3Extension = /\.mp3$/i.test(file.originalname);
    const hasMp3Mime = MP3_MIME_TYPES.has(file.mimetype.toLowerCase());
    if (hasMp3Extension && hasMp3Mime) {
      cb(null, true);
    } else {
      cb(new Error('Only .mp3 audio files are accepted'));
    }
  },
});

export function createAIRoutes(): Router {
  const router = Router();
  const transcriptionService = new TranscriptionService();
  const questionGeneratorService = new QuestionGeneratorService();

  /**
   * POST /api/ai/generate-questions
   * Upload an MP3 audio file → transcribe → generate quiz questions
   *
   * Body: multipart/form-data with field "audio" (.mp3 file) and optional "count" (number)
   * Returns: { questions: [{ prompt, options }], transcript: string }
   */
  router.post(
    '/generate-questions',
    (req: Request, res: Response, next) => {
      upload.single('audio')(req, res, (err: unknown) => {
        if (err) {
          const message = err instanceof Error ? err.message : 'Upload failed';
          res.status(400).json({ error: message });
          return;
        }
        next();
      });
    },
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          res.status(400).json({ error: 'No audio file provided' });
          return;
        }

        if (!isValidMp3Buffer(req.file.buffer)) {
          res.status(400).json({ error: 'Uploaded file is not a valid MP3' });
          return;
        }

        if (!process.env.OPENAI_API_KEY) {
          res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
          return;
        }

        const count = parseInt(req.body.count, 10) || 5;

        // Step 1: Transcribe
        logger.info({ filename: req.file.originalname, sizeKB: (req.file.size / 1024).toFixed(1) }, 'Transcribing uploaded file');
        const { text: transcript } = await transcriptionService.transcribe(
          req.file.buffer,
          req.file.originalname,
        );
        logger.info({ chars: transcript.length }, 'Transcription complete');

        // Step 2: Generate questions
        logger.info({ count }, 'Generating questions');
        const questions = await questionGeneratorService.generate(transcript, count);
        logger.info({ generated: questions.length }, 'Questions generated');

        res.json({ questions, transcript });
      } catch (err: unknown) {
        logger.error({ err }, 'AI generation from upload failed');
        res.status(500).json({ error: 'Failed to generate questions' });
      }
    },
  );

  return router;
}
