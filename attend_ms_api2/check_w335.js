import dotenv from 'dotenv';
dotenv.config();

import { query } from './src/dbconn.js';

console.log('Checking employee B1-W335...\n');

query(`
  SELECT id, "x_Emp_No", name, active, company_id
  FROM hr_employee
  WHERE "x_Emp_No" = 'B1-W335' AND company_id = 1
`, [], (err, res) => {
  if (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }

  if (res.rows.length === 0) {
    console.log('Employee not found');
    process.exit(1);
  }

  const emp = res.rows[0];
  console.log('Employee ID:', emp.id);
  console.log('Employee No:', emp.x_Emp_No);
  console.log('Name:', emp.name);
  console.log('Active:', emp.active ? 'YES' : 'NO');
  console.log('Company:', emp.company_id);
  
  console.log('\n' + (emp.active ? '✅ Employee is ACTIVE - should be able to login' : '❌ Employee is INACTIVE - login allowed but features restricted'));
  
  if (!emp.active) {
    console.log('\nTo activate this employee, run:');
    console.log('UPDATE hr_employee SET active = true WHERE "x_Emp_No" = \'B1-W335\' AND company_id = 1;');
  }
  
  process.exit(0);
});
