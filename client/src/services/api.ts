import type { ReportAnalysisResult, ReportCategory, SystemHealth } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export async function fetchHealth(): Promise<SystemHealth> {
  const response = await fetch(`${API_BASE_URL}/api/health`);
  if (!response.ok) {
    let errorDetail = `Status ${response.status}`;
    try {
      const errJson = await response.json();
      errorDetail = errJson.message || errJson.error || errorDetail;
    } catch {
      // Non-JSON response (e.g. 404 HTML)
    }
    throw new Error(`Health check failed: ${errorDetail}`);
  }
  return response.json();
}

export async function analyzeReport(
  report: string,
  category?: ReportCategory | 'Auto-Detect',
  independentEvidenceProvided: boolean = false
): Promise<ReportAnalysisResult> {
  const response = await fetch(`${API_BASE_URL}/api/analyze`, {
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

  if (!response.ok) {
    let errorMsg = `Server returned status ${response.status}`;
    try {
      const data = await response.json();
      errorMsg = data.message || data.error || errorMsg;
    } catch {
      // Non-JSON response (e.g. 404 HTML page when backend is unreachable)
    }
    throw new Error(errorMsg);
  }

  const data = await response.json();
  return data.data;
}
