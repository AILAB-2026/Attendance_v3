
import pkg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const { Pool } = pkg;

const masterPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: 'attendance_db',
});

async function showMappings() {
    try {
        const result = await masterPool.query(
            "SELECT company_code, mapping_json FROM schema_mappings WHERE endpoint = 'payslips'"
        );

        let output = "";
        result.rows.forEach(row => {
            output += `\n=== ${row.company_code} ===\n`;
            output += JSON.stringify(row.mapping_json, null, 2) + "\n";
        });

        fs.writeFileSync('mappings_output.txt', output);
        console.log("Mappings written to mappings_output.txt");

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await masterPool.end();
    }
}

showMappings();
