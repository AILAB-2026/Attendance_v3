import pkg from 'pg';
const { Pool } = pkg;

async function checkAILABPassword() {
  const masterPool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'pgsql@2025',
    database: 'attendance_db'
  });

  try {
    const result = await masterPool.query(`
      SELECT 
        company_code,
        company_name,
        server_host,
        server_port,
        database_name,
        server_user,
        server_password
      FROM companies
      WHERE company_code = 'AILAB'
    `);

    if (result.rows.length > 0) {
      const config = result.rows[0];
      console.log('\n📊 AILAB Database Configuration:\n');
      console.log(`Company: ${config.company_name}`);
      console.log(`Host: ${config.server_host}`);
      console.log(`Port: ${config.server_port}`);
      console.log(`Database: ${config.database_name}`);
      console.log(`User: ${config.server_user}`);
      console.log(`Password: ${config.server_password || '(not set)'}`);
    }

    await masterPool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await masterPool.end();
  }
}

checkAILABPassword();
