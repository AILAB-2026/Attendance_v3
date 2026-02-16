import dotenv from "dotenv";
import pkg from "pg";
const { Pool } = pkg;

dotenv.config();

const pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "attendance_db",
});

async function migrate() {
    try {
        console.log("Checking if show_survey column exists...");
        const res = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'companies' AND column_name = 'show_survey'
        `);

        if (res.rows.length === 0) {
            console.log("Adding show_survey column to companies table...");
            await pool.query(`
                ALTER TABLE companies 
                ADD COLUMN show_survey boolean DEFAULT true;
            `);
            console.log("Column added successfully.");
        } else {
            console.log("Column show_survey already exists.");
        }
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await pool.end();
    }
}

migrate();
