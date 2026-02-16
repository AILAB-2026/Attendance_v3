/**
 * Master Diagnostics Script
 * Runs all diagnostic checks in sequence
 * Run: node run-diagnostics.js
 */

const { spawn } = require('child_process');
const path = require('path');

function runScript(scriptName) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Running: ${scriptName}`);
    console.log('='.repeat(80));
    
    const child = spawn('node', [scriptName], {
      cwd: __dirname,
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${scriptName} exited with code ${code}`));
      }
    });

    child.on('error', reject);
  });
}

async function runAllDiagnostics() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    AIAttend Diagnostics Suite                              ║');
  console.log('║                    Checking Clock-In System                                ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  const scripts = [
    'check-face-ai.js',
    'check-assignments.js'
  ];

  for (const script of scripts) {
    try {
      await runScript(script);
      console.log(`\n✅ ${script} completed successfully`);
    } catch (error) {
      console.error(`\n❌ ${script} failed:`, error.message);
      console.log('\nContinuing with remaining checks...');
    }
    
    // Wait a bit between checks
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    Diagnostics Complete                                    ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log('\nNext Steps:');
  console.log('  1. Review the results above');
  console.log('  2. Fix any issues identified');
  console.log('  3. Test clock-in with: node test-clock-in.js');
  console.log('  4. Or test in the mobile app\n');
}

runAllDiagnostics().catch(error => {
  console.error('\n❌ Diagnostics suite failed:', error);
  process.exit(1);
});
