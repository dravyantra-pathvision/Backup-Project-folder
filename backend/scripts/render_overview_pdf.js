const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function renderPdf(htmlPath, pdfPath) {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  if (!fs.existsSync(edgePath)) {
    throw new Error('Edge executable not found at: ' + edgePath);
  }

  console.log(`Rendering ${path.basename(htmlPath)} -> ${path.basename(pdfPath)}...`);
  const cmd = `"${edgePath}" --headless --disable-gpu --run-all-compositor-stages-before-draw --no-pdf-header-footer --print-to-pdf="${pdfPath}" "${htmlPath}"`;
  execSync(cmd, { stdio: 'inherit' });

  if (fs.existsSync(pdfPath)) {
    const stats = fs.statSync(pdfPath);
    console.log(`Success: ${path.basename(pdfPath)} (${(stats.size / 1024).toFixed(1)} KB)`);
  } else {
    console.error(`Failed to generate ${path.basename(pdfPath)}`);
  }
}

async function main() {
  const docsDir = path.resolve(__dirname, '../../docs');
  const overviewHtml = path.join(docsDir, 'DRAVYANTRA_PROJECT_OVERVIEW.html');
  const overviewPdf = path.join(docsDir, 'DRAVYANTRA_PROJECT_OVERVIEW.pdf');

  renderPdf(overviewHtml, overviewPdf);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
