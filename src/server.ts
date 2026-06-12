/**
 * src/server.ts
 * ─────────────────────────────────────────────────────────────────
 * Application entry point.
 *
 * Responsibilities:
 *   1. Load environment variables from .env
 *   2. Start the HTTP server on the configured port
 *   3. Launch the SyncService (immediately syncs matches, then loops)
 *   4. Handle graceful shutdown on SIGTERM/SIGINT
 * ─────────────────────────────────────────────────────────────────
 */
// Load .env before any other module reads process.env
import { config } from 'dotenv';
config();

import app from './app';
import { env } from './config/env';
import { startSyncService, stopSyncService } from './services/syncService';
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

const start = async (): Promise<void> => {
  try {
    // 1. Verify database connectivity
    await prisma.$connect();
    console.log('✅ Database connected.');

    // 2. Start the HTTP server
    const server = app.listen(env.PORT, () => {
      console.log(`\n🚀 World Cup Predictor API`);
      console.log(`   ➜ Environment : ${env.NODE_ENV}`);
      console.log(`   ➜ Listening on: http://localhost:${env.PORT}`);
      console.log(`   ➜ Health check: http://localhost:${env.PORT}/health`);
      console.log(`   ➜ API base URL: http://localhost:${env.PORT}/api\n`);
    });

    // 3. Start the SyncService (non-blocking — runs in the background)
    //    Initial sync runs immediately; subsequent syncs use adaptive intervals.
    startSyncService().catch((err) => {
      console.error('❌ SyncService startup error:', err);
    });

    // 4. Graceful shutdown handlers
    const shutdown = async (signal: string): Promise<void> => {
      console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);

      // Stop accepting new connections
      server.close(async () => {
        // Stop the sync timer
        stopSyncService();

        // Close the Prisma connection pool
        await prisma.$disconnect();
        console.log('✅ Database disconnected. Goodbye!');
        process.exit(0);
      });

      // Force exit if graceful shutdown takes too long
      setTimeout(() => {
        console.error('❌ Graceful shutdown timed out. Forcing exit.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle unhandled promise rejections (last resort)
    process.on('unhandledRejection', (reason) => {
      console.error('❌ Unhandled Promise Rejection:', reason);
    });

  } catch (err) {
    console.error('❌ Failed to start the server:', err);
    await prisma.$disconnect();
    process.exit(1);
  }
};

start();
