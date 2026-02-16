import dotenv from 'dotenv';
dotenv.config();
import { query } from './src/dbconn.js';

console.log('Checking hr_leave table columns...\n');

query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'hr_leave'
  ORDER BY ordinal_position
`, [], (err, result) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('hr_leave table columns:');
    result.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });
  }
  process.exit(0);
});
