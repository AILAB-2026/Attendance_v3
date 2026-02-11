import dotenv from 'dotenv';
dotenv.config();
import { query } from './src/dbconn.js';

console.log('Testing B1-E079 employee data...\n');

// Test employee B1-E079 (ID: 267 from memory)
console.log('1️⃣ Checking employee B1-E079...');
query(
  `SELECT id, "x_Emp_No", name, active, l_face_descriptor IS NOT NULL as has_face 
   FROM hr_employee 
   WHERE "x_Emp_No" = $1`,
  ['B1-E079'],
  (error, result) => {
    if (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
    
    if (result.rows.length === 0) {
      console.log('❌ Employee B1-E079 not found');
      process.exit(1);
    }
    
    const employee = result.rows[0];
    console.log('✅ Employee found:', employee);
    
    // Check leave records
    console.log('\n2️⃣ Checking leave records...');
    query(
      `SELECT id, employee_id, holiday_status_id, date_from, date_to, number_of_days, state, create_date
       FROM hr_leave 
       WHERE employee_id = $1
       ORDER BY create_date DESC
       LIMIT 5`,
      [employee.id],
      (error2, result2) => {
        if (error2) {
          console.error('❌ Error:', error2.message);
        } else {
          console.log(`✅ Found ${result2.rows.length} leave records`);
          if (result2.rows.length > 0) {
            result2.rows.forEach((leave, idx) => {
              console.log(`   ${idx + 1}. Leave ID ${leave.id}: ${leave.date_from} to ${leave.date_to}, ${leave.number_of_days} days, state: ${leave.state}`);
            });
          }
        }
        
        // Check payslip records
        console.log('\n3️⃣ Checking payslip records...');
        query(
          `SELECT id, employee_id, employee_name, x_emp_no, month, pay_year, 
                  x_basic_salary, x_allowance, deduction_amount, net_pay_amount, payslipurl
           FROM employee_payslip 
           WHERE employee_id = $1
           ORDER BY x_pay_date DESC
           LIMIT 5`,
          [employee.id],
          (error3, result3) => {
            if (error3) {
              console.error('❌ Error:', error3.message);
            } else {
              console.log(`✅ Found ${result3.rows.length} payslip records`);
              if (result3.rows.length > 0) {
                result3.rows.forEach((payslip, idx) => {
                  console.log(`   ${idx + 1}. ${payslip.month}-${payslip.pay_year}: Basic $${payslip.x_basic_salary}, Allowance $${payslip.x_allowance}, Net $${payslip.net_pay_amount}`);
                });
              }
            }
            
            console.log('\n✅ All tests complete!');
            process.exit(0);
          }
        );
      }
    );
  }
);
