
import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";
import fs from "fs";

const COMPANY_CODE = 'AILAB';

const run = async () => {
    try {
        const pool = await getCompanyPool(COMPANY_CODE);

        // Original definition from file
        let funcDef = fs.readFileSync('func_def.txt', 'utf8');

        // Replace the connection string
        // Old: v_conn text := 'host=15.235.210.115 port=5432 dbname=attendance_db user=openpg password=openpgpwd';
        // New: v_conn text := 'host=127.0.0.1 port=5432 dbname=attendance_db user=postgres';

        // Using regex to match the line safely
        const oldConnRegex = /v_conn text := 'host=[^;]+';/;
        const newConnLine = "v_conn text := 'host=127.0.0.1 port=5432 dbname=attendance_db user=postgres password=pgsql@2025';";

        if (!oldConnRegex.test(funcDef)) {
            console.error("Could not find v_conn line in function definition.");
            process.exit(1);
        }

        const newFuncDef = funcDef.replace(oldConnRegex, newConnLine);

        console.log(`Updating function hr_leave_sync_to_mobile with new connection string...`);
        // console.log(newFuncDef); // Debug if needed

        await pool.query(newFuncDef);

        console.log(`✅ Function updated successfully.`);

        process.exit(0);
    } catch (err) {
        console.error("❌ Error updating function:", err);
        process.exit(1);
    }
};

run();
