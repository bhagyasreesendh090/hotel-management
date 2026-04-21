import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import propertyRoutes from './routes/properties.js';
import crsRoutes from './routes/crs.js';
import crmRoutes from './routes/crm.js';
import banquetRoutes from './routes/banquet.js';
import corporateRoutes from './routes/corporate.js';
import financeRoutes from './routes/finance.js';
import reportsRoutes from './routes/reports.js';
import publicRoutes from './routes/public.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (req, res) => res.json({ ok: true }));

  app.use('/api/public', publicRoutes);

  app.use('/api/auth', authRoutes);
  app.use('/api/properties', propertyRoutes);
  app.use('/api/crs', crsRoutes);
  app.use('/api/crm', crmRoutes);
  app.use('/api/banquet', banquetRoutes);
  app.use('/api/corporate', corporateRoutes);
  app.use('/api/finance', financeRoutes);
  app.use('/api/reports', reportsRoutes);

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

