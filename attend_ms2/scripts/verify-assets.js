const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying asset files...');

const assetsDir = path.join(__dirname, '..', 'assets', 'images');
const requiredAssets = [
  'icon.png',
  'adaptive-icon.png',
  'favicon.png',
  'splash-icon.png',
  'company-logo.png'
];

function readPngDimensions(filePath) {
  const signatureLength = 8;
  const ihdrChunkLength = 25; // 4 length + 4 type + 13 IHDR data + 4 CRC
  const buffer = Buffer.alloc(signatureLength + ihdrChunkLength);

  const fd = fs.openSync(filePath, 'r');
  try {
    fs.readSync(fd, buffer, 0, buffer.length, 0);
  } finally {
    fs.closeSync(fd);
  }

  // Bytes 16-19: width, 20-23: height (big-endian)
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);

  return { width, height };
}

function validateIconDimensions(asset, assetPath) {
  if (!asset.endsWith('.png')) return;
  try {
    const { width, height } = readPngDimensions(assetPath);
    console.log(`   ↳ dimensions: ${width}x${height}`);
    if (asset.includes('icon') && width !== height) {
      console.log('   ⚠️  Icon should be square. Expo will reject non-square icons.');
    }
    if (asset.includes('icon') && width < 512) {
      console.log('   ⚠️  Icon should be at least 512x512 for optimal results.');
    }
  } catch (error) {
    console.log(`   ⚠️  Could not read dimensions: ${(error && error.message) || error}`);
  }
}

console.log(`📁 Checking directory: ${assetsDir}`);

let allExists = true;

requiredAssets.forEach(asset => {
  const assetPath = path.join(assetsDir, asset);
  if (fs.existsSync(assetPath)) {
    const stats = fs.statSync(assetPath);
    console.log(`✅ ${asset} - ${stats.size} bytes`);
    validateIconDimensions(asset, assetPath);
  } else {
    console.log(`❌ ${asset} - NOT FOUND`);
    allExists = false;
  }
});

if (allExists) {
  console.log('\n🎉 All required assets are present!');
} else {
  console.log('\n⚠️  Some assets are missing!');
}

// Check app.json references
console.log('\n🔍 Checking app.json asset references...');
const appJsonPath = path.join(__dirname, '..', 'app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

const iconPath = path.join(__dirname, '..', appJson.expo.icon);
const splashPath = path.join(__dirname, '..', appJson.expo.splash.image);

console.log(`Icon: ${appJson.expo.icon} - ${fs.existsSync(iconPath) ? '✅' : '❌'}`);
console.log(`Splash: ${appJson.expo.splash.image} - ${fs.existsSync(splashPath) ? '✅' : '❌'}`);

console.log('\n✨ Asset verification complete!');
