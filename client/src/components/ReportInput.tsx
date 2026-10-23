import React, { useState } from 'react';
import type { ReportCategory } from '../types';

interface ReportInputProps {
  reportText: string;
  setReportText: (text: string) => void;
  selectedCategory: ReportCategory | 'Auto-Detect';
  setSelectedCategory: (cat: ReportCategory | 'Auto-Detect') => void;
  hasIndependentEvidence: boolean;
  setHasIndependentEvidence: (val: boolean) => void;
  onAnalyze: () => void;
  onClear: () => void;
  isLoading: boolean;
  errorMessage: string | null;
}

const CATEGORIES: { label: string; value: ReportCategory | 'Auto-Detect' }[] = [
  { label: 'Auto-Detect', value: 'Auto-Detect' },
  { label: 'Traffic', value: 'Traffic' },
  { label: 'Weather', value: 'Weather' },
  { label: 'Civic Issue', value: 'Civic Issue' },
  { label: 'Public Safety', value: 'Public Safety' },
  { label: 'Other', value: 'Other' },
];

export const ReportInput: React.FC<ReportInputProps> = React.memo(({
  reportText,
  setReportText,
  selectedCategory,
  setSelectedCategory,
  hasIndependentEvidence,
  setHasIndependentEvidence,
  onAnalyze,
  onClear,
  isLoading,
  errorMessage,
}) => {
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportText.trim()) {
      setValidationError('Please enter or paste an incident report to analyze.');
      return;
    }
    if (reportText.trim().length < 10) {
      setValidationError('Report is too short. Please provide at least 10 characters.');
      return;
    }
    setValidationError(null);
    onAnalyze();
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setReportText(e.target.value);
    if (validationError && e.target.value.trim().length >= 10) {
      setValidationError(null);
    }
  };

  const activeError = errorMessage || validationError;

  return (
    <section className="card" aria-labelledby="input-panel-title">
      <div className="card-header">
        <h2 className="card-title" id="input-panel-title">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent-cyan)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          Submit Raw Incident Report
        </h2>
        <p className="card-subtitle">
          Paste unstructured citizen chatter, 911 dispatch blurbs, or eyewitness accounts.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {/* Category Selection */}
        <div className="category-group">
          <label className="category-label" id="category-group-label">
            Category Classification
          </label>
          <div
            className="category-chips"
            role="radiogroup"
            aria-labelledby="category-group-label"
          >
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.value;
              return (
                <button
                  key={cat.value}
                  type="button"
                  id={`cat-chip-${cat.value.toLowerCase().replace(/\s+/g, '-')}`}
                  className={`chip-btn ${isActive ? 'active' : ''}`}
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => setSelectedCategory(cat.value)}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Text Area */}
        <div className="input-container">
          <textarea
            id="report-input-textarea"
            className="report-textarea"
            placeholder="e.g. 'Massive collision on eastbound Route 9 near exit 14. 3 cars involved, looks like fluids leaking on the road, lane 1 completely blocked. Saw smoke about 10 minutes ago, traffic backing up fast...'"
            value={reportText}
            onChange={handleTextChange}
            aria-label="Incident Report Content"
            aria-invalid={Boolean(activeError)}
            aria-describedby={activeError ? 'report-input-error' : undefined}
            rows={6}
          />
          <div className="textarea-footer">
            <span
              className={`char-counter ${
                reportText.length > 3000 ? 'warning' : ''
              }`}
            >
              {reportText.length} characters
            </span>
            <span>Min 10 characters</span>
          </div>
        </div>

        {/* Independent Evidence Verification Toggle */}
        <label className="evidence-checkbox-label" htmlFor="evidence-checkbox">
          <input
            type="checkbox"
            id="evidence-checkbox"
            className="evidence-checkbox"
            checked={hasIndependentEvidence}
            onChange={(e) => setHasIndependentEvidence(e.target.checked)}
          />
          <span>
            Include independent supporting evidence (e.g. official CAD reference, agency bulletin)
          </span>
        </label>

        {/* Error Alert */}
        {activeError && (
          <div
            className="error-alert"
            id="report-input-error"
            role="alert"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0, marginTop: '2px' }}
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>{activeError}</div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="btn-row">
          <button
            type="submit"
            id="analyze-report-button"
            className="btn-primary"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span
                  className="spinner-outer"
                  style={{ width: '18px', height: '18px', borderWidth: '2px' }}
                  aria-hidden="true"
                />
                <span>Analyzing Report...</span>
              </>
            ) : (
              <>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                <span>Analyze Report</span>
              </>
            )}
          </button>

          <button
            type="button"
            id="clear-report-button"
            className="btn-ghost"
            onClick={onClear}
            disabled={isLoading || (!reportText && !activeError)}
          >
            Clear
          </button>
        </div>
      </form>
    </section>
  );
});
