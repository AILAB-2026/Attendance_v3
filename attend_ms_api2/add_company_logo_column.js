import pkg from 'pg';
const { Pool } = pkg;

async function addLogoColumn() {
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'pgsql@2025',
    database: 'attendance_db'
  });

  try {
    console.log('\n🔄 Adding logo_url column to companies table...\n');

    // Add logo_url column
    await pool.query(`
      ALTER TABLE companies 
      ADD COLUMN IF NOT EXISTS logo_url VARCHAR(255)
    `);
    console.log('✅ Column added successfully');

    // Update existing companies with logo URLs
    console.log('\n📝 Setting default logo URLs for companies...\n');
    
    await pool.query(`UPDATE companies SET logo_url = '/images/brk_logo.png' WHERE company_code = 'BRK'`);
    console.log('✅ BRK logo URL set');
    
    await pool.query(`UPDATE companies SET logo_url = '/images/skk_logo.png' WHERE company_code = 'SKK'`);
    console.log('✅ SKK logo URL set');
    
    await pool.query(`UPDATE companies SET logo_url = '/images/ailab_logo.png' WHERE company_code = 'AILAB'`);
    console.log('✅ AILAB logo URL set');

    // Verify
    console.log('\n📊 Current company logos:\n');
    const result = await pool.query(`
      SELECT company_code, company_name, logo_url, active
      FROM companies
      ORDER BY company_code
    `);

    result.rows.forEach(row => {
      console.log(`   - ${row.company_code}: ${row.logo_url || 'No logo set'}`);
    });

    await pool.end();
    console.log('\n✅ Migration completed successfully!\n');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

addLogoColumn();
