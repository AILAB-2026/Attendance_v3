const sharp = require('sharp');
const path = require('path');

async function createPaddedSplash() {
  const inputImage = path.join(__dirname, 'assets', 'images', 'ai_lab_logo.jpg');
  const outputImage = path.join(__dirname, 'assets', 'images', 'splash-padded.png');

  try {
    // Read the original image
    const image = sharp(inputImage);
    const metadata = await image.metadata();
    
    // Create a larger canvas with padding (add 40% padding on all sides)
    const paddingPercent = 0.4;
    const newWidth = Math.round(metadata.width * (1 + paddingPercent * 2));
    const newHeight = Math.round(metadata.height * (1 + paddingPercent * 2));
    
    // Create the padded image
    await image
      .resize(metadata.width, metadata.height, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .extend({
        top: Math.round(metadata.height * paddingPercent),
        bottom: Math.round(metadata.height * paddingPercent),
        left: Math.round(metadata.width * paddingPercent),
        right: Math.round(metadata.width * paddingPercent),
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(outputImage);

    console.log('✅ Created padded splash screen image:', outputImage);
    console.log(`   Original size: ${metadata.width}x${metadata.height}`);
    console.log(`   New size: ${newWidth}x${newHeight}`);
    console.log('\nNext steps:');
    console.log('1. Update app.json to use "./assets/images/splash-padded.png"');
    console.log('2. Rebuild the app with: eas build --platform android --profile production');
    
  } catch (error) {
    console.error('❌ Error creating padded splash:', error.message);
    console.log('\nIf sharp is not installed, run: npm install sharp');
  }
}

createPaddedSplash();
