import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

// Guards against a page silently disappearing from the build.
test('sample build produces every page', () => {
  execFileSync(process.execPath, ['scripts/build.mjs', '--sample'], { stdio: 'pipe' });
  for (const page of ['index.html', 'acerca/index.html', 'compartir/index.html', 'cupones/index.html', 'publicar/index.html',
    'enlaces/index.html', '404.html', 'sitemap.xml', 'rss.xml', 'robots.txt', 'version.json']) {
    assert.ok(fs.existsSync(`dist/${page}`), `missing dist/${page}`);
  }
  assert.ok(fs.readdirSync('dist/categoria').length > 0, 'no category pages');
  assert.ok(fs.readdirSync('dist/oferta').length > 0, 'no deal pages');
});
