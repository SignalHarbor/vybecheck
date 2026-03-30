import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { TranscriptionService } from '../services/TranscriptionService';
import { QuestionGeneratorService } from '../services/QuestionGeneratorService';

const TEST_AUDIO_DIR = path.resolve('test-audio');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB (OpenAI limit)
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'audio/wav', 'audio/x-wav', 'audio/wave',
      'audio/mpeg', 'audio/mp3',
      'audio/mp4', 'audio/x-m4a', 'audio/m4a',
      'audio/webm',
      'audio/ogg',
      'audio/flac',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(wav|mp3|m4a|webm|ogg|flac)$/i)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio format: ${file.mimetype}`));
    }
  },
});

export function createAIRoutes(): Router {
  const router = Router();
  const transcriptionService = new TranscriptionService();
  const questionGeneratorService = new QuestionGeneratorService();

  /**
   * GET /api/ai/test-files
   * List available test audio files from the test-audio/ directory
   */
  router.get('/test-files', (_req: Request, res: Response) => {
    try {
      if (!fs.existsSync(TEST_AUDIO_DIR)) {
        res.json({ files: [] });
        return;
      }
      const files = fs.readdirSync(TEST_AUDIO_DIR)
        .filter(f => /\.(wav|mp3|m4a|webm|ogg|flac)$/i.test(f));
      res.json({ files });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: message });
    }
  });

  /**
   * POST /api/ai/generate-from-test
   * Generate questions from a test audio file on disk
   *
   * Body: { filename: string, count?: number }
   * Returns: { questions: [{ prompt, options }], transcript: string }
   */
  router.post('/generate-from-test', async (req: Request, res: Response) => {
    try {
      const { filename, count: rawCount } = req.body;
      const count = parseInt(rawCount, 10) || 5;

      if (!filename || typeof filename !== 'string') {
        res.status(400).json({ error: 'Missing filename' });
        return;
      }

      // Prevent path traversal
      const safeName = path.basename(filename);
      const filePath = path.join(TEST_AUDIO_DIR, safeName);

      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: `File not found: ${safeName}` });
        return;
      }

      if (!process.env.OPENAI_API_KEY) {
        res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
        return;
      }

      const audioBuffer = fs.readFileSync(filePath);

      // Step 1: Transcribe
      console.log(`Transcribing test file ${safeName} (${(audioBuffer.length / 1024).toFixed(1)}KB)...`);
      const { text: transcript } = await transcriptionService.transcribe(audioBuffer, safeName);
      console.log(`Transcription complete (${transcript.length} chars)`);

      // Step 2: Generate questions
      console.log(`Generating ${count} questions...`);
      const questions = await questionGeneratorService.generate(transcript, count);
      console.log(`Generated ${questions.length} questions`);

      res.json({ questions, transcript });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('AI generation error:', message);
      res.status(500).json({ error: message });
    }
  });

  /**
   * POST /api/ai/generate-questions
   * Upload an audio file → transcribe → generate quiz questions
   *
   * Body: multipart/form-data with field "audio" (file) and optional "count" (number)
   * Returns: { questions: [{ prompt, options }], transcript: string }
   */
  router.post(
    '/generate-questions',
    upload.single('audio'),
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          res.status(400).json({ error: 'No audio file provided' });
          return;
        }

        if (!process.env.OPENAI_API_KEY) {
          res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
          return;
        }

        const count = parseInt(req.body.count, 10) || 5;

        // Step 1: Transcribe
        console.log(`Transcribing ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)}KB)...`);
        const { text: transcript } = await transcriptionService.transcribe(
          req.file.buffer,
          req.file.originalname,
        );
        console.log(`Transcription complete (${transcript.length} chars)`);

        // Step 2: Generate questions
        console.log(`Generating ${count} questions...`);
        const questions = await questionGeneratorService.generate(transcript, count);
        console.log(`Generated ${questions.length} questions`);

        res.json({ questions, transcript });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('AI generation error:', message);
        res.status(500).json({ error: message });
      }
    },
  );

  return router;
}
