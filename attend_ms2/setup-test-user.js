/**
 * Test User Setup Script
 * Creates a test user for face recognition integration testing
 * 
 * Usage: node setup-test-user.js
 */

const { Pool } = require('pg');

// AIAttend_v2 database
const aiattendPool = new Pool({
  connectionString: 'postgresql://openpg:openpgpwd@localhost:5432/attendance_db'
});

// Attendance database (for face data)
const attendancePool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'CX18AILABDEMO',
  user: 'postgres',
  password: 'pgsql@2024'
});

async function setupTestUser() {
  try {
    console.log('ðŸ”„ Setting up test user for face recognition integration...\n');

    // 1. Find employee in attendance database
    console.log('Step 1: Checking attendance database (CX18AILABDEMO)...');
    const empResult = await attendancePool.query(
      'SELECT id, name, work_email FROM hr_employee WHERE id = 14 LIMIT 1'
    );
    
    if (empResult.rows.length === 0) {
      console.log('âŒ Employee with id=14 not found in hr_employee table');
      console.log('   Trying to find any employee...');
      
      const anyEmp = await attendancePool.query(
        'SELECT id, name, work_email FROM hr_employee ORDER BY id LIMIT 1'
      );
      
      if (anyEmp.rows.length === 0) {
        console.log('âŒ No employees found in hr_employee table');
        console.log('   Please create an employee first');
        return;
      }
      
      console.log(`â„¹ï¸  Found employee: ID=${anyEmp.rows[0].id}, Name=${anyEmp.rows[0].name}`);
      console.log(`   Using this employee instead`);
      var employee = anyEmp.rows[0];
    } else {
      var employee = empResult.rows[0];
      console.log(`âœ… Found employee: ID=${employee.id}, Name=${employee.name}`);
    }

    // 2. Create/update company in AIAttend_v2
    console.log('\nStep 2: Setting up company in AIAttend_v2...');
    const companyResult = await aiattendPool.query(
      `INSERT INTO companies (company_code, company_name, created_at, updated_at)
       VALUES ('AILAB', 'AI Lab Technologies', NOW(), NOW())
       ON CONFLICT (company_code) DO UPDATE SET updated_at = NOW()
       RETURNING id, company_code, company_name`
    );
    const company = companyResult.rows[0];
    console.log(`âœ… Company ready: ${company.company_code} - ${company.company_name} (ID: ${company.id})`);

    // 3. Set password (plaintext for development)
    console.log('\nStep 3: Setting password to "password123"...');
    const password = 'password123';
    console.log(`âœ… Password ready`);

    // 4. Create/update user in AIAttend_v2
    console.log('\nStep 4: Creating user in AIAttend_v2...');
    
    const userResult = await aiattendPool.query(
      `INSERT INTO users (
        company_id, emp_no, name, email, password, role,
        annual_leave_balance, medical_leave_balance, emergency_leave_balance,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 10, 5, 2, NOW(), NOW())
      ON CONFLICT (emp_no, company_id) 
      DO UPDATE SET 
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        password = EXCLUDED.password,
        updated_at = NOW()
      RETURNING id, emp_no, name, email`,
      [
        company.id,
        'AI-EMP-014',
        employee.name || 'Test Employee 014',
        employee.work_email || 'ai-emp-014@ailab.com',
        password,
        'employee'
      ]
    );
    
    const user = userResult.rows[0];
    console.log(`âœ… User ready: ${user.emp_no} - ${user.name} (ID: ${user.id})`);
    console.log(`   Email: ${user.email}`);

    // 5. Create face mapping
    console.log('\nStep 5: Creating face recognition mapping...');
    await aiattendPool.query(
      `INSERT INTO user_face_mapping (
        aiattend_user_id, attendance_employee_id, employee_no, company_code,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (aiattend_user_id) 
      DO UPDATE SET 
        attendance_employee_id = EXCLUDED.attendance_employee_id,
        updated_at = NOW()`,
      [user.id, employee.id, 'AI-EMP-014', 'AILAB']
    );
    console.log(`âœ… Face mapping created: AIAttend User ${user.id} â†’ Attendance Employee ${employee.id}`);

    // 6. Verify mapping
    console.log('\nStep 6: Verifying setup...');
    const verifyResult = await aiattendPool.query(
      `SELECT 
        u.id as user_id,
        u.emp_no,
        u.name,
        u.company_id,
        c.company_code,
        m.attendance_employee_id
       FROM users u
       JOIN companies c ON c.id = u.company_id
       LEFT JOIN user_face_mapping m ON m.aiattend_user_id = u.id
       WHERE u.emp_no = 'AI-EMP-014' AND c.company_code = 'AILAB'`
    );
    
    if (verifyResult.rows.length > 0) {
      const v = verifyResult.rows[0];
      console.log(`âœ… Verification successful:`);
      console.log(`   User ID: ${v.user_id}`);
      console.log(`   Employee No: ${v.emp_no}`);
      console.log(`   Name: ${v.name}`);
      console.log(`   Company: ${v.company_code} (ID: ${v.company_id})`);
      console.log(`   Mapped to Attendance Employee ID: ${v.attendance_employee_id}`);
    }

    // 7. Summary
    console.log('\n' + '='.repeat(70));
    console.log('âœ… TEST USER SETUP COMPLETE!');
    console.log('='.repeat(70));
    console.log('\nðŸ“‹ Login Credentials:');
    console.log('   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”');
    console.log('   â”‚  Company Code:  AILAB                  â”‚');
    console.log('   â”‚  Employee No:   AI-EMP-014             â”‚');
    console.log('   â”‚  Password:      password123            â”‚');
    console.log('   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜');
    console.log('\nðŸ”— Service URLs:');
    console.log(`   AIAttend_v2 Backend:  http://192.168.1.4:7012`);
    console.log(`   Face Recognition API: http://127.0.0.1:3001`);
    console.log('\nðŸ“ Next Steps:');
    console.log('   1. Test login with above credentials');
    console.log('   2. Enroll face using POST /v1/enroll');
    console.log('   3. Test face authentication using POST /v1/verify');
    console.log('\nðŸ’¡ Quick Test:');
    console.log('   $body = @{');
    console.log('       companyCode = "AILAB"');
    console.log('       employeeNo = "AI-EMP-014"');
    console.log('       password = "password123"');
    console.log('   } | ConvertTo-Json');
    console.log('   Invoke-RestMethod -Method POST -Uri "http://192.168.1.4:7012/auth/login" `');
    console.log('       -ContentType "application/json" -Body $body');
    console.log('');

  } catch (error) {
    console.error('\nâŒ Error during setup:', error.message);
    if (error.code) {
      console.error(`   Error Code: ${error.code}`);
    }
    if (error.detail) {
      console.error(`   Detail: ${error.detail}`);
    }
    console.error('\n   Full error:', error);
  } finally {
    await aiattendPool.end();
    await attendancePool.end();
  }
}

// Run the setup
setupTestUser().catch(console.error);



