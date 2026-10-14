import express from 'express';
import { apiRouter } from '../src/server/routes.ts';
import { loadDatabase } from '../src/server/db.ts';

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

try {
  loadDatabase('live');
} catch (e) {
  console.error('Vercel DB Init Notice:', e);
}

app.use('/api', apiRouter);

export default app;
