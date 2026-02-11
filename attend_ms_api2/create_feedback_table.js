
import { createRequire } from "module";
const require = createRequire(import.meta.url);
require("dotenv").config();

// We need to import multiCompanyDb.js dynamically to ensure env vars are loaded first, 
// OR rely on the fact that standard import happens after this block? No, imports are hoisted.
// But dotenv.config() above is synchronous. 
// However, standard `import`s are evaluated *before* the code runs. 
// So `import { ... } from "./src/multiCompanyDb.js"` runs *before* `require("dotenv").config()`.
// This is why the previous run failed. 
// I must use dynamic import() or move dotenv config to a separate file imported first, 
// OR just use the `node -r dotenv/config` argument, but I want a self-contained script.

// Solution: Use dynamic import.

const run = async () => {
    // Load envs
    const { default: dotenv } = await import("dotenv");
    dotenv.config();

    // Now import DB
    const { getCompanyPool, masterPool } = await import("./src/multiCompanyDb.js");

    const COMPANIES = ['AILAB', 'SKK', 'BRK'];

    try {
        console.log("Checking companies table schema...");
        try {
            await masterPool.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS show_feedback BOOLEAN DEFAULT TRUE`);
            console.log("✅ show_feedback column ensured in companies table.");
        } catch (e) {
            console.log("⚠️ Could not alter companies table (might be permissions or table missing):", e.message);
        }

        for (const code of COMPANIES) {
            try {
                console.log(`Processing ${code}...`);
                // getCompanyPool throws if company not found, so catch block handles it
                const pool = await getCompanyPool(code);

                console.log(`[${code}] Creating app_feedback table...`);

                await pool.query(`
                    CREATE TABLE IF NOT EXISTS app_feedback (
                        id SERIAL PRIMARY KEY,
                        employee_no VARCHAR(50),
                        employee_name VARCHAR(100),
                        is_anonymous BOOLEAN DEFAULT FALSE,
                        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
                        work_environment VARCHAR(50),
                        supervisor_support INTEGER CHECK (supervisor_support >= 1 AND supervisor_support <= 5),
                        comments TEXT,
                        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
                    );
                `);

                console.log(`✅ [${code}] app_feedback table created.`);

            } catch (err) {
                console.error(`❌ [${code}] Error:`, err.message);
            }
        }
    } catch (e) {
        console.error("Global Error:", e);
    }
    process.exit(0);
};

run();
