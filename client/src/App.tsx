import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { EmergencyDisclaimer } from './components/EmergencyDisclaimer';
import { SampleSelector } from './components/SampleSelector';
import { ReportInput } from './components/ReportInput';
import { ResultsPanel } from './components/ResultsPanel';
import { fetchHealth, analyzeReport } from './services/api';
import type {
  ReportCategory,
  ReportAnalysisResult,
  SampleReport,
  SystemHealth,
} from './types';

export const App: React.FC = () => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(true);

  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [reportText, setReportText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory | 'Auto-Detect'>('Auto-Detect');
  const [hasIndependentEvidence, setHasIndependentEvidence] = useState(false);

  const [result, setResult] = useState<ReportAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Poll or check system health on mount
  useEffect(() => {
    let mounted = true;
    fetchHealth()
      .then((data) => {
        if (mounted) {
          setHealth(data);
          setLoadingHealth(false);
        }
      })
      .catch((err) => {
        console.warn('Backend health check delayed or offline:', err);
        if (mounted) {
          setLoadingHealth(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleSelectSample = (sample: SampleReport) => {
    setSelectedSampleId(sample.id);
    setReportText(sample.reportText);
    setSelectedCategory(sample.category);
    setHasIndependentEvidence(sample.expectedStatus === 'Verified');
    setErrorMessage(null);
  };

  const handleAnalyze = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await analyzeReport(
        reportText,
        selectedCategory,
        hasIndependentEvidence
      );
      setResult(data);
    } catch (err: any) {
      console.error('Analysis error:', err);
      setErrorMessage(
        err.message || 'An error occurred while analyzing the incident report.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setReportText('');
    setSelectedSampleId(null);
    setSelectedCategory('Auto-Detect');
    setHasIndependentEvidence(false);
    setResult(null);
    setErrorMessage(null);
  };

  return (
    <div className="app-wrapper">
      <Header health={health} loadingHealth={loadingHealth} />

      <main className="main-content">
        <EmergencyDisclaimer />

        <div className="dashboard-grid">
          {/* Left Column: Sample Selector + Input Panel */}
          <div className="dashboard-left-col">
            <div className="card sample-card">
              <SampleSelector
                selectedSampleId={selectedSampleId}
                onSelectSample={handleSelectSample}
              />
            </div>

            <ReportInput
              reportText={reportText}
              setReportText={(text) => {
                setReportText(text);
                setSelectedSampleId(null);
              }}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              hasIndependentEvidence={hasIndependentEvidence}
              setHasIndependentEvidence={setHasIndependentEvidence}
              onAnalyze={handleAnalyze}
              onClear={handleClear}
              isLoading={isLoading}
              errorMessage={errorMessage}
            />
          </div>

          {/* Right Column: Structured Results Panel */}
          <div className="dashboard-right-col">
            <ResultsPanel result={result} isLoading={isLoading} />
          </div>
        </div>
      </main>

      <footer className="footer-container">
        <div>
          SignalBridge AI &mdash; Transforming unstructured reports into actionable community intelligence.
        </div>
        <div style={{ marginTop: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Powered by Google GenAI Gemini &bull; Built with React, Vite, Express & TypeScript
        </div>
      </footer>
    </div>
  );
};

export default App;
