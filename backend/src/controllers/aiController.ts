import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || 'dummy_key',
});

// @desc    Stream AI response for document insights
// @route   POST /api/ai/insights
// @access  Private
export const streamInsights = async (req: Request, res: Response): Promise<void> => {
  const { action, content } = req.body;

  let prompt = '';
  if (action === 'summarize') {
    prompt = `Please provide a concise summary of the following document:\n\n${content}`;
  } else if (action === 'fix_grammar') {
    prompt = `Please fix the grammar and improve the tone of the following text, providing only the corrected text:\n\n${content}`;
  } else {
    res.status(400).json({ message: 'Invalid action' });
    return;
  }

  try {
    // Set headers for SSE (Server-Sent Events)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        // Send data formatted for SSE
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('AI Generation error:', error);
    res.write(`data: ${JSON.stringify({ error: 'Failed to generate AI response' })}\n\n`);
    res.end();
  }
};
