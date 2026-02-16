/* Local Hono server runner */
// Load .env.production if it exists, otherwise fall back to .env
const path = require('path');
const fs = require('fs');
const envProdPath = path.join(__dirname, '..', '.env.production');
const envPath = path.join(__dirname, '..', '.env');
const envFile = fs.existsSync(envProdPath) ? envProdPath : envPath;
require('dotenv').config({ path: envFile, override: true });
console.log('Loaded env from:', envFile);
console.log('Env config: FACE_ENFORCE_STRICT=%s, SKIP_ASSIGNMENT_CHECK=%s, ALLOW_DEV_LOGIN=%s', process.env.FACE_ENFORCE_STRICT, process.env.SKIP_ASSIGNMENT_CHECK, process.env.ALLOW_DEV_LOGIN);
// Enable TypeScript support at runtime
try {
  require('ts-node').register({
    skipProject: true,
    transpileOnly: true,
    compilerOptions: {
      module: 'commonjs',
      moduleResolution: 'node',
      esModuleInterop: true,
      resolveJsonModule: true,
      skipLibCheck: true,
    },
  });
  // Enable path alias resolution from tsconfig (e.g. "@/*")
  require('tsconfig-paths/register');
} catch (e) {
  console.warn('ts-node not found. If server fails to start, run: npm i -D ts-node');
}
const { serve } = require('@hono/node-server');
const app = require('./hono.ts').default;

const port = Number(process.env.PORT) || 3000;
const hostname = process.env.HOST || '0.0.0.0';
serve({ fetch: app.fetch, port, hostname }, (info) => {
  const hostShown = hostname === '0.0.0.0' ? 'localhost' : hostname;
  console.log(`API server listening on http://${hostShown}:${port} (bound to ${hostname})`);
});
