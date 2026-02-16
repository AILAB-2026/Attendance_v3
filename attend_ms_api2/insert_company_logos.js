import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function insertCompanyLogos() {
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'pgsql@2025',
    database: 'attendance_db'
  });

  try {
    console.log('\n🔄 Inserting company logos into database...\n');

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
        continue;
      }

      const imageBuffer = fs.readFileSync(file);
      const fileSizeKB = (imageBuffer.length / 1024).toFixed(2);
      
      console.log(`   📊 File size: ${fileSizeKB} KB`);
      
      await pool.query(
        `UPDATE companies 
         SET logo_image = $1, logo_mime_type = $2 
         WHERE company_code = $3`,
        [imageBuffer, mimeType, company]
      );
      
      console.log(`   ✅ ${company} logo inserted successfully\n`);
    }

    // Verify the logos were inserted
    console.log('📊 Verifying logo insertion:\n');
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

    result.rows.forEach(row => {
      console.log(`   ${row.company_code}: ${row.logo_size} (${row.logo_mime_type || 'N/A'})`);
    });

    await pool.end();
    console.log('\n✅ Logo insertion completed successfully!\n');
    console.log('📝 Next steps:');
    console.log('   1. Restart the API server if running');
    console.log('   2. Login to the mobile app with AILAB or SKK credentials');
    console.log('   3. Check if the company logo appears in the top-left corner\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

insertCompanyLogos();
