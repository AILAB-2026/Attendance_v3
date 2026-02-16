import dotenv from 'dotenv';
dotenv.config();
import { query } from './src/dbconn.js';

console.log('Testing database queries...\n');

// Test 1: Check hr_employee table
console.log('1️⃣ Testing hr_employee query for B1-W422...');
query(
  `SELECT id, "x_Emp_No", name, active, l_face_descriptor IS NOT NULL as has_face 
   FROM hr_employee 
   WHERE "x_Emp_No" = $1 AND company_id = $2`,
  ['B1-W422', 1],
  (error, result) => {
    if (error) {
      console.error('❌ Error:', error.message);
    } else {
      console.log('✅ Employee found:', result.rows[0]);
    }
    
    // Test 2: Check hr_leave table
    console.log('\n2️⃣ Testing hr_leave table...');
    query(
      `SELECT id, employee_id, holiday_status_id, date_from, date_to, number_of_days, state, create_date
       FROM hr_leave 
       WHERE employee_id = $1
       ORDER BY create_date DESC
       LIMIT 5`,
      [result.rows[0]?.id],
      (error2, result2) => {
        if (error2) {
          console.error('❌ Error:', error2.message);
        } else {
          console.log(`✅ Found ${result2.rows.length} leave records`);
          if (result2.rows.length > 0) {
            console.log('   Latest leave:', result2.rows[0]);
          }
        }
        
        // Test 3: Check employee_payslip table
        console.log('\n3️⃣ Testing employee_payslip table...');
        query(
          `SELECT id, employee_id, employee_name, x_emp_no, month, pay_year, 
                  x_basic_salary, x_allowance, deduction_amount, net_pay_amount, payslipurl
           FROM employee_payslip 
           WHERE employee_id = $1
           ORDER BY x_pay_date DESC
           LIMIT 3`,
          [result.rows[0]?.id],
          (error3, result3) => {
            if (error3) {
              console.error('❌ Error:', error3.message);
            } else {
              console.log(`✅ Found ${result3.rows.length} payslip records`);
              if (result3.rows.length > 0) {
                console.log('   Latest payslip:', result3.rows[0]);
              }
            }
            
            console.log('\n✅ All database tests complete!');
            process.exit(0);
          }
        );
      }
    );
  }
);
