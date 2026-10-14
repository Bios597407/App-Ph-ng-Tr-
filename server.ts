import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './src/server/routes.ts';
import { loadDatabase, createAutomaticBackup } from './src/server/db.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Initialize database & startup snapshot
try {
  const db = loadDatabase('live');
  createAutomaticBackup(db, 'server_startup');
  console.log('TroXanh 9P: Cơ sở dữ liệu khởi động thành công với 9 phòng.');
} catch (err) {
  console.error('Lỗi nạp database:', err);
}

// Mount REST API
app.use('/api', apiRouter);

// Vite middleware for development or static dist files for production
const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction) {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.resolve(__dirname, 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`TroXanh 9P đang chạy tại: http://0.0.0.0:${PORT}`);
});
