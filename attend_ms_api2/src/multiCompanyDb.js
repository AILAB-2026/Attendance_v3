import pkg from 'pg';
const { Pool } = pkg;

// Cache for company pools
const pools = new Map();

// Master pool for fetching company configurations
export const masterPool = new Pool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "openpg",
    database: process.env.DB_NAME || "attendance_db",
    password: process.env.DB_PASSWORD || "openpgpwd",
    port: process.env.DB_PORT || 5432,
    max: 5,
});

/**
 * Get configuration for a specific company from the master database
 */
export const getCompanyConfig = async (companyCode) => {
    try {
        const res = await masterPool.query(
            "SELECT * FROM companies WHERE LOWER(company_code) = LOWER($1) AND active = true",
            [companyCode]
        );
        return res.rows[0] || null;
    } catch (err) {
        console.error(`[MultiDb] Error fetching config for ${companyCode}:`, err.message);
        return null;
    }
};

/**
 * Get or create a connection pool for a specific company
 */
export const getCompanyPool = async (companyCode) => {
    if (pools.has(companyCode)) {
        return pools.get(companyCode);
    }

    console.log(`[MultiLogin] 🔍 Attempting to get company pool for: ${companyCode}`);

    const config = await getCompanyConfig(companyCode);
    if (!config) {
        throw new Error(`Company ${companyCode} not found or inactive`);
    }

    console.log(`[MultiLogin] ✅ Company pool obtained successfully`);
    console.log(`[MultiLogin] 🛠 Initializing pool for company: ${companyCode}`);
    console.log(`[MultiLogin] 📦 Config for ${companyCode}. DB: ${config.database_name}, Host: ${config.server_host}`);

    try {
        const pool = new Pool({
            host: config.server_host || 'localhost',
            port: config.server_port || 5432,
            user: config.server_user,
            password: config.server_password,
            database: config.database_name,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });

        // Test connection
        await pool.query('SELECT 1');
        console.log(`[MultiDb] Successfully connected to ${config.database_name}`);

        pools.set(companyCode, pool);
        return pool;
    } catch (err) {
        console.error(`[MultiDb] Initialization error for ${companyCode}:`, err.message);
        throw err;
    }
};
