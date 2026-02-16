import fetch from 'node-fetch';

async function testCompanyNameEndpoint() {
  const testCodes = ['BRK', 'SKK', 'AILAB', 'brk', 'skk'];
  
  for (const code of testCodes) {
    try {
      const url = `http://localhost:7010/settings/company-name?companyCode=${code}`;
      console.log(`\n📡 Testing: ${url}`);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log(`Response:`, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(`Error testing ${code}:`, err.message);
    }
  }
}

testCompanyNameEndpoint();
