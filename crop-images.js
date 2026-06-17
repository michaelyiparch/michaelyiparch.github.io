// Crop all portfolio images to unified 16:10 format
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const IMG_DIR = './images';
const OUTPUT_DIR = './images/cropped';
const TARGET_WIDTH = 1200;
const TARGET_HEIGHT = 750; // 16:10

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

const images = fs.readdirSync(IMG_DIR).filter(f => f.endsWith('.jpg'));

console.log('Cropping images to unified 1200x750 (16:10)...\n');

async function processImage(filename) {
  const inputPath = path.join(IMG_DIR, filename);
  const outputPath = path.join(OUTPUT_DIR, filename);

  // Get original dimensions
  const metadata = await sharp(inputPath).metadata();

  // For pages that are mostly text-heavy, crop from the right side (where diagrams usually are)
  // For rendering pages, center crop
  // Default: center crop with slight preference for visual content

  let cropStrategy = 'centre'; // default

  // Pages that have text on left, diagrams on right — crop from right
  const rightHeavyPages = [
    'analysis-urban.jpg',
    'site-analysis.jpg',
    'cfd-section.jpg',
    'case-study.jpg',
  ];

  // Renderings — center crop
  const centerPages = [
    'atmosphere-void.jpg',
    'atmosphere-communal.jpg',
    'atmosphere-private.jpg',
    'cover.jpg',
    'structure-core.jpg',
    'concept-evolution.jpg',
    'detail-exploded.jpg',
    'roof-terrace.jpg',
    'plans.jpg',
    'plans-typical.jpg',
  ];

  if (rightHeavyPages.includes(filename)) {
    cropStrategy = 'east'; // crop from right side where diagrams are
  }

  // Resize and crop
  await sharp(inputPath)
    .resize(TARGET_WIDTH, TARGET_HEIGHT, {
      fit: 'cover',
      position: cropStrategy,
    })
    .jpeg({ quality: 85, progressive: true })
    .toFile(outputPath);

  // Replace original with cropped version
  fs.unlinkSync(inputPath);
  fs.renameSync(outputPath, inputPath);

  const newMeta = await sharp(inputPath).metadata();
  console.log(`  ✓ ${filename}: ${metadata.width}x${metadata.height} → ${newMeta.width}x${newMeta.height}`);
}

(async () => {
  for (const img of images) {
    await processImage(img);
  }

  // Clean up cropped dir if empty
  try { fs.rmdirSync(OUTPUT_DIR); } catch(e) {}

  console.log(`\n✓ All ${images.length} images cropped to 16:10`);
})();
