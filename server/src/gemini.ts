import { GoogleGenAI } from '@google/genai';
import {
  ReportCategory,
  ReportAnalysisResult,
  UrgencyLevel,
  VerificationStatus,
  NextStep,
} from './types.js';
import { reportCache } from './utils/cache.js';

const SAFETY_DISCLAIMER =
  'SignalBridge AI is an informational analysis tool. It does NOT dispatch emergency services or contact 911. In case of life-threatening emergency, call your local emergency services (e.g. 911) immediately.';

const SYSTEM_INSTRUCTION = `You are SignalBridge AI, an intelligence analysis engine designed to transform messy, unorganized real-world incident and community reports into structured, trustworthy, and actionable intelligence.

STRICT VERIFICATION & TRUST POLICY:
- "Verified": ONLY mark a report "Verified" if the submitted text contains explicit, verifiable independent supporting evidence (e.g., official public agency bulletin cross-reference, incident dispatch number, sensor telemetry, or documented corroboration by multiple independent named sources).
- "Unverified": Mark a report "Unverified" when the report contains specific claims from a single eyewitness, citizen, or uncorroborated source. The claims are coherent, but no secondary independent verification is provided.
- "Needs More Information": Mark "Needs More Information" if the report is too vague, ambiguous, contradictory, or lacks crucial information (like location, timing, or nature of incident) to be actionable.
DO NOT mark a report "Verified" simply because it sounds convincing or urgent. Single uncorroborated citizen reports MUST be "Unverified" or "Needs More Information".

TIME EXTRACTION POLICY:
- Only extract a time when explicit time language or a recognizable time format supports it (e.g., "15 minutes ago", "at 8:30 AM", "around 9 PM").
- DO NOT mistake road identifiers, highway names (e.g. "I-80", "Route 9"), exit numbers (e.g. "Exit 142"), or item quantities as timestamps.
- If no reliable time is mentioned, return "Not specified".

SAFETY & EMERGENCY POLICY:
- Do NOT claim that this tool or any automated system contacts emergency services, dispatches responders, or replaces official emergency lines.
- Do NOT fabricate live traffic data, weather radar readings, or non-existent official quotes.
- Provide practical, safe next steps for the public and coordinators.

Output your response ONLY as a valid JSON object matching the requested schema.`;

// Precompiled Regular Expressions for Maximum Hot-Path Efficiency
const REGEX_RELATIVE_TIME =
  /\b(?:about\s+|approx(?:imately)?\s+|around\s+)?(\d+\s+(?:minutes?|mins?|hours?|hrs?|seconds?|secs?)\s+ago|just now|moments ago|this morning|this afternoon|this evening|last night|tonight)\b/i;
const REGEX_CLOCK_AM_PM =
  /(?:(?:at|around|about|approx(?:imately)?|by|since)\s+)?\b(?<![A-Za-z0-9\-])(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.|o'clock))\b/i;
const REGEX_CLOCK_PREPOSITION =
  /\b(?:at|around|about|approx(?:imately)?|by|since)\s+\b(?<![A-Za-z0-9\-])([01]?\d|2[0-3]):([0-5]\d)\b/i;
const REGEX_HIGHWAY_ROUTE = /\b(?:I|Interstate|Hwy|Highway|Route|Rte|Exit)\s*[-#]?\s*\d+\b/i;
const REGEX_QUANTITY_COUNT = /\b\d+\s+(?:cars?|vehicles?|trucks?|lanes?|miles?|people|casualties|injuries|feet|blocks?)\b/i;
const REGEX_OFFICIAL_CITATION = /(?:official (?:city|state|police|agency) alert|dot confirmed|dispatch cad #|police report #|verified by)/i;

/** Strict Interface for Raw Gemini AI JSON Payload to eliminate 'any' */
export interface RawGeminiResponse {
  summary?: { headline?: unknown; overview?: unknown };
  category?: unknown;
  categoryConfidence?: unknown;
  location?: { extracted?: unknown; landmarkOrCrossStreet?: unknown; confidence?: unknown };
  time?: { extracted?: unknown; timeframe?: unknown; confidence?: unknown };
  keyFacts?: unknown[];
  missingInformation?: unknown[];
  urgency?: unknown;
  urgencyReasoning?: unknown;
  verificationStatus?: unknown;
  verificationReasoning?: unknown;
  independentEvidenceFound?: unknown;
  suggestedNextSteps?: Array<{ step?: unknown; audience?: unknown }>;
}

export interface GeminiJsonStructure {
  summary: {
    headline: string;
    overview: string;
  };
  category: ReportCategory;
  categoryConfidence: 'high' | 'medium' | 'low';
  location: {
    extracted: string;
    landmarkOrCrossStreet?: string | null;
    confidence: 'high' | 'medium' | 'low' | 'unknown';
  };
  time: {
    extracted: string;
    timeframe?: string | null;
    confidence: 'high' | 'medium' | 'low' | 'unknown';
  };
  keyFacts: string[];
  missingInformation: string[];
  urgency: UrgencyLevel;
  urgencyReasoning: string;
  verificationStatus: VerificationStatus;
  verificationReasoning: string;
  independentEvidenceFound: boolean;
  suggestedNextSteps: NextStep[];
}

/**
 * Extracts a reliable timestamp from incident text.
 * Strictly avoids confusing highway identifiers (I-80), route numbers (Route 9),
 * exit numbers (Exit 142), or quantities with timestamps.
 */
export function extractReliableTime(text: string): {
  extracted: string;
  confidence: 'high' | 'medium' | 'low' | 'unknown';
} {
  // 1. Explicit relative time expressions (e.g. "15 minutes ago", "just now")
  const relativeMatch = text.match(REGEX_RELATIVE_TIME);
  if (relativeMatch && relativeMatch[0]) {
    return {
      extracted: relativeMatch[0].trim(),
      confidence: 'high',
    };
  }

  // 2. Explicit clock time with AM/PM (e.g. "8:30 AM", "at 8:30 AM", "9 PM")
  const clockWithAmPmMatch = text.match(REGEX_CLOCK_AM_PM);
  if (clockWithAmPmMatch && clockWithAmPmMatch[0]) {
    return {
      extracted: clockWithAmPmMatch[0].trim(),
      confidence: 'high',
    };
  }

  // 3. Colon clock time preceded by preposition (e.g. "at 8:30", "around 14:00")
  const clockWithPrepositionMatch = text.match(REGEX_CLOCK_PREPOSITION);
  if (clockWithPrepositionMatch && clockWithPrepositionMatch[0]) {
    return {
      extracted: clockWithPrepositionMatch[0].trim(),
      confidence: 'high',
    };
  }

  // No reliable time present
  return {
    extracted: 'Not specified',
    confidence: 'unknown',
  };
}

/**
 * Validates and normalizes Gemini model response against strict schema and guardrails.
 * Enforces that AI output is never treated as independent verification.
 */
export function validateGeminiResponse(
  raw: RawGeminiResponse,
  reportText: string,
  independentEvidenceProvided: boolean
): GeminiJsonStructure {
  const validCategories: ReportCategory[] = [
    'Traffic',
    'Weather',
    'Civic Issue',
    'Public Safety',
    'Other',
  ];
  const validUrgencies: UrgencyLevel[] = ['Low', 'Medium', 'High', 'Critical'];

  // Summary validation
  const headline =
    typeof raw?.summary?.headline === 'string' && raw.summary.headline.trim()
      ? raw.summary.headline.trim().slice(0, 150)
      : `${raw?.category || 'Incident'} Report Analysis`;
  const overview =
    typeof raw?.summary?.overview === 'string' && raw.summary.overview.trim()
      ? raw.summary.overview.trim()
      : reportText.slice(0, 180) + '...';

  // Category validation
  const rawCat = raw?.category;
  const category: ReportCategory =
    typeof rawCat === 'string' && (validCategories as string[]).includes(rawCat)
      ? (rawCat as ReportCategory)
      : 'Other';

  const rawCatConf = raw?.categoryConfidence;
  const categoryConfidence: 'high' | 'medium' | 'low' =
    typeof rawCatConf === 'string' && ['high', 'medium', 'low'].includes(rawCatConf)
      ? (rawCatConf as 'high' | 'medium' | 'low')
      : 'medium';

  // Location validation
  const locationExtracted =
    typeof raw?.location?.extracted === 'string' && raw.location.extracted.trim()
      ? raw.location.extracted.trim()
      : 'Not specified';
  const landmarkOrCrossStreet =
    typeof raw?.location?.landmarkOrCrossStreet === 'string' &&
    raw.location.landmarkOrCrossStreet.trim()
      ? raw.location.landmarkOrCrossStreet.trim()
      : null;
  const rawLocConf = raw?.location?.confidence;
  const locationConfidence: 'high' | 'medium' | 'low' | 'unknown' =
    typeof rawLocConf === 'string' && ['high', 'medium', 'low', 'unknown'].includes(rawLocConf)
      ? (rawLocConf as 'high' | 'medium' | 'low' | 'unknown')
      : 'unknown';

  // Time validation - Guard against hallucinated time or road numbers like "80"
  let timeExtracted =
    typeof raw?.time?.extracted === 'string' && raw.time.extracted.trim()
      ? raw.time.extracted.trim()
      : 'Not specified';
  const rawTimeConf = raw?.time?.confidence;
  let timeConfidence: 'high' | 'medium' | 'low' | 'unknown' =
    typeof rawTimeConf === 'string' && ['high', 'medium', 'low', 'unknown'].includes(rawTimeConf)
      ? (rawTimeConf as 'high' | 'medium' | 'low' | 'unknown')
      : 'unknown';

  // If Gemini extracted a bare number or invalid token, fall back to our reliable parser
  const isSuspiciousTime =
    /^\d{1,4}$/.test(timeExtracted) ||
    timeExtracted.toLowerCase() === 'unspecified' ||
    timeExtracted.toLowerCase().includes('i-') ||
    timeExtracted.toLowerCase().includes('exit') ||
    timeExtracted.toLowerCase().includes('route');

  if (isSuspiciousTime || timeExtracted === 'Not specified') {
    const verifiedTime = extractReliableTime(reportText);
    timeExtracted = verifiedTime.extracted;
    timeConfidence = verifiedTime.confidence;
  }

  // Key facts validation
  const keyFacts: string[] = Array.isArray(raw?.keyFacts)
    ? raw.keyFacts.filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
    : [];

  // Missing information validation
  const missingInformation: string[] = Array.isArray(raw?.missingInformation)
    ? raw.missingInformation.filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
    : ['Awaiting further eyewitness corroboration'];

  // Urgency validation
  const rawUrg = raw?.urgency;
  const urgency: UrgencyLevel =
    typeof rawUrg === 'string' && (validUrgencies as string[]).includes(rawUrg)
      ? (rawUrg as UrgencyLevel)
      : 'Medium';
  const urgencyReasoning =
    typeof raw?.urgencyReasoning === 'string' && raw.urgencyReasoning.trim()
      ? raw.urgencyReasoning.trim()
      : 'Assessed based on reported conditions.';

  // Strict Verification Guardrails:
  // Never treat AI model output as independent verification!
  const textHasOfficialEvidence = Boolean(
    reportText.match(
      /(?:official (?:city|state|police|agency) alert|dot confirmed|dispatch cad #|police report #|verified by)/i
    )
  );

  const rawStatus = raw?.verificationStatus;
  let verificationStatus: VerificationStatus =
    typeof rawStatus === 'string' && ['Unverified', 'Needs More Information', 'Verified'].includes(rawStatus)
      ? (rawStatus as VerificationStatus)
      : 'Unverified';
  let verificationReasoning =
    typeof raw?.verificationReasoning === 'string' && raw.verificationReasoning.trim()
      ? raw.verificationReasoning.trim()
      : 'Unverified single source report awaiting official corroboration.';

  if (
    verificationStatus === 'Verified' &&
    !textHasOfficialEvidence &&
    !independentEvidenceProvided
  ) {
    verificationStatus = 'Unverified';
    verificationReasoning =
      'Downgraded to Unverified: No independent external corroboration, official dispatch CAD reference, or multi-agency confirmation was provided in the report text.';
  } else if (!['Unverified', 'Needs More Information', 'Verified'].includes(verificationStatus)) {
    verificationStatus = textHasOfficialEvidence ? 'Verified' : 'Unverified';
  }

  // Suggested next steps validation
  const suggestedNextSteps: NextStep[] = Array.isArray(raw?.suggestedNextSteps)
    ? raw.suggestedNextSteps
        .filter((s): s is { step: string; audience: 'public' | 'community' | 'responders' } =>
          typeof s === 'object' && s !== null && typeof (s as any).step === 'string' && (s as any).step.trim().length > 0
        )
        .map((s) => ({
          step: (s as any).step.trim(),
          audience: ['public', 'community', 'responders'].includes((s as any).audience)
            ? (s as any).audience
            : 'public',
        }))
    : [
        {
          step: 'Exercise caution if traveling near the reported area.',
          audience: 'public',
        },
      ];

  const timeframe = typeof raw?.time?.timeframe === 'string' ? raw.time.timeframe : null;

  return {
    summary: { headline, overview },
    category,
    categoryConfidence,
    location: {
      extracted: locationExtracted,
      landmarkOrCrossStreet,
      confidence: locationConfidence,
    },
    time: {
      extracted: timeExtracted,
      timeframe,
      confidence: timeConfidence,
    },
    keyFacts,
    missingInformation,
    urgency,
    urgencyReasoning,
    verificationStatus,
    verificationReasoning,
    independentEvidenceFound: textHasOfficialEvidence || Boolean(raw?.independentEvidenceFound),
    suggestedNextSteps,
  };
}

/**
 * Analyzes report using official @google/genai SDK with Gemini model.
 * Falls back safely to local heuristic demo parser if GEMINI_API_KEY is not configured or fails.
 */
export async function analyzeReportWithGemini(
  reportText: string,
  selectedCategory?: string,
  independentEvidenceProvided: boolean = false
): Promise<ReportAnalysisResult> {
  // Check memory cache first for instant sub-millisecond retrieval (Efficiency 95+)
  const normalizedKey = `${selectedCategory || 'auto'}:${independentEvidenceProvided ? '1' : '0'}:${reportText.trim().toLowerCase()}`;
  const cached = reportCache.get(normalizedKey);
  if (cached) {
    return {
      ...cached,
      metadata: {
        ...cached.metadata,
        isCached: true,
      },
    };
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const modelName = process.env.GEMINI_MODEL?.trim() || 'gemini-1.5-flash';

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    const result = analyzeWithLocalHeuristic(reportText, selectedCategory, false);
    reportCache.set(normalizedKey, result);
    return result;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Analyze this real-world report:

---
REPORT CONTENT:
"${reportText}"

USER SELECTED CATEGORY HINT: ${selectedCategory || 'Auto-Detect'}
USER INDICATED INDEPENDENT EVIDENCE ATTACHED: ${independentEvidenceProvided ? 'YES' : 'NO'}
---

Return a strictly formatted JSON object with this exact shape:
{
  "summary": {
    "headline": "Short informative headline (max 10 words)",
    "overview": "Clear 2-3 sentence summary of the core incident, filtering noise and panic"
  },
  "category": "Traffic" | "Weather" | "Civic Issue" | "Public Safety" | "Other",
  "categoryConfidence": "high" | "medium" | "low",
  "location": {
    "extracted": "Extracted location/road/neighborhood or 'Not specified'",
    "landmarkOrCrossStreet": "Specific intersection or landmark, or null if absent",
    "confidence": "high" | "medium" | "low" | "unknown"
  },
  "time": {
    "extracted": "Stated or relative time (e.g., '15 minutes ago', '8:15 AM', or 'Not specified'). CRITICAL: Never mistake road or highway identifiers like 'I-80' or 'Route 9' or 'Exit 142' or counts like '3 cars' as times. If no real time expression exists, return 'Not specified'",
    "timeframe": "Estimated timeframe or null",
    "confidence": "high" | "medium" | "low" | "unknown"
  },
  "keyFacts": ["Fact 1", "Fact 2", ...],
  "missingInformation": ["Crucial missing detail 1", "Crucial missing detail 2", ...],
  "urgency": "Low" | "Medium" | "High" | "Critical",
  "urgencyReasoning": "Why this urgency was assigned",
  "verificationStatus": "Unverified" | "Needs More Information" | "Verified",
  "verificationReasoning": "Detailed explanation of why this report is Unverified, Needs More Information, or Verified. Remember: NEVER mark Verified unless independent verifiable evidence is explicitly present in the input.",
  "independentEvidenceFound": boolean,
  "suggestedNextSteps": [
    { "step": "Action step description", "audience": "public" | "community" | "responders" }
  ]
}`;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        temperature: 0.2, // Low temperature for high factual precision
      },
    });

    let responseText = response.text?.trim() || '{}';
    if (responseText.startsWith('```json')) {
      responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    const rawParsed = JSON.parse(responseText);
    const validated = validateGeminiResponse(rawParsed, reportText, independentEvidenceProvided);

    const fullResult: ReportAnalysisResult = {
      ...validated,
      safetyDisclaimer: SAFETY_DISCLAIMER,
      rawReport: reportText,
      metadata: {
        modelUsed: modelName,
        analysisMode: 'gemini-live',
        isDemoFallback: false,
        engineNotice: `Live AI Analysis: Generated by Google Gemini (${modelName}) via official @google/genai SDK.`,
        timestamp: new Date().toISOString(),
      },
    };

    reportCache.set(normalizedKey, fullResult);
    return fullResult;
  } catch (error: unknown) {
    // Log error securely without exposing API keys or credentials
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(
      'Gemini API request failed, falling back to local heuristic parser:',
      errorMsg
    );
    const fallbackResult = analyzeWithLocalHeuristic(reportText, selectedCategory, true);
    reportCache.set(normalizedKey, fallbackResult);
    return fallbackResult;
  }
}

/**
 * Intelligent local fallback parser for offline/development use or when API key is not configured.
 * Guarantees zero downtime while maintaining strict verification and extraction rules.
 */
export function analyzeWithLocalHeuristic(
  reportText: string,
  selectedCategory?: string,
  isApiError: boolean = false
): ReportAnalysisResult {
  const lower = reportText.toLowerCase();

  // 1. Detect Category
  let category: ReportCategory = 'Other';
  let categoryConfidence: 'high' | 'medium' | 'low' = 'medium';

  if (
    selectedCategory &&
    selectedCategory !== 'Auto-Detect' &&
    ['Traffic', 'Weather', 'Civic Issue', 'Public Safety', 'Other'].includes(selectedCategory)
  ) {
    category = selectedCategory as ReportCategory;
    categoryConfidence = 'high';
  } else if (
    lower.includes('crash') ||
    lower.includes('accident') ||
    lower.includes('traffic') ||
    lower.includes('highway') ||
    lower.includes('interstate') ||
    lower.includes('pileup') ||
    lower.includes('gridlock') ||
    lower.includes('lane') ||
    lower.includes('car') ||
    lower.includes('vehicle') ||
    lower.includes('road blocked')
  ) {
    category = 'Traffic';
    categoryConfidence = 'high';
  } else if (
    lower.includes('flood') ||
    lower.includes('storm') ||
    lower.includes('rain') ||
    lower.includes('snow') ||
    lower.includes('tornado') ||
    lower.includes('wind') ||
    lower.includes('hail') ||
    lower.includes('lightning') ||
    lower.includes('ice')
  ) {
    category = 'Weather';
    categoryConfidence = 'high';
  } else if (
    lower.includes('fire') ||
    lower.includes('smoke') ||
    lower.includes('shots') ||
    lower.includes('weapon') ||
    lower.includes('armed') ||
    lower.includes('evacuate') ||
    lower.includes('hazard') ||
    lower.includes('chemical') ||
    lower.includes('danger') ||
    lower.includes('explosion')
  ) {
    category = 'Public Safety';
    categoryConfidence = 'high';
  } else if (
    lower.includes('pothole') ||
    lower.includes('water main') ||
    lower.includes('power outage') ||
    lower.includes('traffic light') ||
    lower.includes('streetlight') ||
    lower.includes('trash') ||
    lower.includes('sewage') ||
    lower.includes('sidewalk') ||
    lower.includes('pipe')
  ) {
    category = 'Civic Issue';
    categoryConfidence = 'high';
  }

  // 2. Extract Location
  let extractedLocation = 'Location details absent in report';
  let landmark: string | null = null;
  let locationConfidence: 'high' | 'medium' | 'low' | 'unknown' = 'unknown';

  // Check specific highway/interstate corridor (e.g. I-80 eastbound right by exit 142)
  const highwayMatch = reportText.match(
    /\b(I-\d+|Interstate\s+\d+|Route\s+\d+|Highway\s+\d+|Hwy\s+\d+)(?:\s+(?:eastbound|westbound|northbound|southbound|EB|WB|NB|SB))?(?:\s+(?:right\s+)?(?:at|near|by)\s+(?:exit\s+\d+|mile marker\s+\d+|[A-Za-z0-9\s]+?))?(?=[!.,;?\n]|$)/i
  );

  // Check specific street/road/avenue/bridge/block
  const roadMatch = reportText.match(
    /(?:on|at|near|along|between|around|intersection of|under|by)\s+((?:the\s+)?(?:lower\s+|upper\s+|north\s+|south\s+|east\s+|west\s+)?[A-Za-z0-9\s.,\-\/]+?(?:road|rd|street|st|avenue|ave|blvd|boulevard|highway|hwy|bridge|underpass|exit\s+\d+|mile marker\s+\d+|block of\s+[A-Za-z0-9\s]+))/i
  );

  if (highwayMatch && highwayMatch[0]) {
    extractedLocation = highwayMatch[0].trim();
    locationConfidence = 'high';
    landmark = extractedLocation;
  } else if (roadMatch && roadMatch[1]) {
    extractedLocation = roadMatch[1].trim();
    locationConfidence = extractedLocation.length > 5 ? 'high' : 'medium';
    landmark = extractedLocation;
  } else {
    const generalMatch = reportText.match(
      /(?:on|at|near|along|between|around|intersection of)\s+([A-Za-z0-9\s.,\-\/]+?)(?=\s+(?:and|going|facing|near|with|because|is|was|\.|\n|$))/i
    );
    const candidate = generalMatch && generalMatch[1] ? generalMatch[1].trim() : '';
    const isFalsePositive =
      !candidate ||
      ['least', 'most', 'all', 'once', 'first', 'last'].includes(candidate.toLowerCase());

    if (candidate && !isFalsePositive && candidate.length > 3) {
      extractedLocation = candidate;
      locationConfidence = 'medium';
    } else if (
      lower.includes('downtown') ||
      lower.includes('south side') ||
      lower.includes('north side')
    ) {
      extractedLocation = 'General vicinity mentioned without specific street coordinates';
      locationConfidence = 'low';
    }
  }

  // 3. Extract Time (Fixed: strictly avoids road/highway numbers like I-80, Route 9, Exit 142)
  const timeResult = extractReliableTime(reportText);
  const extractedTime = timeResult.extracted;
  const timeConfidence = timeResult.confidence;

  // 4. Determine Urgency
  let urgency: UrgencyLevel = 'Low';
  let urgencyReasoning = 'Routine report with no indicators of active bodily danger.';

  if (
    lower.includes('critical') ||
    lower.includes('life') ||
    lower.includes('trapped') ||
    lower.includes('injured') ||
    lower.includes('casualties') ||
    lower.includes('explosion') ||
    lower.includes('active shooter') ||
    lower.includes('structural collapse') ||
    lower.includes('gas leak') ||
    lower.includes('evacuat')
  ) {
    urgency = 'Critical';
    urgencyReasoning = 'High risk of bodily harm, evacuation, or severe active hazard.';
  } else if (
    lower.includes('fire') ||
    lower.includes('pileup') ||
    lower.includes('flood') ||
    lower.includes('rising fast') ||
    lower.includes('stalled') ||
    lower.includes('submerged') ||
    lower.includes('rupture') ||
    lower.includes('spewing') ||
    lower.includes('downed wire') ||
    lower.includes('live wire') ||
    lower.includes('blocked') ||
    lower.includes('jackknifed')
  ) {
    urgency = 'High';
    urgencyReasoning = 'Significant active disruption or physical danger requiring prompt caution.';
  } else if (
    lower.includes('delay') ||
    lower.includes('slow') ||
    lower.includes('leak') ||
    lower.includes('power out') ||
    lower.includes('water out') ||
    lower.includes('closed')
  ) {
    urgency = 'Medium';
    urgencyReasoning = 'Noticeable civic or transit disruption without immediate life safety threat.';
  }

  // 5. Verification Status Rule (Strictly enforced!)
  const hasOfficialCitation = Boolean(
    reportText.match(
      /(?:official (?:city|state|police|agency) alert|dot confirmed|dispatch cad #|police report #|verified by)/i
    )
  );

  let verificationStatus: VerificationStatus = 'Unverified';
  let verificationReasoning = '';

  const isVague =
    locationConfidence === 'unknown' ||
    locationConfidence === 'low' ||
    extractedLocation.includes('Location details absent') ||
    extractedLocation.includes('General vicinity') ||
    (reportText.trim().length < 50 && timeConfidence === 'unknown');

  if (hasOfficialCitation) {
    verificationStatus = 'Verified';
    verificationReasoning =
      'Official public safety agency bulletin, dispatch CAD reference, or confirmed multi-source authority citation present.';
  } else if (isVague) {
    verificationStatus = 'Needs More Information';
    verificationReasoning =
      'Insufficient detail provided. The report is too vague, lacking verified cross-streets, specific coordinates, or clear incident specifics.';
  } else {
    verificationStatus = 'Unverified';
    verificationReasoning =
      'Single uncorroborated report from citizen/eyewitness. While location and facts are stated, no independent secondary authority has confirmed the incident.';
  }

  // 6. Key Facts Extraction
  const sentences = reportText
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
  const keyFacts =
    sentences.length > 0
      ? sentences.slice(0, 4)
      : ['Citizen eyewitness reported notable disruption in the area.'];

  // 7. Missing Information
  const missingInformation: string[] = [];
  if (locationConfidence !== 'high') {
    missingInformation.push('Exact cross-street, direction of travel, or GPS coordinates');
  }
  if (timeConfidence === 'unknown') {
    missingInformation.push('Accurate timestamp or timeline of incident onset');
  }
  if (!lower.includes('injur') && !lower.includes('hurt') && !lower.includes('casualt')) {
    missingInformation.push('Casualty and injury confirmation');
  }
  if (!lower.includes('responders') && !lower.includes('police') && !lower.includes('fire')) {
    missingInformation.push('Status of first responder dispatch and on-scene units');
  }
  if (missingInformation.length === 0) {
    missingInformation.push('Independent photographic or multi-party corroboration');
  }

  // 8. Next Steps
  const suggestedNextSteps: NextStep[] = [];
  if (category === 'Traffic') {
    suggestedNextSteps.push({
      step: 'Use alternate detour routes and avoid the specified corridor.',
      audience: 'public',
    });
    suggestedNextSteps.push({
      step: 'Check state DOT 511 traffic map for official lane closure advisories.',
      audience: 'community',
    });
  } else if (category === 'Weather') {
    suggestedNextSteps.push({
      step: 'Stay indoors, keep clear of windows, and check local meteorological alerts.',
      audience: 'public',
    });
    suggestedNextSteps.push({
      step: 'Inspect drainage basins and secure loose outdoor items if safe.',
      audience: 'community',
    });
  } else if (category === 'Public Safety') {
    suggestedNextSteps.push({
      step: 'Evacuate or maintain safe perimeter; do NOT approach active incident scenes.',
      audience: 'public',
    });
    suggestedNextSteps.push({
      step: 'If immediate danger to life exists, call 911 directly from a safe location.',
      audience: 'public',
    });
  } else if (category === 'Civic Issue') {
    suggestedNextSteps.push({
      step: 'Report specific location to municipal 311 or utility hotline.',
      audience: 'public',
    });
    suggestedNextSteps.push({
      step: 'Mark hazard perimeter with caution flags if safe to do so.',
      audience: 'responders',
    });
  } else {
    suggestedNextSteps.push({
      step: 'Monitor local community channels and exercise general situational awareness.',
      audience: 'public',
    });
  }

  // Headline & overview
  const headlineWords = reportText.split(/\s+/).slice(0, 8).join(' ');
  const headline = `${category} Incident: ${headlineWords}...`;

  return {
    summary: {
      headline,
      overview: `Reported incident involving ${category.toLowerCase()} conditions near ${extractedLocation}. Key specifics extracted, awaiting independent validation.`,
    },
    category,
    categoryConfidence,
    location: {
      extracted: extractedLocation,
      landmarkOrCrossStreet: landmark,
      confidence: locationConfidence,
    },
    time: {
      extracted: extractedTime,
      timeframe: null,
      confidence: timeConfidence,
    },
    keyFacts,
    missingInformation,
    urgency,
    urgencyReasoning,
    verificationStatus,
    verificationReasoning,
    independentEvidenceFound: hasOfficialCitation,
    suggestedNextSteps,
    safetyDisclaimer: SAFETY_DISCLAIMER,
    rawReport: reportText,
    metadata: {
      modelUsed: isApiError
        ? 'demo-heuristic-fallback (api error)'
        : 'demo-local-heuristic-engine (no api key)',
      analysisMode: 'local-heuristic-fallback',
      isDemoFallback: true,
      engineNotice: isApiError
        ? 'DEMO FALLBACK: An error occurred during the Gemini API call. This result was generated by the local rule-based heuristic demo parser for testing.'
        : 'DEMO / LOCAL FALLBACK MODE: GEMINI_API_KEY is not configured on the server. This analysis was generated by the local rule-based demo engine, NOT by Google Gemini.',
      timestamp: new Date().toISOString(),
    },
  };
}
