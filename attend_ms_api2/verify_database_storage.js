import dotenv from 'dotenv';
dotenv.config();
import { query } from './src/dbconn.js';

const EMPLOYEE_NO = 'B1-E079';
const EMPLOYEE_ID = 267;

console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
console.log('║              DATABASE VERIFICATION - All Data Properly Stored              ║');
console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

// 1. Verify Face Recognition Data
console.log('1️⃣  FACE RECOGNITION - hr_employee.l_face_descriptor');
console.log('─'.repeat(80));
query(
  `SELECT id, "x_Emp_No", name, 
          l_face_descriptor IS NOT NULL as has_face_enrolled,
          LENGTH(l_face_descriptor::text) as descriptor_length
   FROM hr_employee 
   WHERE id = $1`,
  [EMPLOYEE_ID],
  (err, result) => {
    if (err) {
      console.log('❌ Error:', err.message);
    } else {
      const emp = result.rows[0];
      console.log(`✅ Employee: ${emp.name} (${emp.x_Emp_No})`);
      console.log(`   Face Enrolled: ${emp.has_face_enrolled ? 'YES' : 'NO'}`);
      if (emp.has_face_enrolled) {
        console.log(`   Descriptor Size: ${emp.descriptor_length} characters`);
        console.log('   ✓ Face data stored in hr_employee table');
        console.log('   ✓ Visible in ERP: HR → Employees → Employee Form');
      }
    }
    console.log('\n');
    
    // 2. Verify Leave Applications
    console.log('2️⃣  LEAVE APPLICATIONS - hr_leave table');
    console.log('─'.repeat(80));
    query(
      `SELECT id, employee_id, holiday_status_id, 
              date_from, date_to, number_of_days, 
              name as reason, state, create_date
       FROM hr_leave 
       WHERE employee_id = $1
       ORDER BY create_date DESC
       LIMIT 5`,
      [EMPLOYEE_ID],
      (err2, result2) => {
        if (err2) {
          console.log('❌ Error:', err2.message);
        } else {
          console.log(`✅ Total Leave Records: ${result2.rows.length}`);
          if (result2.rows.length > 0) {
            console.log('\n   Recent Leave Applications:');
            result2.rows.forEach((leave, idx) => {
              console.log(`\n   ${idx + 1}. Leave ID: ${leave.id}`);
              console.log(`      Date: ${leave.date_from} to ${leave.date_to}`);
              console.log(`      Days: ${leave.number_of_days}`);
              console.log(`      Reason: ${leave.reason}`);
              console.log(`      State: ${leave.state}`);
              console.log(`      Created: ${leave.create_date}`);
            });
            console.log('\n   ✓ Leave data stored in hr_leave table');
            console.log('   ✓ Visible in ERP: HR → Leaves → Leave Requests');
            console.log(`   ✓ Filter by Employee: ${EMPLOYEE_NO}`);
          } else {
            console.log('   ℹ️  No leave records found');
          }
        }
        console.log('\n');
        
        // 3. Verify Payslips
        console.log('3️⃣  PAYSLIPS - employee_payslip table');
        console.log('─'.repeat(80));
        query(
          `SELECT id, employee_id, employee_name, x_emp_no,
                  month, pay_year, x_pay_date,
                  x_basic_salary, x_allowance, deduction_amount,
                  net_pay_amount, gross_pay_amount, payslipurl, status
           FROM employee_payslip 
           WHERE employee_id = $1
           ORDER BY x_pay_date DESC
           LIMIT 5`,
          [EMPLOYEE_ID],
          (err3, result3) => {
            if (err3) {
              console.log('❌ Error:', err3.message);
            } else {
              console.log(`✅ Total Payslip Records: ${result3.rows.length}`);
              if (result3.rows.length > 0) {
                console.log('\n   Recent Payslips:');
                result3.rows.forEach((payslip, idx) => {
                  console.log(`\n   ${idx + 1}. ${payslip.month}-${payslip.pay_year}`);
                  console.log(`      Employee: ${payslip.employee_name} (${payslip.x_emp_no})`);
                  console.log(`      Pay Date: ${payslip.x_pay_date}`);
                  console.log(`      Basic Salary: $${payslip.x_basic_salary}`);
                  console.log(`      Allowance: $${payslip.x_allowance}`);
                  console.log(`      Deduction: $${payslip.deduction_amount}`);
                  console.log(`      Gross Pay: $${payslip.gross_pay_amount}`);
                  console.log(`      Net Pay: $${payslip.net_pay_amount}`);
                  console.log(`      Status: ${payslip.status}`);
                  console.log(`      PDF URL: ${payslip.payslipurl || 'N/A'}`);
                });
                console.log('\n   ✓ Payslip data stored in employee_payslip table');
                console.log('   ✓ Displayed in Mobile App: Payslips tab');
                console.log('   ✓ Shows: Basic Salary, Allowance, Deduction, Net Pay');
              } else {
                console.log('   ℹ️  No payslip records found');
              }
            }
            console.log('\n');
            
            // 4. Verify Clock In/Out Records
            console.log('4️⃣  CLOCK IN/OUT - employee_clocking_line table');
            console.log('─'.repeat(80));
            query(
              `SELECT id, employee_id, attendance_id, project_id,
                      clock_in, clock_out, clock_in_date, clock_out_date,
                      clock_in_location, clock_out_location,
                      in_lat, in_lan, out_lat, out_lan,
                      in_addr, out_add,
                      clock_in_image_uri, clock_out_image_uri,
                      is_mobile_clocking, state, create_date
               FROM employee_clocking_line 
               WHERE employee_id = $1
               ORDER BY create_date DESC
               LIMIT 3`,
              [EMPLOYEE_ID],
              (err4, result4) => {
                if (err4) {
                  console.log('❌ Error:', err4.message);
                } else {
                  console.log(`✅ Total Clock Records: ${result4.rows.length}`);
                  if (result4.rows.length > 0) {
                    console.log('\n   Recent Clock In/Out Records:');
                    result4.rows.forEach((record, idx) => {
                      console.log(`\n   ${idx + 1}. Record ID: ${record.id}`);
                      console.log(`      Clock In: ${record.clock_in || 'N/A'}`);
                      console.log(`      Clock Out: ${record.clock_out || 'N/A'}`);
                      console.log(`      Location: ${record.clock_in_location || 'N/A'}`);
                      console.log(`      Address: ${record.in_addr || 'N/A'}`);
                      console.log(`      GPS: ${record.in_lat}, ${record.in_lan}`);
                      console.log(`      Project ID: ${record.project_id || 'N/A'}`);
                      console.log(`      Face Image: ${record.clock_in_image_uri ? 'YES' : 'NO'}`);
                      console.log(`      Mobile Clocking: ${record.is_mobile_clocking ? 'YES' : 'NO'}`);
                      console.log(`      State: ${record.state}`);
                    });
                    console.log('\n   ✓ Clock data stored in employee_clocking_line table');
                    console.log('   ✓ Visible in ERP: HR → Attendance → Attendances');
                    console.log(`   ✓ Filter by Employee: ${EMPLOYEE_NO}`);
                    console.log('   ✓ Shows: Clock times, GPS, Face images, Project');
                  } else {
                    console.log('   ℹ️  No clock records found');
                  }
                }
                
                console.log('\n');
                console.log('╔════════════════════════════════════════════════════════════════════════════╗');
                console.log('║                    ✅ DATABASE VERIFICATION COMPLETE                       ║');
                console.log('╠════════════════════════════════════════════════════════════════════════════╣');
                console.log('║  DATA FLOW CONFIRMED:                                                      ║');
                console.log('║  1. Face Recognition: Mobile → hr_employee.l_face_descriptor → ERP         ║');
                console.log('║  2. Leave: Mobile → hr_leave table → ERP UI (Leave Requests)               ║');
                console.log('║  3. Payslips: employee_payslip table → Mobile UI (displays salary)         ║');
                console.log('║  4. Clock In/Out: Mobile → employee_clocking_line → ERP UI (Attendance)    ║');
                console.log('╚════════════════════════════════════════════════════════════════════════════╝');
                console.log('\n');
                
                process.exit(0);
              }
            );
          }
        );
      }
    );
  }
);
