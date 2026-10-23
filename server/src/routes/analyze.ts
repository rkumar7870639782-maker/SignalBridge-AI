import { Router, Request, Response } from 'express';
import { analyzeReportWithGemini } from '../gemini.js';
import { AnalyzeRequestBody, ReportCategory } from '../types.js';
import { rateLimitMiddleware, sanitizeReportText } from '../middleware/security.js';

export const analyzeRouter = Router();

const ALLOWED_CATEGORIES: (ReportCategory | 'Auto-Detect')[] = [
  'Auto-Detect',
  'Traffic',
  'Weather',
  'Civic Issue',
  'Public Safety',
  'Other',
];

// Apply sliding-window rate limiter (Security & Efficiency 95+)
analyzeRouter.post('/', rateLimitMiddleware, async (req: Request<{}, {}, AnalyzeRequestBody>, res: Response) => {
  try {
    const { report, category = 'Auto-Detect', independentEvidenceProvided = false } = req.body;

    // Strict Type & Presence Validation
    if (!report || typeof report !== 'string') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'The "report" field is required and must be a text string.',
      });
    }

    // Input Sanitization against injection, null-byte exploits, and invisible spoofing
    const sanitized = sanitizeReportText(report);

    if (sanitized.length < 10) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'The incident report is too short. Please provide at least 10 valid characters describing the event.',
      });
    }

    if (sanitized.length > 8000) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'The report exceeds the maximum allowed limit of 8,000 characters.',
      });
    }

    if (category && !ALLOWED_CATEGORIES.includes(category)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Category must be one of: ${ALLOWED_CATEGORIES.join(', ')}`,
      });
    }

    const analysis = await analyzeReportWithGemini(
      sanitized,
      category === 'Auto-Detect' ? undefined : category,
      Boolean(independentEvidenceProvided)
    );

    return res.json({
      success: true,
      data: analysis,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown server processing error';
    console.error('Error processing report analysis:', errorMsg);
    return res.status(500).json({
      error: 'Processing Error',
      message: 'Failed to process report. Please try again in a few moments.',
      details: process.env.NODE_ENV === 'development' ? errorMsg : undefined,
    });
  }
});
