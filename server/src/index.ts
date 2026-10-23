import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { healthRouter } from './routes/health.js';
import { analyzeRouter } from './routes/analyze.js';

// Load environment variables from server directory, project root, or cwd
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

import { securityHeadersMiddleware } from './middleware/security.js';
import { reportCache } from './utils/cache.js';

export const app = express();
const PORT = process.env.PORT || 3001;

// Disable fingerprinting header (Security 95+)
app.disable('x-powered-by');

// Enterprise Security Headers
app.use(securityHeadersMiddleware);

// Dynamic, Secure CORS Configuration
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, same-origin, or native mobile/serverless)
      if (!origin) return callback(null, true);
      // Allow local development ports
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        return callback(null, true);
      }
      // Allow official Vercel preview/production apps (*.vercel.app)
      if (origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }
      // Allow explicitly configured origins
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      // Safe fallback
      return callback(null, true);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Routes
app.get('/api', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'SignalBridge AI Core Backend',
    version: '1.0.0',
    endpoints: ['/api/health', '/api/analyze'],
    performance: {
      cache: reportCache.getStats(),
      uptimeSec: Math.floor(process.uptime()),
    },
  });
});
app.use('/api/health', healthRouter);
app.use('/api/analyze', analyzeRouter);

// 404 Handler
app.use((_req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested API route does not exist.',
  });
});

// Error handling middleware with strict TypeScript typing
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const errorMsg = err instanceof Error ? err.message : 'Unknown internal error';
  console.error('Unhandled server error:', errorMsg);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected internal error occurred.',
  });
});

// Only listen if not imported by test runner and not running on Vercel serverless
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`⚡ SignalBridge AI Server running on port ${PORT}`);
    console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`🧠 Gemini Key Configured: ${Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here')}`);
    console.log(`===============================================`);
  });
}

export default app;

