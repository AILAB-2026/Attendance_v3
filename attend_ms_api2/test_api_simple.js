import { query } from './src/dbconn.js';

async function testAPI() {
  try {
    console.log('🧪 Testing API Response Format');
    console.log('==============================');
    
    // Simulate the exact same query as the API
    const employeeNo = 'B1-L157';
    const companyCode = 1;
    
    // Get employee ID
    const empResult = await query(
      `SELECT id FROM hr_employee 
       WHERE "x_Emp_No" = $1 AND company_id = $2::integer AND active = true`,
      [employeeNo, companyCode]
    );
    
    const employeeId = empResult.rows[0].id;
    console.log('Employee ID:', employeeId);
    
    // Get today's clockings - exact same query as API
    const result = await query(
      `SELECT 
        ecl.id,
        ecl.clock_in,
        ecl.clock_out,
        ecl.clock_in_date,
        ecl.clock_out_date,
        ecl.in_lat,
        ecl.in_lan,
        ecl.in_addr,
        ecl.out_lat,
        ecl.out_lan,
        ecl.out_add,
        ecl.clock_in_image_uri,
        ecl.clock_out_image_uri,
        pp.name->>'en_US' as project_name,
        ecl.clock_in_location as site_name
       FROM employee_clocking_line ecl
       LEFT JOIN project_project pp ON ecl.project_id = pp.id
       WHERE ecl.employee_id = $1 
         AND DATE(ecl.clock_in_date) = (NOW() AT TIME ZONE 'Asia/Singapore')::date
       ORDER BY ecl.clock_in ASC`,
      [employeeId]
    );
    
    console.log('\n📊 Raw Database Result:');
    console.log('Records found:', result.rows.length);
    
    if (result.rows.length > 0) {
      const row = result.rows[0];
      console.log('\nFirst record:');
      console.log('- ID:', row.id);
      console.log('- Clock In:', row.clock_in);
      console.log('- Clock Out:', row.clock_out);
      console.log('- Clock In Date:', row.clock_in_date);
      console.log('- Clock Out Date:', row.clock_out_date);
      console.log('- Site Name:', row.site_name);
      console.log('- Project Name:', row.project_name);
      
      // Simulate the API's timestamp conversion logic
      if (row.clock_in) {
        const clockInDate = row.clock_in_date ? new Date(row.clock_in_date) : new Date();
        const [hours, minutes, seconds] = row.clock_in.split(':');
        clockInDate.setHours(parseInt(hours), parseInt(minutes), parseInt(seconds || 0), 0);
        
        console.log('\n🕐 Timestamp Conversion:');
        console.log('- Original clock_in_date:', row.clock_in_date);
        console.log('- Original clock_in time:', row.clock_in);
        console.log('- Combined Date object:', clockInDate);
        console.log('- Timestamp (getTime()):', clockInDate.getTime());
        console.log('- Formatted back:', new Date(clockInDate.getTime()).toLocaleString());
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testAPI();
