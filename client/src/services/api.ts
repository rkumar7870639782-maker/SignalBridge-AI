import type { ReportAnalysisResult, ReportCategory, SystemHealth } from '../types';

export async function fetchHealth(): Promise<SystemHealth> {
  const response = await fetch('/api/health');
  if (!response.ok) {
    throw new Error(`Health check failed with status: ${response.status}`);
  }
  return response.json();
}

export async function analyzeReport(
  report: string,
  category?: ReportCategory | 'Auto-Detect',
  independentEvidenceProvided: boolean = false
): Promise<ReportAnalysisResult> {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      report,
      category,
      independentEvidenceProvided,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || 'Failed to analyze report.');
  }

  return data.data;
}
