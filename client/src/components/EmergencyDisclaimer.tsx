import React from 'react';

export const EmergencyDisclaimer: React.FC = () => {
  return (
    <aside
      className="safety-disclaimer-banner"
      id="emergency-disclaimer-banner"
      role="alert"
      aria-label="Emergency Safety Disclaimer"
    >
      <div className="safety-icon" aria-hidden="true">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <div className="safety-text">
        <strong>Important Safety Notice:</strong> SignalBridge AI is an informational
        parsing and structuring intelligence engine. <strong>It does NOT dispatch
        emergency services, 911, police, or fire crews.</strong> If you or others
        are in immediate danger, dial <strong>911</strong> or your local emergency line immediately.
      </div>
    </aside>
  );
};
