export type ReportCategory =
  | 'Traffic'
  | 'Weather'
  | 'Civic Issue'
  | 'Public Safety'
  | 'Other';

export type UrgencyLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export type VerificationStatus =
  | 'Unverified'
  | 'Needs More Information'
  | 'Verified';

export interface LocationDetail {
  extracted: string;
  landmarkOrCrossStreet?: string | null;
  confidence: 'high' | 'medium' | 'low' | 'unknown';
}

export interface TimeDetail {
  extracted: string;
  timeframe?: string | null;
  confidence: 'high' | 'medium' | 'low' | 'unknown';
}

export interface NextStep {
  step: string;
  audience: 'public' | 'community' | 'responders';
}

export interface ReportAnalysisResult {
  summary: {
    headline: string;
    overview: string;
  };
  category: ReportCategory;
  categoryConfidence: 'high' | 'medium' | 'low';
  location: LocationDetail;
  time: TimeDetail;
  keyFacts: string[];
  missingInformation: string[];
  urgency: UrgencyLevel;
  urgencyReasoning: string;
  verificationStatus: VerificationStatus;
  verificationReasoning: string;
  independentEvidenceFound: boolean;
  suggestedNextSteps: NextStep[];
  safetyDisclaimer: string;
  rawReport: string;
  metadata: {
    modelUsed: string;
    analysisMode: 'gemini-live' | 'local-heuristic-fallback';
    isDemoFallback: boolean;
    engineNotice: string;
    timestamp: string;
  };
}

export interface AnalyzeRequestBody {
  report: string;
  category?: ReportCategory | 'Auto-Detect';
  independentEvidenceProvided?: boolean;
}
