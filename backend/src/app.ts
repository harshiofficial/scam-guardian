/**
 * ScamGuardian Backend — Express Application
 */
import express, { Application } from 'express';
import cors from 'cors';
import { alertRouter, guardianRouter } from './routes';

const app: Application = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'scam-guardian-backend' });
});

// Routes
app.use('/alert', alertRouter);
app.use('/guardian', guardianRouter);

export default app;
