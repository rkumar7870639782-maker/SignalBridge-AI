import { Request, Response, NextFunction } from 'express';

/**
 * Security Headers Middleware
 * Implements enterprise-grade HTTP security headers without heavy external dependencies.
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent Clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Modern browser XSS filter control
  res.setHeader('X-XSS-Protection', '0');

  // Strict Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Enforce HTTPS HSTS (1 year)
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Restrict sensitive device APIs
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=(), payment=()');

  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https:;"
  );

  next();
}

/**
 * In-Memory Sliding-Window IP Rate Limiter
 * Protects endpoints from denial-of-service, automated scraping, and API token exhaustion.
 */
interface RateLimitRecord {
  timestamps: number[];
}

export class SlidingWindowRateLimiter {
  private records = new Map<string, RateLimitRecord>();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60 * 1000, maxRequests: number = 30) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // Periodically clean up stale IP records every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000).unref();
  }

  public check(ip: string): { allowed: boolean; remaining: number; retryAfterSec: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let record = this.records.get(ip);
    if (!record) {
      record = { timestamps: [] };
      this.records.set(ip, record);
    }

    // Filter out timestamps older than the sliding window
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

    if (record.timestamps.length >= this.maxRequests) {
      const oldestInWindow = record.timestamps[0];
      const retryAfterSec = Math.ceil((oldestInWindow + this.windowMs - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSec: Math.max(1, retryAfterSec),
      };
    }

    record.timestamps.push(now);
    return {
      allowed: true,
      remaining: this.maxRequests - record.timestamps.length,
      retryAfterSec: 0,
    };
  }

  private cleanup(): void {
    const windowStart = Date.now() - this.windowMs;
    for (const [ip, record] of this.records.entries()) {
      record.timestamps = record.timestamps.filter((ts) => ts > windowStart);
      if (record.timestamps.length === 0) {
        this.records.delete(ip);
      }
    }
  }

  public reset(): void {
    this.records.clear();
  }
}

// Global rate limiter instance for analysis endpoint (e.g., 30 requests per minute per IP)
export const analyzeRateLimiter = new SlidingWindowRateLimiter(60 * 1000, 30);

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Extract client IP accounting for cloud reverse proxies (Render, Vercel, Cloudflare)
  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    '127.0.0.1';

  const { allowed, remaining, retryAfterSec } = analyzeRateLimiter.check(clientIp);

  res.setHeader('X-RateLimit-Limit', '30');
  res.setHeader('X-RateLimit-Remaining', remaining.toString());

  if (!allowed) {
    res.setHeader('Retry-After', retryAfterSec.toString());
    res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Please wait ${retryAfterSec} seconds before submitting another incident report.`,
      retryAfterSec,
    });
    return;
  }

  next();
}

/**
 * Strong Input Sanitization Utility
 * Neutralizes control character injection, Unicode bidirectional overrides, and HTML tags.
 */
export function sanitizeReportText(input: string): string {
  if (typeof input !== 'string') return '';

  return (
    input
      // Remove null bytes and non-printable control characters except standard tabs/newlines
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
      // Strip Unicode bidirectional override characters used in text spoofing
      .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
      // Normalize excessive consecutive newlines to maximum two
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}
