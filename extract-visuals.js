// Re-render PDF pages and extract ONLY the visuals (renderings, plans, diagrams)
// Strategy: render full page, then crop out text headers/captions to get pure visual content
const fs = require('fs');
const path = require('path');
const { createCanvas, Image } = require('canvas');
const sharp = require('sharp');

global.Image = Image;
global.DOMMatrix = class {
  constructor(init) {
    this.a=1;this.b=0;this.c=0;this.d=1;this.e=0;this.f=0;
    if(init&&init.length>=6){this.a=init[0];this.b=init[1];this.c=init[2];this.d=init[3];this.e=init[4];this.f=init[5];}
  }
};

const pdfjsLib = require('pdfjs-dist');
pdfjsLib.GlobalWorkerOptions.workerSrc = path.join(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.js');

async function renderFullPage(pdfPath, pageNum) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjsLib.getDocument({ data, verbosity: 0 }).promise;
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });
  const scale = 1600 / viewport.width;
  const scaledViewport = page.getViewport({ scale });

  const canvas = createCanvas(scaledViewport.width, scaledViewport.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
  return canvas.toBuffer('image/png');
}

// Crop definitions: [left%, top%, width%, height%] — keeps only the visual content
const CROPS = {
  // Renderings: keep the image, cut text headers and captions
  'atmosphere-void':     { crop: [0.05, 0.08, 0.90, 0.62], label: 'Modular Void Rendering' },
  'atmosphere-communal': { crop: [0.05, 0.08, 0.90, 0.62], label: 'Communal Heart Rendering' },
  'atmosphere-private':  { crop: [0.05, 0.08, 0.90, 0.62], label: 'Private Unit Rendering' },

  // Plans: keep the drawing area, cut title blocks
  'plans':         { crop: [0.03, 0.05, 0.94, 0.78], label: 'Podium & Ground Plans' },
  'plans-typical': { crop: [0.03, 0.05, 0.94, 0.78], label: 'Typical Floor Plan' },

  // Roof terrace: mixed plan + rendering
  'roof-terrace':  { crop: [0.03, 0.05, 0.94, 0.75], label: 'Roof Terrace' },

  // Detail/exploded: diagram
  'detail-exploded': { crop: [0.05, 0.06, 0.90, 0.78], label: 'Assembly Detail' },

  // Concept: diagrammatic, keep central
  'concept-evolution': { crop: [0.02, 0.04, 0.96, 0.82], label: 'Concept Evolution' },

  // Structure: 3D diagram
  'structure-core': { crop: [0.05, 0.06, 0.90, 0.75], label: 'Core & Module' },

  // Analysis pages - these are text+diagram, crop to the diagram area
  'analysis-urban': { crop: [0.05, 0.10, 0.90, 0.65], label: 'Urban Analysis' },
  'site-analysis':  { crop: [0.03, 0.07, 0.94, 0.70], label: 'Site Analysis' },
  'cfd-section':    { crop: [0.03, 0.08, 0.94, 0.70], label: 'CFD & Section' },
  'case-study':     { crop: [0.05, 0.10, 0.90, 0.65], label: 'Case Study' },

  // Cover: keep the graphic
  'cover': { crop: [0.05, 0.06, 0.90, 0.78], label: 'Cover' },
};

const OUTPUT_WIDTH = 1200;

async function processImage(pageNum, name, cropDef, pdfPath) {
  const pngBuffer = await renderFullPage(pdfPath, pageNum);
  const metadata = await sharp(pngBuffer).metadata();

  const w = metadata.width;
  const h = metadata.height;

  // Calculate crop region
  const left = Math.round(w * cropDef.crop[0]);
  const top = Math.round(h * cropDef.crop[1]);
  const cropW = Math.round(w * cropDef.crop[2]);
  const cropH = Math.round(h * cropDef.crop[3]);

  const outPath = path.join('./images', name + '.jpg');

  // Extract the visual content: crop → resize
  await sharp(pngBuffer)
    .extract({ left, top, width: cropW, height: cropH })
    .resize(OUTPUT_WIDTH, null, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88, progressive: true })
    .toFile(outPath);

  const finalMeta = await sharp(outPath).metadata();
  return { name, w: finalMeta.width, h: finalMeta.height, aspect: (finalMeta.width/finalMeta.height).toFixed(2) };
}

async function main() {
  const pdfPath = 'c:/Michael-Yip/Chu Hai College/year 3/adt/sem2/portfo/組合 1.pdf';

  const pageMap = {
    'atmosphere-void': 9, 'atmosphere-communal': 10, 'atmosphere-private': 11,
    'plans': 12, 'plans-typical': 13, 'roof-terrace': 14,
    'detail-exploded': 15, 'concept-evolution': 7, 'structure-core': 8,
    'analysis-urban': 3, 'site-analysis': 4, 'cfd-section': 5,
    'case-study': 6, 'cover': 1
  };

  console.log('Extracting pure visuals from portfolio pages...\n');
  console.log('(Cropping out text headers, captions, and margins)\n');

  if (!fs.existsSync('./images')) fs.mkdirSync('./images');

  const results = [];
  for (const [name, pageNum] of Object.entries(pageMap)) {
    const cropDef = CROPS[name];
    try {
      const r = await processImage(pageNum, name, cropDef, pdfPath);
      console.log('  ✓ ' + r.name + ' → ' + r.w + '×' + r.h + ' (' + r.aspect + ':1) — ' + cropDef.label);
      results.push(r);
    } catch(e) {
      console.log('  ✗ ' + name + ': ' + (e.message || e).toString().substring(0, 100));
    }
  }

  console.log('\n✓ ' + results.length + ' pure visuals extracted');
  console.log('  All text removed — website text now carries the narrative');
}

main().catch(e => console.error('Fatal:', e.message || e));
