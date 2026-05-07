import fs from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';

const outputDir = path.resolve('dist');
const outputPath = path.join(outputDir, 'review-bell.zip');

fs.mkdirSync(outputDir, { recursive: true });

const output = fs.createWriteStream(outputPath);
const archive = archiver('zip', { zlib: { level: 9 } });

archive.pipe(output);

for (const entry of ['manifest.json', 'src', 'icons', 'README.md', 'PRIVACY.md']) {
  const stats = fs.statSync(entry);
  if (stats.isDirectory()) archive.directory(entry, entry);
  else archive.file(entry, { name: entry });
}

await archive.finalize();

output.on('close', () => {
  console.log(`Created ${outputPath}`);
});
