const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function fixSplashPadding() {
  const inputImage = path.join(__dirname, 'assets', 'images', 'splash-icon.jpg');
  const backupImage = path.join(__dirname, 'assets', 'images', 'splash-icon-original.jpg');
  const outputImage = path.join(__dirname, 'assets', 'images', 'splash-icon.jpg');

  try {
    // Check if sharp is installed
    if (!fs.existsSync(inputImage)) {
      console.error('❌ Input image not found:', inputImage);
      return;
    }

    // Backup original
    if (!fs.existsSync(backupImage)) {
      fs.copyFileSync(inputImage, backupImage);
      console.log('✅ Backed up original to:', backupImage);
    }

    // Read the original image
    const image = sharp(inputImage);
    const metadata = await image.metadata();
    
    console.log(`📐 Original image size: ${metadata.width}x${metadata.height}`);
    
    // Create a square canvas with significant padding
    // The icon should take up about 50% of the canvas to leave room for shadow
    const canvasSize = 2048; // Standard splash screen size
    const iconSize = Math.round(canvasSize * 0.5); // Icon takes 50% of canvas
    
    // Resize and center the icon on a white canvas
    await sharp(inputImage)
      .resize(iconSize, iconSize, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .extend({
        top: Math.round((canvasSize - iconSize) / 2),
        bottom: Math.round((canvasSize - iconSize) / 2),
        left: Math.round((canvasSize - iconSize) / 2),
        right: Math.round((canvasSize - iconSize) / 2),
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .jpeg({ quality: 95 })
      .toFile(outputImage + '.tmp');

    // Replace original with new version
    fs.renameSync(outputImage + '.tmp', outputImage);

    console.log('✅ Created properly padded splash screen!');
    console.log(`   New size: ${canvasSize}x${canvasSize}`);
    console.log(`   Icon size: ${iconSize}x${iconSize} (centered with padding)`);
    console.log('\n📱 The shadow should now align properly with the icon.');
    console.log('\nNext steps:');
    console.log('1. Rebuild the app: eas build --platform android --profile production');
    console.log('2. Or test with: npx expo run:android');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.message.includes('sharp')) {
      console.log('\n💡 Installing sharp...');
      console.log('Run: npm install sharp --save-dev');
    }
  }
}

fixSplashPadding();
