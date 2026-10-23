import React from 'react';
import { SAMPLE_REPORTS } from '../data/samples';
import type { SampleReport } from '../types';

interface SampleSelectorProps {
  selectedSampleId: string | null;
  onSelectSample: (sample: SampleReport) => void;
}

export const SampleSelector: React.FC<SampleSelectorProps> = React.memo(({
  selectedSampleId,
  onSelectSample,
}) => {
  return (
    <div className="sample-selector-container">
      <div className="sample-label">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        <span>Test Scenarios & Sample Reports</span>
      </div>

      <div className="sample-pills-grid" role="group" aria-label="Sample Incident Reports">
        {SAMPLE_REPORTS.map((sample) => {
          const isSelected = selectedSampleId === sample.id;
          return (
            <button
              key={sample.id}
              id={`sample-btn-${sample.id}`}
              type="button"
              className={`sample-btn ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectSample(sample)}
            >
              <div className="sample-title-row">
                <span className="sample-title">{sample.title}</span>
                <span className="sample-tag">{sample.category}</span>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Target: <strong>{sample.expectedStatus}</strong>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});
