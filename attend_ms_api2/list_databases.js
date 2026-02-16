// List available databases
import pkg from "pg";
const { Pool } = pkg;

async function listDatabases() {
    console.log("🔍 Listing Available Databases");
    console.log("=====================================");
    
    // Connect to default postgres database to list all databases
    const pool = new Pool({
        host: 'localhost',
        user: 'openpg',
        database: 'postgres', // Connect to default database first
        password: 'openpgpwd',
        port: 5432,
        connectionTimeoutMillis: 5000,
    });
    
    try {
        console.log("✅ Connecting to PostgreSQL server...");
        
        // List all databases
        const result = await pool.query(`
            SELECT datname, datowner, encoding, datcollate, datctype 
            FROM pg_database 
            WHERE datistemplate = false 
            ORDER BY datname
        `);
        
        console.log(`✅ Found ${result.rows.length} databases:`);
        console.log("=====================================");
        
        result.rows.forEach((db, index) => {
            console.log(`${index + 1}. ${db.datname}`);
            console.log(`   Owner: ${db.datowner}`);
            console.log(`   Encoding: ${db.encoding}`);
            console.log("");
        });
        
        // Check for specific databases we're interested in
        const targetDatabases = ['CX18BRKHUB', 'CX18BRKERP', 'CX18AILABDEMO', 'CX18AI'];
        const availableDbs = result.rows.map(row => row.datname);
        
        console.log("🎯 Target Database Status:");
        console.log("=====================================");
        
        targetDatabases.forEach(dbName => {
            const exists = availableDbs.includes(dbName);
            console.log(`${exists ? '✅' : '❌'} ${dbName}: ${exists ? 'EXISTS' : 'NOT FOUND'}`);
        });
        
        // Suggest the best database to use
        const foundTargetDb = targetDatabases.find(db => availableDbs.includes(db));
        if (foundTargetDb) {
            console.log(`\n💡 Recommended database to use: ${foundTargetDb}`);
        } else {
            console.log(`\n💡 None of the target databases found. Available databases:`);
            availableDbs.forEach(db => console.log(`   - ${db}`));
        }
        
    } catch (error) {
        console.error("❌ Failed to list databases:");
        console.error(`Error: ${error.message}`);
        console.error(`Code: ${error.code}`);
        
        if (error.code === '28P01') {
            console.error("\n💡 Try different credentials:");
            console.error("   - User: postgres, Password: pgsql@2024");
            console.error("   - User: openpg, Password: openpgpwd");
        }
    } finally {
        await pool.end();
        process.exit(0);
    }
}

listDatabases();
