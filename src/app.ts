/**
 * src/app.ts
 * ─────────────────────────────────────────────────────────────────
 * Express application setup.
 * Configures all middleware, mounts all route groups, and registers
 * the global error handler as the final middleware in the chain.
 *
 * This file exports the configured app without starting the server,
 * keeping the setup testable in isolation from the HTTP listener.
 * ─────────────────────────────────────────────────────────────────
 */
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';

// Route modules
import authRoutes from './routes/authRoutes';
import groupRoutes from './routes/groupRoutes';
import matchRoutes from './routes/matchRoutes';
import predictionRoutes from './routes/predictionRoutes';

// Global error handler (must be last middleware)
import { errorHandler } from './middlewares/errorHandler';

const app = express();

// ─── Security Middleware ───────────────────────────────────────────────────

// Helmet sets security-relevant HTTP headers (XSS, clickjacking, MIME sniffing, etc.)
app.use(helmet());

// CORS — allow both Vite (:3001) and Next.js (:3002) frontends in dev
app.use(
  cors({
    origin:
      env.NODE_ENV === 'production'
        ? process.env.FRONTEND_ORIGIN ?? 'http://localhost:3002'
        : ['http://localhost:3001', 'http://localhost:3002'],
    credentials: true, // Allow cookies to be sent cross-origin
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// ─── Parsing Middleware ────────────────────────────────────────────────────

// Parse incoming JSON bodies (with a size limit to prevent payload attacks)
app.use(express.json({ limit: '10kb' }));

// Parse URL-encoded bodies (for form submissions, if any)
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Parse HttpOnly cookies — required for JWT authentication
app.use(cookieParser());

// ─── Health Check ─────────────────────────────────────────────────────────

/**
 * GET /health
 * Simple liveness probe for monitoring systems (k8s, Render, Railway, etc.)
 */
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/predictions', predictionRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────

// Catch all unmatched routes and return a clean 404
app.use((_req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'The requested resource was not found.',
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────

// Must be registered AFTER all routes and middleware
app.use(errorHandler);

export default app;
