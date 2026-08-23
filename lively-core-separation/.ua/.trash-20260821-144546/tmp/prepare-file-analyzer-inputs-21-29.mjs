import fs from 'node:fs';
import path from 'node:path';

const projectRoot = 'D:/midDOW/lively-core-separation/lively-core-separation';
const uaDir = path.join(projectRoot, '.ua');
const batchesPath = path.join(uaDir, 'intermediate', 'batches.json');
const payload = JSON.parse(fs.readFileSync(batchesPath, 'utf8'));

for (const batch of payload.batches) {
  if (batch.batchIndex < 21 || batch.batchIndex > 29) continue;
  const input = {
    projectRoot,
    batchFiles: batch.files,
    batchImportData: batch.batchImportData,
  };
  const out = path.join(uaDir, 'tmp', `ua-file-analyzer-input-${batch.batchIndex}.json`);
  fs.writeFileSync(out, `${JSON.stringify(input, null, 2)}\n`, 'utf8');
}
