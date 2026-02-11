import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function addMimeTypeAndLogos() {
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'pgsql@2025',
    database: 'attendance_db'
  });

  try {
    console.log('\n🔄 Step 1: Adding logo_mime_type column...\n');

    // Add logo_mime_type column if it doesn't exist
    await pool.query(`
      ALTER TABLE companies 
      ADD COLUMN IF NOT EXISTS logo_mime_type VARCHAR(50) DEFAULT 'image/png'
    `);
    console.log('✅ logo_mime_type column added\n');

    console.log('🔄 Step 2: Inserting company logos...\n');

    const logoFiles = [
      { 
        company: 'AILAB', 
        file: path.join(__dirname, '../AIAttend_v2/assets/images/ai_lab_logo.jpg'),
        mimeType: 'image/jpeg'
      },
      { 
        company: 'SKK', 
        file: path.join(__dirname, '../AIAttend_v2/assets/images/SKK_Logo 1.png'),
        mimeType: 'image/png'
      }
    ];

    for (const { company, file, mimeType } of logoFiles) {
      console.log(`📁 Processing ${company}...`);
      console.log(`   File path: ${file}`);
      
      if (!fs.existsSync(file)) {
        console.error(`   ❌ File not found: ${file}`);
        console.log(`   ⚠️  Skipping ${company}\n`);
        continue;
      }

      const imageBuffer = fs.readFileSync(file);
      const fileSizeKB = (imageBuffer.length / 1024).toFixed(2);
      
      console.log(`   📊 File size: ${fileSizeKB} KB`);
      console.log(`   📝 MIME type: ${mimeType}`);
      
      const updateResult = await pool.query(
        `UPDATE companies 
         SET logo_image = $1, logo_mime_type = $2 
         WHERE company_code = $3
         RETURNING company_code, company_name`,
        [imageBuffer, mimeType, company]
      );
      
      if (updateResult.rowCount > 0) {
        console.log(`   ✅ ${company} logo inserted successfully`);
        console.log(`   📋 Company: ${updateResult.rows[0].company_name}\n`);
      } else {
        console.log(`   ⚠️  No company found with code: ${company}\n`);
      }
    }

    // Verify the logos were inserted
    console.log('📊 Final verification:\n');
    const result = await pool.query(`
      SELECT company_code, company_name, 
             CASE WHEN logo_image IS NOT NULL 
                  THEN CONCAT(ROUND(LENGTH(logo_image) / 1024.0, 2), ' KB') 
                  ELSE 'No Image' 
             END as logo_size,
             logo_mime_type
      FROM companies
      WHERE company_code IN ('AILAB', 'SKK', 'BRK')
      ORDER BY company_code
    `);

    console.log('Company Logos Status:');
    console.log('─'.repeat(70));
    result.rows.forEach(row => {
      const status = row.logo_size !== 'No Image' ? '✅' : '❌';
      console.log(`${status} ${row.company_code.padEnd(10)} | ${row.logo_size.padEnd(15)} | ${row.logo_mime_type || 'N/A'}`);
    });
    console.log('─'.repeat(70));

    await pool.end();
    console.log('\n✅ Process completed successfully!\n');
    console.log('📝 Next steps:');
    console.log('   1. Restart the API server (if running)');
    console.log('   2. Login to mobile app with AILAB or SKK credentials');
    console.log('   3. Verify company logo appears in top-left corner\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

addMimeTypeAndLogos();
