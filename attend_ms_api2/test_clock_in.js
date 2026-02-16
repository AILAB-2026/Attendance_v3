import dotenv from 'dotenv';
dotenv.config();

console.log('🧪 Testing Clock In for B1-E079...\n');

const testClockIn = async () => {
  try {
    const clockInData = {
      companyCode: "1",
      employeeNo: "B1-E079",
      timestamp: new Date().toISOString(),
      latitude: "1.3521",
      longitude: "103.8198",
      address: "Singapore",
      method: "face_recognition",
      siteName: "Office",
      projectName: "Office",
      imageUri: "test_image_uri"
    };

    console.log('📤 Sending clock-in request...');
    console.log('Data:', JSON.stringify(clockInData, null, 2));
    console.log('');

    const response = await fetch('http://localhost:3001/attendance/clock-in', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(clockInData)
    });

    const result = await response.json();
    
    console.log('📥 Response Status:', response.status);
    console.log('📥 Response:', JSON.stringify(result, null, 2));
    console.log('');

    if (result.success) {
      console.log('✅ Clock-in successful!');
      console.log('   Record ID:', result.data?.id);
      console.log('   Employee:', result.data?.name);
      console.log('   Clock In Time:', result.data?.clockInTime);
      
      // Now check if it's in the database
      console.log('\n🔍 Verifying in database...\n');
      
      const { query } = await import('./src/dbconn.js');
      
      query(`
        SELECT id, employee_id, clock_in, clock_in_location, project_id, create_date
        FROM employee_clocking_line 
        WHERE employee_id = 267 
        ORDER BY create_date DESC 
        LIMIT 1
      `, [], (err, res) => {
        if (err) {
          console.error('❌ Database check error:', err.message);
          process.exit(1);
        }

        if (res.rows.length > 0) {
          console.log('✅ Record found in database!');
          console.log('   ID:', res.rows[0].id);
          console.log('   Employee ID:', res.rows[0].employee_id);
          console.log('   Clock In:', res.rows[0].clock_in);
          console.log('   Location:', res.rows[0].clock_in_location);
          console.log('   Project ID:', res.rows[0].project_id);
          console.log('   Created:', res.rows[0].create_date);
        } else {
          console.log('❌ NO RECORD FOUND in database!');
          console.log('   This means the INSERT failed or was rolled back.');
        }

        process.exit(0);
      });
    } else {
      console.log('❌ Clock-in failed!');
      console.log('   Message:', result.message);
      console.log('   Error:', result.error);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Test error:', error.message);
    process.exit(1);
  }
};

testClockIn();
