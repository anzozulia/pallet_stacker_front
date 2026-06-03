#!/usr/bin/env node
// Code-split assertion (D-04 / T-1-03):
// After `vite build`, the heavy three / r3f / drei trio MUST live ONLY in the
// lazy /result chunk and be ABSENT from the entry (Configure / index-*) chunk.
// Exits non-zero (failing the build gate) if three leaks into the entry chunk.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ASSETS_DIR = join(process.cwd(), 'dist', 'assets');

// Markers that are extremely characteristic of the three.js engine being bundled
// into a chunk. We require ALL to be present to call a chunk "contains three".
const THREE_MARKERS = ['BufferGeometry', 'WebGLRenderer'];

function fail(msg) {
  console.error(`✗ code-split check FAILED: ${msg}`);
  process.exit(1);
}

let jsFiles;
try {
  jsFiles = readdirSync(ASSETS_DIR).filter(
    (f) => f.endsWith('.js') && statSync(join(ASSETS_DIR, f)).isFile(),
  );
} catch {
  fail(`could not read ${ASSETS_DIR} — run \`npm run build\` first.`);
}

if (jsFiles.length === 0) fail(`no JS chunks found in ${ASSETS_DIR}.`);

const entryChunks = jsFiles.filter((f) => f.startsWith('index-'));
if (entryChunks.length === 0) {
  fail(`no entry chunk (index-*.js) found in ${ASSETS_DIR}.`);
}

const chunkHasThree = (file) => {
  const src = readFileSync(join(ASSETS_DIR, file), 'utf8');
  return THREE_MARKERS.every((m) => src.includes(m));
};

const entryWithThree = entryChunks.filter(chunkHasThree);
const lazyChunksWithThree = jsFiles
  .filter((f) => !f.startsWith('index-'))
  .filter(chunkHasThree);

if (entryWithThree.length > 0) {
  fail(
    `three leaked into the entry chunk(s): ${entryWithThree.join(', ')}. ` +
      `The /result route must be React.lazy-loaded so three stays out of the Configure bundle.`,
  );
}

if (lazyChunksWithThree.length === 0) {
  fail(
    `three was not found in any lazy chunk. Expected the /result chunk to contain three ` +
      `(markers: ${THREE_MARKERS.join(', ')}). Did the build emit a separate chunk?`,
  );
}

console.log('✓ code-split check PASSED');
console.log(`  entry chunk(s) (three-free): ${entryChunks.join(', ')}`);
console.log(`  three lives in lazy chunk(s): ${lazyChunksWithThree.join(', ')}`);
