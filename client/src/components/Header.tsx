import React from 'react';
import type { SystemHealth } from '../types';

interface HeaderProps {
  health: SystemHealth | null;
  loadingHealth: boolean;
}

export const Header: React.FC<HeaderProps> = ({ health, loadingHealth }) => {
  return (
    <header className="header-container" role="banner">
      <div className="header-inner">
        <div className="brand-section">
          <div className="brand-logo-icon" aria-hidden="true">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#041021"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 20h.01" />
              <path d="M7 20v-4" />
              <path d="M12 20v-8" />
              <path d="M17 20V8" />
              <path d="M22 4v16" />
            </svg>
          </div>
          <div>
            <h1 className="brand-title">
              SignalBridge AI
              <span className="brand-badge" id="milestone-badge">Milestone 1</span>
            </h1>
            <p className="brand-subtitle">
              Messy Real-World Reports &rarr; Structured, Trustworthy Intelligence
            </p>
          </div>
        </div>

        <div className="header-actions">
          <div
            className="system-status-pill"
            id="system-status-indicator"
            title={
              health?.hasApiKey
                ? `Connected to Gemini AI (${health.model})`
                : 'Running in Heuristic Fallback Mode (Demo)'
            }
          >
            <span
              className={`status-dot ${
                loadingHealth
                  ? ''
                  : health?.hasApiKey
                  ? 'active'
                  : 'fallback'
              }`}
            />
            <span>
              {loadingHealth
                ? 'Connecting...'
                : health?.hasApiKey
                ? `Gemini AI (${health.model})`
                : 'Heuristic Engine (Local)'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
