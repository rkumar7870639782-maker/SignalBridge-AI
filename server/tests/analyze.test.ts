import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeReportWithGemini,
  analyzeWithLocalHeuristic,
  extractReliableTime,
  validateGeminiResponse,
} from '../src/gemini.js';

describe('SignalBridge AI Verification & Guardrail Tests', () => {
  test('Strict Rule: Single uncorroborated eyewitness report must NOT be marked Verified', () => {
    const report =
      'Multiple cars crashed on Interstate 95 northbound near exit 42. Smoke is rising and left lanes are blocked!';
    const result = analyzeWithLocalHeuristic(report, 'Traffic', false);

    assert.notEqual(
      result.verificationStatus,
      'Verified',
      'Single uncorroborated report must not be Verified'
    );
    assert.ok(
      ['Unverified', 'Needs More Information'].includes(result.verificationStatus),
      `Expected Unverified or Needs More Information, got ${result.verificationStatus}`
    );
  });

  test('Vague or minimal report must be labeled Needs More Information', () => {
    const report = 'Something bad happened somewhere downtown.';
    const result = analyzeWithLocalHeuristic(report, 'Other', false);

    assert.equal(
      result.verificationStatus,
      'Needs More Information',
      'Vague report lacking location and time must be Needs More Information'
    );
  });

  test('Verified label is ONLY applied when official/independent corroboration is documented', () => {
    const report =
      'State DOT confirmed lane closure on Highway 101 mile marker 14 due to flash flooding. Official city alert issued at 9:00 AM.';
    const result = analyzeWithLocalHeuristic(report, 'Weather', false);

    assert.equal(
      result.verificationStatus,
      'Verified',
      'Should be Verified when explicit official public agency corroboration is documented'
    );
  });

  test('Safety disclaimer is strictly included and denies emergency service dispatch', () => {
    const report = 'Huge fire on Oak Street. People running.';
    const result = analyzeWithLocalHeuristic(report, 'Public Safety', false);

    assert.ok(result.safetyDisclaimer.includes('does NOT dispatch emergency services'));
    assert.ok(result.safetyDisclaimer.includes('call your local emergency services'));
  });

  test('Analysis output contains all mandatory first-milestone structured fields', () => {
    const report =
      'Major water main break at 5th Ave and Maple St. Water gushing across all 4 lanes since 8:30 AM.';
    const result = analyzeWithLocalHeuristic(report, 'Civic Issue', false);

    assert.ok(result.summary.headline, 'Missing summary headline');
    assert.ok(result.summary.overview, 'Missing summary overview');
    assert.equal(result.category, 'Civic Issue');
    assert.ok(result.location.extracted, 'Missing location');
    assert.ok(result.time.extracted, 'Missing time');
    assert.ok(Array.isArray(result.keyFacts) && result.keyFacts.length > 0, 'Key facts missing or empty');
    assert.ok(Array.isArray(result.missingInformation), 'Missing info array missing');
    assert.ok(['Low', 'Medium', 'High', 'Critical'].includes(result.urgency), 'Invalid urgency');
    assert.ok(
      ['Unverified', 'Needs More Information', 'Verified'].includes(result.verificationStatus),
      'Invalid verification status'
    );
    assert.ok(Array.isArray(result.suggestedNextSteps) && result.suggestedNextSteps.length > 0, 'Next steps missing');
  });
});

describe('PRIORITY 1 — Regression Tests: Time Extraction Bug Fixes', () => {
  test('Regression: I-80 alone must not be extracted as time "80"', () => {
    const result = extractReliableTime('Massive traffic jam on I-80 eastbound.');
    assert.notEqual(result.extracted, '80', 'I-80 must never be interpreted as timestamp 80');
    assert.equal(result.extracted, 'Not specified');
    assert.equal(result.confidence, 'unknown');
  });

  test('Regression: Route 9 alone must not be extracted as time "9"', () => {
    const result = extractReliableTime('Overturned box truck blocking Route 9.');
    assert.notEqual(result.extracted, '9', 'Route 9 must never be interpreted as timestamp 9');
    assert.equal(result.extracted, 'Not specified');
    assert.equal(result.confidence, 'unknown');
  });

  test('Regression: Exit 142 alone must not be extracted as time "14" or "142"', () => {
    const result = extractReliableTime('Backups reported near Exit 142 due to road debris.');
    assert.notEqual(result.extracted, '14', 'Exit 142 must not be interpreted as timestamp 14');
    assert.notEqual(result.extracted, '142', 'Exit 142 must not be interpreted as timestamp 142');
    assert.equal(result.extracted, 'Not specified');
    assert.equal(result.confidence, 'unknown');
  });

  test('Regression: Quantities and counts (3 cars, 4 miles) must not be extracted as time', () => {
    const result = extractReliableTime('3 cars collided and traffic is backed up 4 miles.');
    assert.equal(result.extracted, 'Not specified');
    assert.equal(result.confidence, 'unknown');
  });

  test('Regression: "15 minutes ago" is accurately extracted', () => {
    const result = extractReliableTime('Saw thick black smoke about 15 minutes ago.');
    assert.ok(
      result.extracted.toLowerCase().includes('15 minutes ago'),
      `Expected "15 minutes ago", got "${result.extracted}"`
    );
    assert.equal(result.confidence, 'high');
  });

  test('Regression: "at 8:30 AM" is accurately extracted', () => {
    const result = extractReliableTime('Incident occurred at 8:30 AM on Maple Avenue.');
    assert.ok(
      result.extracted.includes('8:30 AM'),
      `Expected "8:30 AM", got "${result.extracted}"`
    );
    assert.equal(result.confidence, 'high');
  });

  test('Regression: Full sample report with I-80, Exit 142, and "15 minutes ago" extracts correct time', () => {
    const sampleText =
      'OMGGG avoid I-80 eastbound right by exit 142 near the river bend! Massive multi-car pileup, two semi-trucks jackknifed across all 3 lanes, debris everywhere. Saw thick black smoke about 15 minutes ago. Traffic is completely stopped for at least 4 miles back!';
    const result = analyzeWithLocalHeuristic(sampleText, 'Traffic', false);

    assert.notEqual(result.time.extracted, '80', 'Must not extract "80" from I-80');
    assert.notEqual(result.time.extracted, '142', 'Must not extract "142" from exit 142');
    assert.notEqual(result.time.extracted, '3', 'Must not extract "3" from 3 lanes');
    assert.notEqual(result.time.extracted, '4', 'Must not extract "4" from 4 miles');
    assert.ok(
      result.time.extracted.toLowerCase().includes('15 minutes ago'),
      `Expected time containing "15 minutes ago", got "${result.time.extracted}"`
    );
  });
});

describe('PRIORITY 2 — Gemini Response Validation & Guardrail Tests', () => {
  test('validateGeminiResponse: Never treats AI model output as independent verification', () => {
    const rawAiOutput = {
      summary: { headline: 'Highway Incident', overview: 'A crash happened.' },
      category: 'Traffic',
      urgency: 'High',
      verificationStatus: 'Verified', // Model claimed verified without evidence!
      verificationReasoning: 'Sounds convincing.',
      location: { extracted: 'I-80' },
      time: { extracted: '15 minutes ago' },
    };

    const validated = validateGeminiResponse(
      rawAiOutput,
      'Single eyewitness saw crash on I-80.', // No official bulletin in text!
      false // No independent evidence attached!
    );

    assert.equal(
      validated.verificationStatus,
      'Unverified',
      'AI output claiming Verified must be downgraded to Unverified without independent evidence'
    );
    assert.ok(validated.verificationReasoning.includes('Downgraded to Unverified'));
  });

  test('validateGeminiResponse: Prevents model from hallucinating "80" as timestamp', () => {
    const rawAiOutput = {
      summary: { headline: 'Highway Incident', overview: 'A crash happened.' },
      category: 'Traffic',
      urgency: 'Medium',
      verificationStatus: 'Unverified',
      location: { extracted: 'I-80' },
      time: { extracted: '80' }, // Model confused I-80 with time 80!
    };

    const validated = validateGeminiResponse(
      rawAiOutput,
      'Accident on I-80 eastbound near exit 142.',
      false
    );

    assert.notEqual(validated.time.extracted, '80');
    assert.equal(validated.time.extracted, 'Not specified');
  });
});

describe('PRIORITY 3 — Gemini API Fallback & Safe Error Catching Tests', () => {
  test('analyzeReportWithGemini: Falls back to local heuristic when API key is missing', async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const result = await analyzeReportWithGemini(
        'Overturned truck on Highway 101 blocking 2 lanes about 20 minutes ago.',
        'Traffic'
      );

      assert.ok(result);
      assert.equal(result.category, 'Traffic');
      assert.equal(result.metadata.isDemoFallback, true);
      assert.equal(result.metadata.analysisMode, 'local-heuristic-fallback');
    } finally {
      if (originalKey !== undefined) {
        process.env.GEMINI_API_KEY = originalKey;
      }
    }
  });

  test('analyzeReportWithGemini: Safely catches API error and falls back to heuristic with isApiError = true', async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    // Set a dummy key to bypass the missing-key check and trigger the SDK try/catch
    process.env.GEMINI_API_KEY = 'invalid-dummy-key-for-testing';

    try {
      const result = await analyzeReportWithGemini(
        'Smoke billowing near 5th and Main street.',
        'Public Safety'
      );

      assert.ok(result);
      assert.equal(result.category, 'Public Safety');
      assert.equal(result.metadata.isDemoFallback, true);
      assert.equal(result.metadata.analysisMode, 'local-heuristic-fallback');
      assert.equal(result.metadata.modelUsed, 'demo-heuristic-fallback (api error)');
      assert.ok(result.metadata.engineNotice.includes('DEMO FALLBACK: An error occurred'));
    } finally {
      if (originalKey !== undefined) {
        process.env.GEMINI_API_KEY = originalKey;
      } else {
        delete process.env.GEMINI_API_KEY;
      }
    }
  });
});

