const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function fixVerticalAlignment() {
  const originalImage = path.join(__dirname, 'assets', 'images', 'splash-icon-original.jpg');
  const outputImage = path.join(__dirname, 'assets', 'images', 'splash-icon.jpg');

  try {
    if (!fs.existsSync(originalImage)) {
      console.error('❌ Original backup not found. Please restore splash-icon-original.jpg');
      return;
    }

    // Read the original small icon
    const image = sharp(originalImage);
    const metadata = await image.metadata();
    
    console.log(`📐 Original icon size: ${metadata.width}x${metadata.height}`);
    
    // Create a 2048x2048 canvas
    const canvasSize = 2048;
    const iconSize = Math.round(canvasSize * 0.4); // Icon takes 40% of canvas
    
    // Calculate padding - shift icon UP by reducing top padding
    const horizontalPadding = Math.round((canvasSize - iconSize) / 2);
    const totalVerticalPadding = canvasSize - iconSize;
    
    // Shift icon up by giving it less top padding and more bottom padding
    // This compensates for the shadow appearing below the icon
    const topPadding = Math.round(totalVerticalPadding * 0.35); // 35% on top
    const bottomPadding = totalVerticalPadding - topPadding; // 65% on bottom
    
    console.log(`📏 Canvas: ${canvasSize}x${canvasSize}`);
    console.log(`📏 Icon: ${iconSize}x${iconSize}`);
    console.log(`📏 Top padding: ${topPadding}px`);
    console.log(`📏 Bottom padding: ${bottomPadding}px`);
    console.log(`📏 Horizontal padding: ${horizontalPadding}px each side`);
    
    // Resize and position the icon
    await sharp(originalImage)
      .resize(iconSize, iconSize, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .extend({
        top: topPadding,
        bottom: bottomPadding,
        left: horizontalPadding,
        right: horizontalPadding,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .jpeg({ quality: 95 })
      .toFile(outputImage + '.tmp');

    // Replace with new version
    fs.renameSync(outputImage + '.tmp', outputImage);

    console.log('\n✅ Created vertically adjusted splash screen!');
    console.log('   Icon is shifted upward to compensate for Android shadow');
    console.log('\n📱 Next steps:');
    console.log('   1. Rebuild: eas build --platform android --profile production');
    console.log('   2. Or test: npx expo run:android');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixVerticalAlignment();
