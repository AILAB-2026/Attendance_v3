/* 
 * Clean seed data with new short ID system
 * This script populates the database with comprehensive sample data
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('[seed-clean] Starting clean data seeding with short IDs...');
    
    // 1. Create Companies
    console.log('[seed-clean] Creating companies...');
    const companies = [
      {
        id: 'CMP_ABC123',
        company_code: 'ABC123',
        company_name: 'ABC Corporation',
        address: '123 Main Street, Business District, Metro City 12345',
        phone: '+1-555-123-4567',
        email: 'info@abccorp.com'
      },
      {
        id: 'CMP_XYZ789',
        company_code: 'XYZ789',
        company_name: 'XYZ Industries',
        address: '456 Industrial Ave, Manufacturing Zone, Tech City 67890',
        phone: '+1-555-987-6543',
        email: 'contact@xyzind.com'
      }
    ];
    
    for (const company of companies) {
      await client.query(`
        INSERT INTO companies (id, company_code, company_name, address, phone, email, work_start_time, work_end_time, work_hours_per_day)
        VALUES ($1, $2, $3, $4, $5, $6, '09:00', '18:00', 8)
      `, [company.id, company.company_code, company.company_name, company.address, company.phone, company.email]);
    }
    
    // 2. Create Sites
    console.log('[seed-clean] Creating sites...');
    const sites = [
      {
        id: 'SIT_MAIN01',
        company_id: 'CMP_ABC123',
        code: 'MAIN',
        name: 'Main Warehouse',
        address: '123 Main Street, Business District, Metro City 12345',
        latitude: 40.7128,
        longitude: -74.0060
      },
      {
        id: 'SIT_OFFC01',
        company_id: 'CMP_ABC123',
        code: 'HQ',
        name: 'Head Office',
        address: '789 Corporate Blvd, Business District, Metro City 12345',
        latitude: 40.7589,
        longitude: -73.9851
      },
      {
        id: 'SIT_FACT01',
        company_id: 'CMP_XYZ789',
        code: 'FACTORY',
        name: 'Manufacturing Plant',
        address: '456 Industrial Ave, Manufacturing Zone, Tech City 67890',
        latitude: 37.7749,
        longitude: -122.4194
      }
    ];
    
    for (const site of sites) {
      await client.query(`
        INSERT INTO sites (id, company_id, code, name, address, latitude, longitude)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [site.id, site.company_id, site.code, site.name, site.address, site.latitude, site.longitude]);
    }
    
    // 3. Create Projects
    console.log('[seed-clean] Creating projects...');
    const projects = [
      {
        id: 'PRJ_SAFETY',
        company_id: 'CMP_ABC123',
        site_id: 'SIT_MAIN01',
        code: 'SAFETY2024',
        name: 'Safety Audit',
        description: 'Comprehensive safety audit and compliance review',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        status: 'active'
      },
      {
        id: 'PRJ_RENOV8',
        company_id: 'CMP_ABC123',
        site_id: 'SIT_OFFC01',
        code: 'RENO2024',
        name: 'HQ Renovation',
        description: 'Office renovation and modernization project',
        start_date: '2024-03-01',
        end_date: '2024-08-31',
        status: 'active'
      },
      {
        id: 'PRJ_TRAIN1',
        company_id: 'CMP_ABC123',
        site_id: null,
        code: 'TRAIN2024',
        name: 'Training Program',
        description: 'Employee skill development and training initiative',
        start_date: '2024-02-01',
        end_date: '2024-11-30',
        status: 'active'
      }
    ];
    
    for (const project of projects) {
      await client.query(`
        INSERT INTO projects (id, company_id, site_id, code, name, description, start_date, end_date, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [project.id, project.company_id, project.site_id, project.code, project.name, project.description, project.start_date, project.end_date, project.status]);
    }
    
    // 4. Create Users
    console.log('[seed-clean] Creating users...');
    const users = [
      // ABC Corporation Users
      {
        id: 'USR_ADMIN1',
        company_id: 'CMP_ABC123',
        emp_no: 'A001',
        name: 'Alice Johnson',
        email: 'alice.johnson@abccorp.com',
        password: 'admin123',
        role: 'admin',
        department: 'Administration',
        join_date: '2023-01-15'
      },
      {
        id: 'USR_MGR001',
        company_id: 'CMP_ABC123',
        emp_no: 'M001',
        name: 'Bob Smith',
        email: 'bob.smith@abccorp.com',
        password: 'manager123',
        role: 'manager',
        department: 'Operations',
        join_date: '2023-02-01'
      },
      {
        id: 'USR_EMP001',
        company_id: 'CMP_ABC123',
        emp_no: 'E001',
        name: 'Charlie Brown',
        email: 'charlie.brown@abccorp.com',
        password: 'employee123',
        role: 'employee',
        department: 'Warehouse',
        join_date: '2023-03-10'
      },
      {
        id: 'USR_EMP002',
        company_id: 'CMP_ABC123',
        emp_no: 'E002',
        name: 'Diana Prince',
        email: 'diana.prince@abccorp.com',
        password: 'employee123',
        role: 'employee',
        department: 'Warehouse',
        join_date: '2023-03-15'
      },
      {
        id: 'USR_EMP003',
        company_id: 'CMP_ABC123',
        emp_no: 'E003',
        name: 'Edward Wilson',
        email: 'edward.wilson@abccorp.com',
        password: 'employee123',
        role: 'employee',
        department: 'Maintenance',
        join_date: '2023-04-01'
      },
      // XYZ Industries Users
      {
        id: 'USR_XYZ001',
        company_id: 'CMP_XYZ789',
        emp_no: 'X001',
        name: 'Frank Miller',
        email: 'frank.miller@xyzind.com',
        password: 'admin123',
        role: 'admin',
        department: 'Management',
        join_date: '2023-01-01'
      }
    ];
    
    for (const user of users) {
      await client.query(`
        INSERT INTO users (id, company_id, emp_no, name, email, password, role, department, join_date, work_start_time, work_end_time, grace_min)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, '09:00', '18:00', 15)
      `, [user.id, user.company_id, user.emp_no, user.name, user.email, user.password, user.role, user.department, user.join_date]);
    }
    
    // 5. Create Employee Assignments
    console.log('[seed-clean] Creating employee assignments...');
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    const assignments = [
      {
        id: 'ASG_001',
        user_id: 'USR_EMP001',
        site_id: 'SIT_MAIN01',
        site_name: 'Main Warehouse',
        start_date: startOfMonth.toISOString().split('T')[0],
        end_date: endOfMonth.toISOString().split('T')[0],
        assigned_by: 'USR_MGR001',
        notes: 'Regular warehouse operations'
      },
      {
        id: 'ASG_002',
        user_id: 'USR_EMP002',
        site_id: 'SIT_MAIN01',
        site_name: 'Main Warehouse',
        start_date: startOfMonth.toISOString().split('T')[0],
        end_date: endOfMonth.toISOString().split('T')[0],
        assigned_by: 'USR_MGR001',
        notes: 'Regular warehouse operations'
      },
      {
        id: 'ASG_003',
        user_id: 'USR_EMP001',
        project_id: 'PRJ_SAFETY',
        project_name: 'Safety Audit',
        start_date: startOfMonth.toISOString().split('T')[0],
        end_date: endOfMonth.toISOString().split('T')[0],
        assigned_by: 'USR_MGR001',
        notes: 'Safety audit project participation'
      },
      {
        id: 'ASG_004',
        user_id: 'USR_EMP003',
        site_id: 'SIT_OFFC01',
        site_name: 'Head Office',
        project_id: 'PRJ_RENOV8',
        project_name: 'HQ Renovation',
        start_date: startOfMonth.toISOString().split('T')[0],
        end_date: endOfMonth.toISOString().split('T')[0],
        assigned_by: 'USR_MGR001',
        notes: 'Maintenance support for renovation'
      }
    ];
    
    for (const assignment of assignments) {
      await client.query(`
        INSERT INTO employee_assignments (id, user_id, site_id, project_id, site_name, project_name, start_date, end_date, assigned_by, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [assignment.id, assignment.user_id, assignment.site_id, assignment.project_id, assignment.site_name, assignment.project_name, assignment.start_date, assignment.end_date, assignment.assigned_by, assignment.notes]);
    }
    
    // 6. Create Schedules for current month
    console.log('[seed-clean] Creating schedules...');
    const employees = ['USR_EMP001', 'USR_EMP002', 'USR_EMP003'];
    let scheduleCounter = 1;
    
    for (let day = 1; day <= endOfMonth.getDate(); day++) {
      const currentDate = new Date(today.getFullYear(), today.getMonth(), day);
      const dayOfWeek = currentDate.getDay();
      
      // Skip weekends
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;
      
      for (const empId of employees) {
        const scheduleId = `SCH_${String(scheduleCounter).padStart(6, '0')}`;
        const dateStr = currentDate.toISOString().split('T')[0];
        
        let location = 'Main Warehouse';
        if (empId === 'USR_EMP003' && day % 3 === 0) {
          location = 'Head Office'; // Maintenance rotates to office
        }
        
        await client.query(`
          INSERT INTO schedules (id, user_id, date, start_time, end_time, location, notes)
          VALUES ($1, $2, $3, '09:00', '18:00', $4, 'Regular shift')
        `, [scheduleId, empId, dateStr, location]);
        
        scheduleCounter++;
      }
    }
    
    // 7. Create Sample Clock Events and Attendance for past week
    console.log('[seed-clean] Creating sample attendance data...');
    let clockCounter = 1000;
    let attendanceCounter = 1;
    
    for (let daysAgo = 7; daysAgo >= 1; daysAgo--) {
      const workDate = new Date(today);
      workDate.setDate(today.getDate() - daysAgo);
      const dayOfWeek = workDate.getDay();
      
      // Skip weekends
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;
      
      const dateStr = workDate.toISOString().split('T')[0];
      
      for (const empId of employees) {
        // Clock In
        const clockInTime = new Date(workDate);
        clockInTime.setHours(9, Math.floor(Math.random() * 15), 0, 0); // 9:00-9:15 AM
        
        const clockInId = `CLK_${String(clockCounter++).padStart(6, '0')}`;
        await client.query(`
          INSERT INTO clock_events (id, user_id, timestamp, type, latitude, longitude, address, method, site_name)
          VALUES ($1, $2, $3, 'in', 40.7128, -74.0060, '123 Main Street, Business District, Metro City', 'button', 'Main Warehouse')
        `, [clockInId, empId, clockInTime.getTime()]);
        
        // Clock Out
        const clockOutTime = new Date(workDate);
        clockOutTime.setHours(18, Math.floor(Math.random() * 30), 0, 0); // 6:00-6:30 PM
        
        const clockOutId = `CLK_${String(clockCounter++).padStart(6, '0')}`;
        await client.query(`
          INSERT INTO clock_events (id, user_id, timestamp, type, latitude, longitude, address, method, site_name)
          VALUES ($1, $2, $3, 'out', 40.7128, -74.0060, '123 Main Street, Business District, Metro City', 'button', 'Main Warehouse')
        `, [clockOutId, empId, clockOutTime.getTime()]);
        
        // Create Attendance Day
        const workHours = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60) - 1; // Subtract 1 hour lunch
        const normalHours = Math.min(workHours, 8);
        const overtimeHours = Math.max(workHours - 8, 0);
        
        const attendanceId = `ATD_${String(attendanceCounter++).padStart(6, '0')}`;
        await client.query(`
          INSERT INTO attendance_days (id, user_id, date, clock_in_id, clock_out_id, normal_hours, overtime_hours, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'present')
        `, [attendanceId, empId, dateStr, clockInId, clockOutId, normalHours.toFixed(2), overtimeHours.toFixed(2)]);
        
        // Create Attendance Entry
        const entryId = `ENT_${String(attendanceCounter).padStart(6, '0')}`;
        await client.query(`
          INSERT INTO attendance_entries (id, user_id, date, site_name, clock_in_id, clock_out_id)
          VALUES ($1, $2, $3, 'Main Warehouse', $4, $5)
        `, [entryId, empId, dateStr, clockInId, clockOutId]);
      }
    }
    
    // 8. Create Sample Leaves
    console.log('[seed-clean] Creating sample leaves...');
    const leaves = [
      {
        id: 'LEV_001',
        user_id: 'USR_EMP002',
        start_date: new Date(today.getFullYear(), today.getMonth() + 1, 5).toISOString().split('T')[0],
        end_date: new Date(today.getFullYear(), today.getMonth() + 1, 7).toISOString().split('T')[0],
        type: 'annual',
        reason: 'Family vacation',
        status: 'approved',
        approved_by: 'USR_MGR001',
        effective_days: 3.0
      },
      {
        id: 'LEV_002',
        user_id: 'USR_EMP003',
        start_date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2).toISOString().split('T')[0],
        end_date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2).toISOString().split('T')[0],
        type: 'medical',
        reason: 'Doctor appointment',
        status: 'pending',
        duration: 'half',
        half_day_period: 'AM',
        effective_days: 0.5
      }
    ];
    
    for (const leave of leaves) {
      await client.query(`
        INSERT INTO leaves (id, user_id, start_date, end_date, type, reason, status, approved_by, duration, half_day_period, effective_days)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [leave.id, leave.user_id, leave.start_date, leave.end_date, leave.type, leave.reason, leave.status, leave.approved_by, leave.duration, leave.half_day_period, leave.effective_days]);
    }
    
    // 9. Create Sample Toolbox Meetings
    console.log('[seed-clean] Creating toolbox meetings...');
    const meetings = [
      {
        id: 'TBX_001',
        title: 'Weekly Safety Briefing',
        description: 'Weekly safety briefing covering workplace hazards and safety protocols.',
        meeting_date: today.toISOString().split('T')[0],
        presenter_id: 'USR_MGR001',
        location: 'Main Conference Room',
        safety_topics: ['PPE Requirements', 'Emergency Procedures', 'Hazard Identification']
      },
      {
        id: 'TBX_002',
        title: 'Fire Safety Training',
        description: 'Comprehensive fire safety training including evacuation procedures.',
        meeting_date: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        presenter_id: 'USR_MGR001',
        location: 'Training Room A',
        safety_topics: ['Fire Prevention', 'Evacuation Routes', 'Fire Extinguisher Types']
      }
    ];
    
    for (const meeting of meetings) {
      await client.query(`
        INSERT INTO toolbox_meetings (id, title, description, meeting_date, presenter_id, location, safety_topics)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [meeting.id, meeting.title, meeting.description, meeting.meeting_date, meeting.presenter_id, meeting.location, meeting.safety_topics]);
      
      // Add attendees
      const attendees = ['USR_EMP001', 'USR_EMP002', 'USR_EMP003'];
      for (let i = 0; i < attendees.length; i++) {
        const attendeeId = `TBA_${meeting.id.split('_')[1]}_${i + 1}`;
        await client.query(`
          INSERT INTO toolbox_meeting_attendees (id, meeting_id, user_id, attended, acknowledged_at)
          VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP)
        `, [attendeeId, meeting.id, attendees[i]]);
      }
    }
    
    // 10. Create Sample Payslips
    console.log('[seed-clean] Creating sample payslips...');
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    
    const payslips = [
      {
        id: 'PAY_001',
        user_id: 'USR_EMP001',
        basic_salary: 4000.00,
        overtime_hours: 8.5,
        overtime_rate: 25.00
      },
      {
        id: 'PAY_002',
        user_id: 'USR_EMP002',
        basic_salary: 4200.00,
        overtime_hours: 6.0,
        overtime_rate: 25.00
      },
      {
        id: 'PAY_003',
        user_id: 'USR_EMP003',
        basic_salary: 4500.00,
        overtime_hours: 12.0,
        overtime_rate: 30.00
      }
    ];
    
    for (const payslip of payslips) {
      const overtimePay = payslip.overtime_hours * payslip.overtime_rate;
      const grossPay = payslip.basic_salary + overtimePay + 350; // +350 for allowances
      const taxDeduction = grossPay * 0.15;
      const netPay = grossPay - taxDeduction - 350; // -350 for deductions
      
      await client.query(`
        INSERT INTO payslips (id, user_id, pay_period_start, pay_period_end, pay_date, basic_salary, overtime_hours, overtime_rate, overtime_pay, allowances, deductions, gross_pay, tax_deduction, net_pay)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        payslip.id, payslip.user_id, 
        lastMonth.toISOString().split('T')[0], 
        lastMonthEnd.toISOString().split('T')[0],
        new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        payslip.basic_salary, payslip.overtime_hours, payslip.overtime_rate, overtimePay,
        '{"transport": 200, "meal": 150}',
        '{"insurance": 100, "pension": 250}',
        grossPay, taxDeduction, netPay
      ]);
    }
    
    await client.query('COMMIT');
    
    console.log('[seed-clean] ✅ Clean data seeding completed successfully!');
    console.log('[seed-clean] Summary:');
    console.log('  - Companies: 2');
    console.log('  - Sites: 3');
    console.log('  - Projects: 3');
    console.log('  - Users: 6');
    console.log('  - Assignments: 4');
    console.log('  - Schedules: ~60 (current month)');
    console.log('  - Clock Events: ~30 (past week)');
    console.log('  - Attendance Records: ~15 (past week)');
    console.log('  - Leaves: 2');
    console.log('  - Toolbox Meetings: 2');
    console.log('  - Payslips: 3');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[seed-clean] ❌ Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
