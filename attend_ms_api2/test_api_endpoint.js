import https from 'https';
import http from 'http';

async function testAttendanceAPI() {
  try {
    console.log('🧪 Testing /attendance/today API endpoint');
    console.log('==========================================');
    
    // Test the exact API call that the mobile app makes
    const url = 'http://localhost:3001/api/attendance/today?companyCode=1&employeeNo=B1-L157';
    
    console.log('📡 Making request to:', url);
    
    // Use Node.js built-in http module
    const response = await new Promise((resolve, reject) => {
      const req = http.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            resolve({ status: res.statusCode, json: () => Promise.resolve(jsonData) });
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('error', reject);
    });
    
    const data = await response.json();
    
    console.log('📊 API Response Status:', response.status);
    console.log('📊 API Response Data:', JSON.stringify(data, null, 2));
    
    if (data.success && data.data) {
      const attendanceData = data.data;
      console.log('\n🎯 Parsed Attendance Data:');
      console.log('Date:', attendanceData.date);
      console.log('Clock In:', attendanceData.clockIn);
      console.log('Clock Out:', attendanceData.clockOut);
      console.log('Entries Count:', attendanceData.entries?.length || 0);
      console.log('Status:', attendanceData.status);
      
      if (attendanceData.entries && attendanceData.entries.length > 0) {
        console.log('\n📋 Entry Details:');
        attendanceData.entries.forEach((entry, idx) => {
          console.log(`  Entry ${idx + 1}:`);
          console.log(`    Site: ${entry.siteName || 'NULL'}`);
          console.log(`    Project: ${entry.projectName || 'NULL'}`);
          console.log(`    Clock In: ${entry.clockIn ? new Date(entry.clockIn.timestamp).toLocaleString() : 'NULL'}`);
          console.log(`    Clock Out: ${entry.clockOut ? new Date(entry.clockOut.timestamp).toLocaleString() : 'NULL'}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ API Test Error:', error);
  }
}

testAttendanceAPI();
