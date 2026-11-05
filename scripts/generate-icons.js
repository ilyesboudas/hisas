import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const publicDir = path.resolve('public');
const iconSvg = fs.readFileSync(path.join(publicDir, 'icon.svg'));
const maskableSvg = fs.readFileSync(path.join(publicDir, 'icon-maskable.svg'));

async function generate() {
  console.log('Generating PWA icons...');

  await sharp(iconSvg)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));

  await sharp(iconSvg)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));

  await sharp(maskableSvg)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));

  await sharp(iconSvg)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));

  await sharp(iconSvg)
    .resize(48, 48)
    .png()
    .toFile(path.join(publicDir, 'favicon.png'));

  await sharp(iconSvg)
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon.ico'));

  console.log('Successfully generated all PWA PNG icons!');

  // Generate Android launcher icons if android folder exists
  const androidResDir = path.resolve('android/app/src/main/res');
  if (fs.existsSync(androidResDir)) {
    console.log('Generating Android mipmap icons...');
    const sizes = [
      { dir: 'mipmap-mdpi', size: 48 },
      { dir: 'mipmap-hdpi', size: 72 },
      { dir: 'mipmap-xhdpi', size: 96 },
      { dir: 'mipmap-xxhdpi', size: 144 },
      { dir: 'mipmap-xxxhdpi', size: 192 },
    ];
    for (const item of sizes) {
      const targetDir = path.join(androidResDir, item.dir);
      if (fs.existsSync(targetDir)) {
        await sharp(iconSvg)
          .resize(item.size, item.size)
          .png()
          .toFile(path.join(targetDir, 'ic_launcher.png'));
        await sharp(iconSvg)
          .resize(item.size, item.size)
          .png()
          .toFile(path.join(targetDir, 'ic_launcher_round.png'));
      }
    }
    console.log('Successfully generated Android launcher icons!');
  }
}

generate().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
