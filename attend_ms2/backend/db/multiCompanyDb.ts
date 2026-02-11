import { Pool } from 'pg';

// Master DB pool (attendance_db) - initialized once
let masterPool: Pool | null = null;

// Company metadata cache: Map<companyCode, { value, expiresAt }>
const companyCache = new Map<string, { value: any; expiresAt: number }>();

// Company DB pools cache: Map<companyCode, { pool, lastUsedAt }>
const companyPools = new Map<string, { pool: Pool; lastUsedAt: number }>();

// Cache TTL: 10 minutes
const CACHE_TTL_MS = 10 * 60 * 1000;

// Idle pool sweep interval: 5 minutes
const IDLE_POOL_SWEEP_MS = 5 * 60 * 1000;

// Idle threshold: 30 minutes
const IDLE_THRESHOLD_MS = 30 * 60 * 1000;

/**
 * Initialize the master DB pool (attendance_db)
 */
export const initMasterPool = async () => {
  if (masterPool) {
    return masterPool;
  }

  masterPool = new Pool({
    host: process.env.DB_HOST || process.env.MASTER_DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || process.env.MASTER_DB_PORT || 5432),
    user: process.env.DB_USER || process.env.MASTER_DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.MASTER_DB_PASSWORD || 'pgsql@2025',
    database: process.env.DB_NAME || process.env.MASTER_DB_NAME || 'attendance_db',
    max: Number(process.env.MASTER_DB_MAX_CLIENTS || 20),
    idleTimeoutMillis: Number(process.env.MASTER_DB_IDLE_TIMEOUT_MS || 30000),
    connectionTimeoutMillis: Number(process.env.MASTER_DB_CONN_TIMEOUT_MS || 5000),
  });

  // Test connection
  try {
    await masterPool.query('SELECT 1');
    console.log('[multiCompanyDb] Master pool (attendance_db) initialized successfully');
  } catch (err) {
    console.error('[multiCompanyDb] Failed to initialize master pool:', err);
    masterPool = null;
    throw err;
  }

  // Start idle pool sweep
  startIdlePoolSweep();

  return masterPool;
};

/**
 * Get master pool, initializing if needed
 */
export const getMasterPool = async () => {
  if (!masterPool) {
    return await initMasterPool();
  }
  return masterPool;
};

/**
 * Get company config from attendance_db.companies with caching
 */
export const getCompanyConfig = async (companyCode: string) => {
  const normalized = String(companyCode || '').trim().toUpperCase();
  if (!normalized) return null;

  const now = Date.now();
  const cached = companyCache.get(normalized);
  if (cached && now < cached.expiresAt) {
    return cached.value;
  }

  const pool = await getMasterPool();
  const queryText = `
    SELECT
      company_code,
      company_name,
      server_host,
      server_port,
      server_user,
      server_password,
      db_name,
      active
    FROM companies
    WHERE UPPER(TRIM(company_code)) = $1
  `;

  let result;
  try {
    result = await pool.query(queryText, [normalized]);
  } catch (err) {
    console.error(`[multiCompanyDb] Error querying company config for ${normalized}:`, err);
    // Negative cache: store null for 1 minute
    companyCache.set(normalized, { value: null, expiresAt: now + 60000 });
    return null;
  }

  if (result.rows.length === 0) {
    console.warn(`[multiCompanyDb] Company not found: ${normalized}`);
    // Negative cache
    companyCache.set(normalized, { value: null, expiresAt: now + 60000 });
    return null;
  }

  const row = result.rows[0];
  if (!row.active) {
    console.warn(`[multiCompanyDb] Company is inactive: ${normalized}`);
    // Negative cache
    companyCache.set(normalized, { value: null, expiresAt: now + 60000 });
    return null;
  }

  const config = {
    companyCode: row.company_code,
    companyName: row.company_name,
    host: row.server_host,
    port: row.server_port,
    user: row.server_user,
    password: row.server_password,
    dbName: row.db_name,
    active: row.active,
  };

  // Cache for TTL
  companyCache.set(normalized, { value: config, expiresAt: now + CACHE_TTL_MS });
  return config;
};

/**
 * Get or create a company DB pool
 */
export const getCompanyPool = async (companyCode: string) => {
  const normalized = String(companyCode || '').trim().toUpperCase();
  if (!normalized) {
    throw new Error('Company code is required');
  }

  const config = await getCompanyConfig(normalized);
  if (!config) {
    throw new Error('Company not found or inactive');
  }

  let entry = companyPools.get(normalized);
  if (entry) {
    entry.lastUsedAt = Date.now();
    return entry.pool;
  }

  const pool = new Pool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.dbName,
    max: Number(process.env.COMPANY_DB_MAX_CLIENTS || 10),
    idleTimeoutMillis: Number(process.env.COMPANY_DB_IDLE_TIMEOUT_MS || 30000),
    connectionTimeoutMillis: Number(process.env.COMPANY_DB_CONN_TIMEOUT_MS || 3000),
  });

  // Health check
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    await pool.end();
    throw new Error(`Failed to connect to company DB ${normalized}: ${err}`);
  }

  companyPools.set(normalized, { pool, lastUsedAt: Date.now() });
  console.log(`[multiCompanyDb] Created pool for company: ${normalized}`);
  return pool;
};

/**
 * Start idle pool sweep to clean up unused pools
 */
const startIdlePoolSweep = () => {
  setInterval(() => {
    const now = Date.now();
    const toRemove: string[] = [];

    companyPools.forEach((entry, companyCode) => {
      if (now - entry.lastUsedAt > IDLE_THRESHOLD_MS) {
        toRemove.push(companyCode);
      }
    });

    toRemove.forEach(async (companyCode) => {
      const entry = companyPools.get(companyCode);
      if (entry) {
        try {
          await entry.pool.end();
          companyPools.delete(companyCode);
          console.log(`[multiCompanyDb] Closed idle pool for company: ${companyCode}`);
        } catch (err) {
          console.error(`[multiCompanyDb] Error closing pool for ${companyCode}:`, err);
        }
      }
    });
  }, IDLE_POOL_SWEEP_MS);
};

/**
 * Shutdown all pools gracefully
 */
export const shutdownAllPools = async () => {
  const promises: Promise<void>[] = [];

  companyPools.forEach((entry) => {
    promises.push(entry.pool.end());
  });

  if (masterPool) {
    promises.push(masterPool.end());
  }

  await Promise.all(promises);
  console.log('[multiCompanyDb] All pools shut down');
};
