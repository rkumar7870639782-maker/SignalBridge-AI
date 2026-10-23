import { Router, Request, Response } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (_req: Request, res: Response) => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const hasApiKey = Boolean(apiKey && apiKey !== 'your_gemini_api_key_here');
  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';

  res.json({
    status: 'ok',
    service: 'SignalBridge AI Core Backend',
    version: '1.0.0',
    hasApiKey,
    isDemo: !hasApiKey,
    model,
    activeEngine: hasApiKey
      ? 'Official Google GenAI SDK (@google/genai)'
      : 'Local Heuristic Intelligence Engine (Demo Mode)',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});
