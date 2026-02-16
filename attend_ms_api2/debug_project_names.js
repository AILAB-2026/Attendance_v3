import dotenv from 'dotenv';
import { query } from './src/dbconn.js';

dotenv.config();

async function debugProjectNames() {
  try {
    console.log('=== Debugging Project Names ===\n');
    
    // Get raw data from project_project
    const result = await query(`
      SELECT 
        id,
        name,
        pg_typeof(name) as name_type,
        name::text as name_text,
        active
      FROM project_project
      WHERE active = true
      LIMIT 5
    `);
    
    console.log(`Found ${result.rows.length} active projects:\n`);
    
    result.rows.forEach((row, index) => {
      console.log(`Project ${index + 1}:`);
      console.log(`  ID: ${row.id}`);
      console.log(`  Name (raw): ${JSON.stringify(row.name)}`);
      console.log(`  Name type: ${row.name_type}`);
      console.log(`  Name as text: ${row.name_text}`);
      
      // Try to extract the en_US value
      const nameText = row.name_text;
      const match = nameText.match(/"en_US"\s*:\s*"([^"]*)"/);
      if (match) {
        console.log(`  Extracted name: ${match[1]}`);
      } else {
        console.log(`  Could not extract name from: ${nameText}`);
      }
      console.log('');
    });
    
    // Now test the actual query used in the API
    console.log('\n=== Testing API Query (FIXED) ===\n');
    const apiResult = await query(`
      SELECT DISTINCT 
        p.id as site_id,
        CASE 
          WHEN p.name::text ~ '^\\{' THEN 
            CASE 
              WHEN p.name::text ~ '"en_US"' THEN 
                substring(p.name::text from '"en_US"[[:space:]]*:[[:space:]]*"([^"]*)"')
              ELSE 'Unknown Site'
            END
          ELSE p.name::text
        END as site_name
      FROM project_project p
      WHERE p.active = true 
      ORDER BY 1
      LIMIT 10
    `);
    
    console.log(`API query returned ${apiResult.rows.length} rows:\n`);
    apiResult.rows.forEach((row, index) => {
      console.log(`${index + 1}. Site ID: ${row.site_id}, Site Name: ${row.site_name}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

debugProjectNames();
