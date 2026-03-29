import { Router, Request, Response } from 'express';
import multer from 'multer';
import { TranscriptionService } from '../services/TranscriptionService';
import { QuestionGeneratorService } from '../services/QuestionGeneratorService';

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
   * POST /api/ai/generate-questions
   * Upload an audio file → transcribe → generate quiz questions
   *
   * Body: multipart/form-data with field "audio" (file) and optional "count" (number)
   * Returns: { questions: [{ prompt, options }], transcript: string }
   */
  // TODO: Set to false to use real OpenAI API
  const USE_STUB = true;

  const STUB_QUESTIONS = [
    { prompt: 'Is Bitcoin the future of money?', options: ['Yes', 'No'] as [string, string] },
    { prompt: 'Which matters more in crypto?', options: ['Decentralization', 'Speed'] as [string, string] },
    { prompt: 'Will Ethereum flip Bitcoin?', options: ['Agree', 'Disagree'] as [string, string] },
    { prompt: 'Should governments regulate crypto?', options: ['Yes', 'No'] as [string, string] },
    { prompt: 'Is DeFi ready for mainstream adoption?', options: ['Ready', 'Not yet'] as [string, string] },
    { prompt: 'Are NFTs a lasting innovation?', options: ['Lasting', 'Fad'] as [string, string] },
  ];

  router.post(
    '/generate-questions',
    upload.single('audio'),
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          res.status(400).json({ error: 'No audio file provided' });
          return;
        }

        if (USE_STUB) {
          // Simulate processing delay
          console.log(`[STUB] Simulating transcription + generation for ${req.file.originalname}...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          const count = parseInt(req.body.count, 10) || 5;
          const questions = STUB_QUESTIONS.slice(0, count);
          console.log(`[STUB] Returning ${questions.length} static questions`);
          res.json({ questions, transcript: '[STUB] Simulated transcript content.' });
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
