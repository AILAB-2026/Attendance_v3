import pkg from 'pg';
const { Pool } = pkg;

async function checkWhichColumnUsed() {
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'pgsql@2025',
    database: 'attendance_db'
  });

  try {
    console.log('\n📊 Checking which logo type column has data...\n');

    const result = await pool.query(`
      SELECT 
        company_code,
        logo_content_type,
        logo_mime_type,
        CASE WHEN logo_image IS NOT NULL THEN 'Has Image' ELSE 'No Image' END as has_image
      FROM companies
      WHERE company_code IN ('AILAB', 'SKK', 'BRK')
      ORDER BY company_code
    `);

    console.log('Current data in both columns:');
    console.log('─'.repeat(80));
    console.log('Company    | logo_content_type | logo_mime_type | Image Status');
    console.log('─'.repeat(80));
    result.rows.forEach(row => {
      console.log(`${row.company_code.padEnd(10)} | ${(row.logo_content_type || 'NULL').padEnd(17)} | ${(row.logo_mime_type || 'NULL').padEnd(14)} | ${row.has_image}`);
    });
    console.log('─'.repeat(80));

    await pool.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

checkWhichColumnUsed();
