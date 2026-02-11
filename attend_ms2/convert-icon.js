// Simple icon conversion script
// This script helps prepare the BRK logo for use as app icon

const fs = require('fs');
const path = require('path');

console.log('🎨 BRK Logo Icon Conversion Helper');
console.log('================================');

const sourceFile = './assets/images/brk_logo.jpg';
const targetDir = './assets/images/';

// Check if source file exists
if (!fs.existsSync(sourceFile)) {
  console.error('❌ Source file not found:', sourceFile);
  process.exit(1);
}

console.log('✅ Source file found:', sourceFile);
console.log('📁 Target directory:', targetDir);

console.log('\n📋 Required Icon Sizes:');
console.log('1. Main Icon (icon.png): 1024x1024 pixels');
console.log('2. Adaptive Icon (adaptive-icon.png): 1024x1024 pixels');
console.log('3. Favicon (favicon.png): 48x48 pixels');

console.log('\n🛠️ Manual Steps Required:');
console.log('1. Open brk_logo.jpg in an image editor');
console.log('2. Create a 1024x1024 canvas with transparent background');
console.log('3. Place the BRK logo in the center with 10% padding');
console.log('4. Save as PNG files with the names above');
console.log('5. Run: npm run build to rebuild the app');

console.log('\n🌐 Online Tools (Recommended):');
console.log('• https://www.canva.com - Easy drag & drop');
console.log('• https://www.figma.com - Professional design');
console.log('• https://icon.kitchen - App icon generator');

console.log('\n📱 After creating icons, run:');
console.log('eas build --platform android --profile production-apk');

// Create a backup of current icons
const backupDir = './assets/images/backup/';
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
  console.log('\n💾 Created backup directory');
}

// List current icon files
const iconFiles = ['icon.png', 'adaptive-icon.png', 'favicon.png'];
iconFiles.forEach(file => {
  const filePath = path.join(targetDir, file);
  if (fs.existsSync(filePath)) {
    const backupPath = path.join(backupDir, `old_${file}`);
    fs.copyFileSync(filePath, backupPath);
    console.log(`📋 Backed up: ${file} → backup/old_${file}`);
  }
});

console.log('\n✨ Ready for icon replacement!');
console.log('Replace the icon files and rebuild the APK.');
