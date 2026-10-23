# SignalBridge AI 📡⚡

SignalBridge AI is an intelligence application that transforms noisy, unstructured, real-world incident and community reports into structured, trustworthy information with verified facts, gap analysis, and actionable next steps.

---

## Architecture Overview

```
signalbridge-ai/
├── client/                     # Frontend: React 19 + Vite 8 + TypeScript
│   ├── src/
│   │   ├── components/         # Header, EmergencyDisclaimer, SampleSelector, ReportInput, ResultsPanel
│   │   ├── data/samples.ts     # Curated real-world test scenarios
│   │   ├── services/api.ts     # Client HTTP client to backend
│   │   ├── types.ts            # Shared TypeScript data models
│   │   ├── index.css           # Premium dark-mode glassmorphic CSS design system
│   │   ├── App.tsx             # Main responsive dashboard
│   │   └── main.tsx            # Entry point
│   └── vite.config.ts          # Proxy configuration to backend (port 3001)
│
├── server/                     # Backend: Node.js + Express + TypeScript
│   ├── src/
│   │   ├── gemini.ts           # Google GenAI SDK (@google/genai) integration & heuristic engine
│   │   ├── routes/
│   │   │   ├── analyze.ts      # POST /api/analyze with validation & guardrails
│   │   │   └── health.ts       # GET /api/health status & Gemini connectivity check
│   │   ├── types.ts            # Request & response types
│   │   └── index.ts            # Server entrypoint with CORS & logging
│   ├── tests/                  # Automated verification & guardrail tests
│   └── tsconfig.json
│
├── .env.example                # Safe environment configuration template
├── .gitignore                  # Git ignore protecting .env & build outputs
└── package.json                # Coordinated root scripts (dev, build, test)
```

---

## First Milestone: Features Implemented

1. **Responsive, Premium Dashboard**: High-contrast, dark glassmorphism interface styled with Vanilla CSS and modern typography (Outfit, Plus Jakarta Sans, JetBrains Mono).
2. **Text Input & Classification Area**: Textarea with character counter, minimum length enforcement, and category selection:
   - `Traffic`
   - `Weather`
   - `Civic Issue`
   - `Public Safety`
   - `Other`
   - `Auto-Detect`
3. **Analyze Action & State Management**: Analyze button with animated loading spinner, input validation alerts, and clear functionality.
4. **Structured Results Panel**:
   - **Summary**: Concise headline and synthesized narrative overview.
   - **Category**: Detected category with confidence assessment.
   - **Location**: Extracted roadway, street, landmark, or intersection with confidence indicator.
   - **Time**: Extracted timestamp or relative time statement.
   - **Key Facts**: High-confidence corroborated assertions.
   - **Missing Information**: Critical gaps that responders or civilians need to verify before acting.
   - **Urgency Meter**: `Low`, `Medium`, `High`, or `Critical` with rationale.
   - **Verification Status**: `Unverified`, `Needs More Information`, or `Verified`.
   - **Verification Rationale**: Explicit justification for the status assignment.
   - **Actionable Next Steps**: Step-by-step guidance targeted for the public, community coordinators, or responders.
   - **Raw JSON Inspector**: Technical view of the full structured payload.
5. **Strict Verification Guardrails**:
   - Single uncorroborated reports are **NEVER marked `Verified`**.
   - Reports lacking key location/timing specifics are marked `Needs More Information`.
   - Only reports documenting verifiable independent supporting evidence (e.g. official CAD #, agency dispatch, multi-source corroboration) are marked `Verified`.
6. **Safety & Compliance**:
   - Prominently displays safety disclaimer: *"SignalBridge AI does NOT dispatch emergency services or contact 911."*
   - Never fabricates live sensors, weather radar, or emergency agency quotes.
7. **Sample Report Selector**: 5 preloaded realistic scenarios for instant one-click testing.
8. **Dual Analysis Engine**:
   - **Google GenAI SDK (`@google/genai`)**: Connects to `gemini-2.5-flash` when `GEMINI_API_KEY` is provided.
   - **Local Heuristic Intelligence Engine**: Fallback engine active when no key is set, guaranteeing zero downtime and offline functionality during development.

---

## Getting Started

### Prerequisites
- Node.js v18+ (tested on Node v24)
- npm v9+

### 1. Configuration
Copy the example environment file and add your Gemini API key:
```bash
cp .env.example .env
```
Open `.env` and set:
```env
PORT=3001
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```
*(Note: If you do not have an API key right away, you can still run and test the entire application immediately using the built-in local heuristic engine).*

### 2. Launch Development Servers
Run both backend and frontend concurrently with a single command from the project root:
```bash
npm run dev
```
Or start them individually:
```bash
# Terminal 1: Backend
npm run dev:server

# Terminal 2: Frontend
npm run dev:client
```

### 3. Open in Browser
- Frontend Dashboard: [http://localhost:5173](http://localhost:5173)
- Backend Health Check: [http://localhost:3001/api/health](http://localhost:3001/api/health)

---

## Testing & Quality Assurance

Run the automated test suite:
```bash
npm test
```
Build both client and server:
```bash
npm run build
```
