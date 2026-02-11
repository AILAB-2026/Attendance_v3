import pkg from "pg";
const { Pool } = pkg;

// Master DB (attendance_db) connection pool
// Uses dedicated MASTER_DB_* env vars if provided, otherwise falls back to DB_* with
// database name defaulting to "attendance_db".
const masterPoolConfig = {
  host: process.env.MASTER_DB_HOST || process.env.DB_HOST || "localhost",
  port: Number(process.env.MASTER_DB_PORT || process.env.DB_PORT || 5432),
  user: process.env.MASTER_DB_USER || process.env.DB_USER || "postgres",
  password: process.env.MASTER_DB_PASSWORD || process.env.DB_PASSWORD,
  database: process.env.MASTER_DB_NAME || "attendance_db",
  max: Number(process.env.MASTER_DB_MAX_CLIENTS || 10),
  idleTimeoutMillis: Number(process.env.MASTER_DB_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(process.env.MASTER_DB_CONN_TIMEOUT_MS || 2000),
};

console.log("[MultiCompanyDb] Master pool config:", {
  host: masterPoolConfig.host,
  port: masterPoolConfig.port,
  user: masterPoolConfig.user,
  database: masterPoolConfig.database,
  passwordLength: masterPoolConfig.password ? masterPoolConfig.password.length : 0,
});

const masterPool = new Pool(masterPoolConfig);

const COMPANY_CACHE_TTL_MS = Number(
  process.env.COMPANY_CACHE_TTL_MS || 10 * 60 * 1000
);
const COMPANY_CACHE_NEGATIVE_TTL_MS = Number(
  process.env.COMPANY_CACHE_NEGATIVE_TTL_MS || 60 * 1000
);

// In-memory cache: company_code (normalized) -> { value: CompanyConfig|null, expiresAt }
const companyCache = new Map();

/**
 * Lookup active company configuration from attendance_db.companies with caching.
 *
 * Expected columns in companies table:
 *  - company_code
 *  - company_name
 *  - server_host
 *  - server_port
 *  - server_user
 *  - server_password
 *  - db_name
 *  - active
 */
export const getCompanyConfig = async (companyCode) => {
  const normalized = String(companyCode || "").trim().toUpperCase();
  if (!normalized) return null;

  const now = Date.now();
  const cached = companyCache.get(normalized);
  if (cached && now < cached.expiresAt) {
    return cached.value;
  }

  const queryText = `
    SELECT
      company_code,
      company_name,
      server_host,
      server_port,
      server_user,
      server_password,
      database_name,
      active,
      show_attendance,
      show_history,
      show_leave,
      show_schedule,
      show_payroll,
      show_payroll,
      show_feedback,
      show_survey
    FROM companies
    WHERE UPPER(TRIM(company_code)) = $1
  `;

  let result;
  try {
    result = await masterPool.query(queryText, [normalized]);
  } catch (err) {
    console.error("[MultiCompany] Error querying master companies table:", err?.message || err);
    // Master DB failure is treated as no-company-found for callers
    companyCache.set(normalized, {
      value: null,
      expiresAt: now + COMPANY_CACHE_NEGATIVE_TTL_MS,
    });
    return null;
  }

  if (!result || result.rows.length === 0) {
    companyCache.set(normalized, {
      value: null,
      expiresAt: now + COMPANY_CACHE_NEGATIVE_TTL_MS,
    });
    return null;
  }

  const row = result.rows[0];
  if (!row.active) {
    companyCache.set(normalized, {
      value: null,
      expiresAt: now + COMPANY_CACHE_TTL_MS,
    });
    return null;
  }

  const config = {
    companyCode: row.company_code,
    companyName: row.company_name,
    // Fix for ENOTFOUND localhost: force 127.0.0.1 if localhost is returned from DB
    host: (row.server_host?.trim() === 'localhost') ? '127.0.0.1' : row.server_host?.trim(),
    port: Number(row.server_port || 5432),
    user: row.server_user,
    password: row.server_password,
    dbName: row.database_name,
    active: !!row.active,
    modules: {
      attendance: row.show_attendance ?? true,
      history: row.show_history ?? true,
      leave: row.show_leave ?? true,
      schedule: row.show_schedule ?? true,
      payroll: row.show_payroll ?? true,
      payroll: row.show_payroll ?? true,
      feedback: row.show_feedback ?? true,
      survey: row.show_survey ?? true,
    }
  };

  companyCache.set(normalized, {
    value: config,
    expiresAt: now + COMPANY_CACHE_TTL_MS,
  });

  return config;
};

// Dynamic per-company PostgreSQL pools
const companyPools = new Map(); // company_code (normalized) -> { pool, lastUsedAt }

const COMPANY_POOL_MAX_IDLE_MS = Number(
  process.env.COMPANY_POOL_MAX_IDLE_MS || 30 * 60 * 1000
);

export const getCompanyPool = async (companyCode) => {
  const normalized = String(companyCode || "").trim().toUpperCase();
  if (!normalized) {
    throw new Error("Company code is required");
  }

  const config = await getCompanyConfig(normalized);
  if (!config) {
    throw new Error("Company not found or inactive");
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
    connectionTimeoutMillis: Number(process.env.COMPANY_DB_CONN_TIMEOUT_MS || 10000),
  });

  // Fail-fast health check on first pool creation
  try {
    await pool.query("SELECT 1");
  } catch (err) {
    console.error(
      "[MultiCompany] Error connecting to company DB for",
      normalized,
      "::",
      err?.message || err
    );
    try {
      await pool.end();
    } catch (e) {
      // ignore close errors
    }
    throw err;
  }

  companyPools.set(normalized, { pool, lastUsedAt: Date.now() });
  return pool;
};

export const sweepIdleCompanyPools = () => {
  const now = Date.now();
  for (const [code, entry] of companyPools.entries()) {
    if (now - entry.lastUsedAt > COMPANY_POOL_MAX_IDLE_MS) {
      console.log("[MultiCompany] Closing idle pool for company", code);
      entry.pool
        .end()
        .catch((err) =>
          console.error(
            "[MultiCompany] Error closing pool for",
            code,
            ":",
            err?.message || err
          )
        );
      companyPools.delete(code);
    }
  }
};

const SWEEP_INTERVAL_MS = Number(
  process.env.COMPANY_POOL_SWEEP_INTERVAL_MS || 5 * 60 * 1000
);

if (SWEEP_INTERVAL_MS > 0) {
  setInterval(sweepIdleCompanyPools, SWEEP_INTERVAL_MS).unref();
}

export { masterPool };
