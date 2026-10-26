// scripts/test_workflow.ts — End-to-end test for Python file creation, ZIP archive packaging, and extraction verification
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createZipBuffer } from '../backend/src/utils/zip.ts';
import { getSystemPaths } from '../backend/src/routes/fileManager.ts';

const execFileAsync = promisify(execFile);

async function runTests() {
  console.log('===========================================================');
  console.log('   NILESH AI — END-TO-END WORKFLOW VERIFICATION TEST');
  console.log('===========================================================');

  const paths = getSystemPaths();
  console.log('Detected Windows User:', paths.username);
  console.log('Detected Downloads Directory:', paths.downloads);
  console.log('Nilesh Root in Downloads:', paths.nileshBase);

  // ── TEST 1: Single Python File Generation & Verification ──────────
  console.log('\n--- 1. Testing Single Python File Generation ---');
  const pyFolder = path.join(paths.subFolders.mlProjects, 'HousePricePrediction');
  fs.mkdirSync(pyFolder, { recursive: true });
  const pyFile = path.join(pyFolder, 'house_price_prediction.py');
  const pyContent = `# house_price_prediction.py — Nilesh AI Generated
import math

def predict_price(sqft, bedrooms):
    base_price = 50000
    price = base_price + (sqft * 120) + (bedrooms * 25000)
    return price

if __name__ == '__main__':
    estimate = predict_price(1800, 3)
    print(f"Estimated House Price: \${estimate:,.2f}")
`;
  fs.writeFileSync(pyFile, pyContent, 'utf8');

  if (!fs.existsSync(pyFile)) {
    throw new Error(`File was not created on disk: ${pyFile}`);
  }
  const pyStat = fs.statSync(pyFile);
  console.log(`✅ Python file created and verified at: ${pyFile}`);
  console.log(`   File Size: ${pyStat.size} bytes`);
  console.log(`   File Content check: ${fs.readFileSync(pyFile, 'utf8').includes('predict_price') ? 'PASSED' : 'FAILED'}`);

  // ── TEST 2: Multi-file React Project ZIP Packaging ────────────────
  console.log('\n--- 2. Testing Multi-file React Project ZIP Packaging ---');
  const reactFiles = [
    {
      path: 'package.json',
      content: JSON.stringify({
        name: 'prinit-cafe',
        private: true,
        version: '1.0.0',
        scripts: { dev: 'vite', build: 'vite build' },
        dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
      }, null, 2),
    },
    {
      path: 'index.html',
      content: `<!DOCTYPE html><html><head><title>Prinit Cafe</title></head><body><div id="root"></div></body></html>`,
    },
    {
      path: 'src/App.jsx',
      content: `export default function App() { return <h1>Prinit Cafe - Ahmedabad</h1>; }`,
    },
    {
      path: 'README.md',
      content: `# Prinit Cafe\n\nGenerated with Nilesh AI.\n\n## Quick Start\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`,
    },
  ];

  const zipBuf = createZipBuffer(reactFiles);
  const zipPath = path.join(paths.subFolders.projects, 'PrinitCafe.zip');
  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  fs.writeFileSync(zipPath, zipBuf);

  if (!fs.existsSync(zipPath)) {
    throw new Error(`ZIP archive was not created on disk: ${zipPath}`);
  }
  const zipStat = fs.statSync(zipPath);
  console.log(`✅ ZIP archive created and verified at: ${zipPath}`);
  console.log(`   ZIP Size: ${zipStat.size} bytes`);

  // ── TEST 3: Extract ZIP with Windows PowerShell to test integrity ──
  console.log('\n--- 3. Testing ZIP Archive Extraction & Integrity ---');
  const extractDir = path.join(paths.subFolders.projects, 'PrinitCafe_Extracted');
  if (fs.existsSync(extractDir)) {
    fs.rmSync(extractDir, { recursive: true, force: true });
  }
  fs.mkdirSync(extractDir, { recursive: true });

  const psScript = `Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force`;
  await execFileAsync('powershell.exe', ['-NoProfile', '-Command', psScript]);

  const extractedFiles = fs.readdirSync(extractDir);
  console.log(`✅ ZIP successfully extracted by Windows PowerShell!`);
  console.log(`   Extracted files in folder:`, extractedFiles);

  const hasPkg = fs.existsSync(path.join(extractDir, 'package.json'));
  const hasApp = fs.existsSync(path.join(extractDir, 'src', 'App.jsx'));
  const hasReadme = fs.existsSync(path.join(extractDir, 'README.md'));

  if (hasPkg && hasApp && hasReadme) {
    console.log(`✅ All extracted files match expected structure (package.json, src/App.jsx, README.md)`);
  } else {
    throw new Error('Extracted files do not match expected structure');
  }

  console.log('\n===========================================================');
  console.log('   🎉 ALL 3 TESTS PASSED! DOWNLOADS & SAVING SYSTEM VERIFIED');
  console.log('===========================================================');
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
