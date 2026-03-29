import OpenAI from 'openai';

export interface GeneratedQuestion {
  prompt: string;
  options: [string, string];
}

export class QuestionGeneratorService {
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Generate quiz questions from a transcript.
   *
   * Each question has exactly 2 options (e.g. yes/no, agree/disagree,
   * or two contrasting stances from the discussion).
   *
   * @param transcript - Full transcript text
   * @param count - Desired number of questions (best-effort)
   * @returns Array of generated questions
   */
  async generate(transcript: string, count: number = 5): Promise<GeneratedQuestion[]> {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You generate quiz questions from conversation transcripts.

Rules:
- Each question MUST have EXACTLY 2 options. No more, no less.
- Options should be short (1-6 words each).
- Questions should capture interesting opinions, claims, or stances from the discussion.
- Frame questions so both options are reasonable — avoid obviously correct/incorrect answers.
- Use formats like: agree/disagree, yes/no, or two contrasting positions.

Return JSON: { "questions": [{ "prompt": "...", "options": ["Option A", "Option B"] }] }`,
        },
        {
          role: 'user',
          content: `Generate ${count} quiz questions from this transcript:\n\n${transcript}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Question generation returned empty response');
    }

    const parsed = JSON.parse(content) as { questions?: unknown[] };
    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error('Invalid response format: missing "questions" array');
    }

    // Validate and filter: every question must have exactly 2 options
    const valid: GeneratedQuestion[] = [];
    for (const q of parsed.questions) {
      const question = q as Record<string, unknown>;
      if (
        typeof question.prompt === 'string' &&
        Array.isArray(question.options) &&
        question.options.length === 2 &&
        question.options.every((o: unknown) => typeof o === 'string' && o.trim().length > 0)
      ) {
        valid.push({
          prompt: question.prompt,
          options: [String(question.options[0]), String(question.options[1])],
        });
      }
    }

    if (valid.length === 0) {
      throw new Error('No valid questions generated (all failed 2-option validation)');
    }

    return valid;
  }
}
