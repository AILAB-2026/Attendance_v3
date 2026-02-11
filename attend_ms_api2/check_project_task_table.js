import dotenv from 'dotenv';
dotenv.config();

import { query } from './src/dbconn.js';

console.log('🔍 Checking project_task table...\n');

// Check if table exists and its structure
query(`
  SELECT column_name, data_type
  FROM information_schema.columns 
  WHERE table_name = 'project_task'
  ORDER BY ordinal_position
  LIMIT 20
`, [], (err1, res1) => {
  if (err1) {
    console.error('❌ Error:', err1.message);
    process.exit(1);
  }

  if (res1.rows.length === 0) {
    console.log('❌ Table project_task does NOT exist!');
    console.log('\nSearching for similar tables...\n');
    
    query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE '%task%'
      ORDER BY table_name
    `, [], (err2, res2) => {
      if (err2) {
        console.error('❌ Error:', err2.message);
        process.exit(1);
      }

      console.log('Tables with "task" in name:');
      res2.rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
      
      process.exit(0);
    });
    return;
  }

  console.log('✅ project_task table exists!\n');
  console.log('Columns:');
  res1.rows.forEach(row => {
    console.log(`  - ${row.column_name} (${row.data_type})`);
  });

  // Check sample data
  console.log('\n📊 Checking sample tasks...\n');
  query(`
    SELECT id, name, project_id, description, date_deadline, active
    FROM project_task
    WHERE active = true
    LIMIT 5
  `, [], (err3, res3) => {
    if (err3) {
      console.error('❌ Error:', err3.message);
      process.exit(1);
    }

    console.log(`Found ${res3.rows.length} active tasks:\n`);
    res3.rows.forEach((task, i) => {
      console.log(`${i + 1}. ID: ${task.id} | Project: ${task.project_id} | Name: ${task.name}`);
    });

    if (res3.rows.length === 0) {
      console.log('⚠️  No active tasks found in the table');
    }

    process.exit(0);
  });
});
