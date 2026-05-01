import { config } from './config.js';
import { createApp } from './app.js';

const app = createApp();

app.listen(config.port, '0.0.0.0', () => {
  console.log(`API listening on port ${config.port} (Network and Localhost)`);
});

