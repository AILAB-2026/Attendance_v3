import express from 'express';

const app = express();
const port = 3002;

app.use(express.json());

// Enable CORS manually
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Log all requests
app.use((req, res, next) => {
  console.log('\n=== MOBILE APP REQUEST ===');
  console.log('Time:', new Date().toLocaleTimeString());
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:');
  Object.keys(req.headers).forEach(key => {
    console.log(`  ${key}: ${req.headers[key]}`);
  });
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', JSON.stringify(req.body, null, 2));
  }
  console.log('==========================\n');
  next();
});

// Handle all requests
app.all('*', (req, res) => {
  console.log(`📱 REQUEST: ${req.method} ${req.url}`);

  if (req.url.includes('site')) {
    console.log('🏢 Sites request detected - returning test sites');

    const testSites = [
      { siteId: 1, siteName: "DEBUG Site 1" },
      { siteId: 2, siteName: "DEBUG Site 2" },
      { siteId: 3, siteName: "DEBUG Site 3" }
    ];

    res.json({
      success: true,
      message: "Debug sites from port 3002",
      data: {
        sites: testSites,
        defaultSite: testSites[0]
      }
    });
  } else if (req.url.includes('login') || req.url.includes('auth')) {
    console.log('🔐 Login request detected');
    res.json({
      success: true,
      message: "Debug login successful",
      data: {
        sessionToken: "debug-token-123",
        employeeNo: "B1-W422",
        name: "DEBUG USER"
      }
    });
  } else {
    console.log('❓ Other request');
    res.json({ success: true, message: "Debug response" });
  }
});

app.listen(port, () => {
  console.log(`🔍 DEBUG SERVER RUNNING ON PORT ${port}`);
  console.log('');
  console.log('📱 TO TEST WITH MOBILE APP:');
  console.log(`   1. Change mobile app base URL to: http://localhost:${port}`);
  console.log(`   2. Or use your computer's IP: http://192.168.1.10:${port}`);
  console.log('   3. Try to load sites in the mobile app');
  console.log('   4. Watch this console for the exact requests');
  console.log('');
  console.log('🎯 This will show us EXACTLY what the mobile app is calling');
  console.log('💡 Then we can fix the real API to match what the app expects');
  console.log('');
});
