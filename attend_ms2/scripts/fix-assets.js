const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const imagesToFix = [
    'assets/images/icon.png',
    'assets/images/splash.png'
];

async function fixImages() {
    console.log('🔧 Starting asset fix...');

    for (const relativePath of imagesToFix) {
        const fullPath = path.resolve(__dirname, '..', relativePath);

        if (!fs.existsSync(fullPath)) {
            console.warn(`⚠️ File not found: ${relativePath}`);
            continue;
        }

        try {
            console.log(`Processing ${relativePath}...`);

            // Read the file
            const buffer = fs.readFileSync(fullPath);

            // Convert to PNG using sharp
            const pngBuffer = await sharp(buffer)
                .toFormat('png')
                .toBuffer();

            // Write back
            fs.writeFileSync(fullPath, pngBuffer);
            console.log(`✅ Converted ${relativePath} to valid PNG`);
        } catch (error) {
            console.error(`❌ Failed to process ${relativePath}:`, error);
        }
    }

    console.log('✨ Asset fix complete');
}

fixImages().catch(console.error);
