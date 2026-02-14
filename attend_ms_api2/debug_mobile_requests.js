import express from 'express';
import cors from 'cors';

const app = express();
const port = 3002; // Different port to avoid conflicts

// Enable CORS for all origins
app.use(cors());
app.use(express.json());

// Log all incoming requests
app.use((req, res, next) => {
  console.log('\n=== INCOMING REQUEST ===');
  console.log('Time:', new Date().toISOString());
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', JSON.stringify(req.body, null, 2));
  }
  console.log('========================\n');
  next();
});

// Catch all routes and return mock data
app.all('*', (req, res) => {
  console.log(`📱 Mobile app called: ${req.method} ${req.url}`);

  // If it's a sites-related request, return mock sites
  if (req.url.includes('site') || req.url.includes('Site')) {
    console.log('🏢 Returning mock sites data');

    const mockSites = [
      { siteId: 1, siteName: "Test Site 1", siteLocationName: "Test Site 1", value: "Test Site 1" },
      { siteId: 2, siteName: "Test Site 2", siteLocationName: "Test Site 2", value: "Test Site 2" },
      { siteId: 3, siteName: "Test Site 3", siteLocationName: "Test Site 3", value: "Test Site 3" }
    ];

    // Try different response formats
    const responses = {
      format1: mockSites, // Direct array
      format2: { sites: mockSites }, // Object with sites
      format3: { success: true, data: { sites: mockSites } }, // Full format
      format4: { success: true, sites: mockSites }, // Alternative format
      format5: mockSites.map(s => ({ siteLocationName: s.siteName })) // Legacy format
    };

    console.log('📋 Available response formats:');
    Object.keys(responses).forEach(key => {
      console.log(`   ${key}:`, JSON.stringify(responses[key], null, 2));
    });

    // Return the full format by default
    res.json(responses.format3);
    return;
  }

  // For login requests
  if (req.url.includes('login') || req.url.includes('auth')) {
    console.log('🔐 Returning mock login response');
    res.json({
      success: true,
      message: "Login successful",
      data: {
        sessionToken: "mock-token-12345",
        employeeNo: "B1-W422",
        name: "SANKAR SAMBATH"
      }
    });
    return;
  }

  // Default response
  console.log('❓ Unknown request, returning generic response');
  res.json({
    success: true,
    message: "Mock response from debug server",
    data: {}
  });
});

app.listen(port, () => {
  console.log(`🔍 Debug server running on port ${port}`);
  console.log('📱 Configure your mobile app to use this server temporarily:');
  console.log(`   Base URL: http://localhost:${port}`);
  console.log('   or: http://192.168.1.5:${port} (replace with your IP)');
  console.log('\n🎯 This will show exactly what requests the mobile app is making');
  console.log('💡 Once we see the requests, we can fix the real API accordingly\n');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Debug server shutting down...');
  process.exit(0);
});
