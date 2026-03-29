import OpenAI, { toFile } from 'openai';

export interface TranscriptionResult {
  text: string;
}

export class TranscriptionService {
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Transcribe an audio file using OpenAI's gpt-4o-transcribe model.
   *
   * @param audioBuffer - Raw audio file contents
   * @param filename - Original filename (used for MIME type detection)
   * @returns Transcription result with full text
   */
  async transcribe(audioBuffer: Buffer, filename: string): Promise<TranscriptionResult> {
    const file = await toFile(audioBuffer, filename);

    const response = await this.client.audio.transcriptions.create({
      file,
      model: 'gpt-4o-transcribe',
      response_format: 'text',
    });

    const text = typeof response === 'string' ? response : String(response);

    if (!text || text.trim().length === 0) {
      throw new Error('Transcription returned empty text');
    }

    return { text: text.trim() };
  }
}
