import { Router, Request, Response } from 'express';
import { analyzeReportWithGemini } from '../gemini.js';
import { AnalyzeRequestBody, ReportCategory } from '../types.js';

export const analyzeRouter = Router();

const ALLOWED_CATEGORIES: (ReportCategory | 'Auto-Detect')[] = [
  'Auto-Detect',
  'Traffic',
  'Weather',
  'Civic Issue',
  'Public Safety',
  'Other',
];

analyzeRouter.post('/', async (req: Request<{}, {}, AnalyzeRequestBody>, res: Response) => {
  try {
    const { report, category = 'Auto-Detect', independentEvidenceProvided = false } = req.body;

    // Validation
    if (!report || typeof report !== 'string') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'The "report" field is required and must be a text string.',
      });
    }

    const trimmed = report.trim();
    if (trimmed.length < 10) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'The incident report is too short. Please provide at least 10 characters describing the event.',
      });
    }

    if (trimmed.length > 8000) {
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
      trimmed,
      category === 'Auto-Detect' ? undefined : category,
      Boolean(independentEvidenceProvided)
    );

    return res.json({
      success: true,
      data: analysis,
    });
  } catch (err: any) {
    console.error('Error processing report analysis:', err);
    return res.status(500).json({
      error: 'Processing Error',
      message: 'Failed to process report. Please try again in a few moments.',
      details: process.env.NODE_ENV === 'development' ? err?.message : undefined,
    });
  }
});
