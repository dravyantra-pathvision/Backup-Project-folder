const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { marked } = require('marked');

async function main() {
  const mdPath = path.resolve(__dirname, '../../docs/DRAVYANTRA_MASTER_DOCUMENTATION.md');
  const htmlPath = path.resolve(__dirname, '../../docs/DRAVYANTRA_MASTER_DOCUMENTATION.html');
  const pdfPath = path.resolve(__dirname, '../../docs/DRAVYANTRA_MASTER_DOCUMENTATION.pdf');

  console.log('Reading markdown from:', mdPath);
  const mdContent = fs.readFileSync(mdPath, 'utf8');

  // Convert markdown to HTML
  const bodyHtml = marked(mdContent);

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>DravYantra Master Documentation</title>
  <script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
  <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
    
    @page {
      size: A4;
      margin: 18mm 16mm 18mm 16mm;
      @bottom-right {
        content: counter(page);
      }
    }
    
    * {
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      background-color: #ffffff;
      line-height: 1.6;
      font-size: 13.5px;
      margin: 0;
      padding: 0;
    }
    
    h1 {
      color: #0f172a;
      font-size: 22px;
      font-weight: 800;
      border-bottom: 2px solid #0284c7;
      padding-bottom: 8px;
      margin-top: 28px;
      margin-bottom: 14px;
      page-break-after: avoid;
    }
    
    h2 {
      color: #0369a1;
      font-size: 17px;
      font-weight: 700;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
      margin-top: 22px;
      margin-bottom: 10px;
      page-break-after: avoid;
    }
    
    h3 {
      color: #0f766e;
      font-size: 14.5px;
      font-weight: 700;
      margin-top: 18px;
      margin-bottom: 8px;
      page-break-after: avoid;
    }
    
    h4 {
      color: #334155;
      font-size: 13.5px;
      font-weight: 600;
      margin-top: 14px;
      margin-bottom: 6px;
      page-break-after: avoid;
    }
    
    p {
      margin-top: 0;
      margin-bottom: 10px;
    }
    
    ul, ol {
      margin-top: 0;
      margin-bottom: 12px;
      padding-left: 22px;
    }
    
    li {
      margin-bottom: 4px;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
      font-size: 12px;
      page-break-inside: avoid;
    }
    
    th, td {
      border: 1px solid #cbd5e1;
      padding: 7px 10px;
      text-align: left;
    }
    
    th {
      background-color: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
    }
    
    tr:nth-child(even) {
      background-color: #f8fafc;
    }
    
    pre {
      background-color: #0f172a;
      color: #f8fafc;
      padding: 12px 14px;
      border-radius: 6px;
      font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
      font-size: 11.5px;
      line-height: 1.45;
      overflow-x: auto;
      margin: 12px 0;
      page-break-inside: avoid;
      border: 1px solid #334155;
    }
    
    code {
      font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
      font-size: 12px;
      background-color: #f1f5f9;
      color: #0369a1;
      padding: 2px 5px;
      border-radius: 4px;
    }
    
    pre code {
      background-color: transparent;
      color: #f8fafc;
      padding: 0;
    }
    
    hr {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 22px 0;
    }
    
    blockquote {
      border-left: 4px solid #0284c7;
      background-color: #f0f9ff;
      margin: 12px 0;
      padding: 8px 14px;
      color: #0369a1;
      border-radius: 0 6px 6px 0;
    }
    
    .cover {
      text-align: center;
      padding: 40px 20px;
      border-bottom: 3px solid #0284c7;
      margin-bottom: 30px;
    }
    
    .cover h1 {
      border: none;
      font-size: 28px;
      color: #0f172a;
      margin-bottom: 8px;
    }
    
    .cover p {
      color: #64748b;
      font-size: 14px;
      font-weight: 500;
    }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;

  fs.writeFileSync(htmlPath, fullHtml, 'utf8');
  console.log('HTML written to:', htmlPath);

  // Path to Microsoft Edge
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  
  if (!fs.existsSync(edgePath)) {
    throw new Error('Edge executable not found at: ' + edgePath);
  }

  console.log('Rendering PDF via Headless Edge...');
  const cmd = `"${edgePath}" --headless --disable-gpu --run-all-compositor-stages-before-draw --no-pdf-header-footer --print-to-pdf="${pdfPath}" "${htmlPath}"`;
  
  execSync(cmd, { stdio: 'inherit' });

  if (fs.existsSync(pdfPath)) {
    const stats = fs.statSync(pdfPath);
    console.log(`PDF successfully generated at: ${pdfPath} (${(stats.size / 1024).toFixed(1)} KB)`);
  } else {
    console.error('PDF generation failed: File not found');
  }
}

main().catch(err => {
  console.error('Error generating PDF:', err);
  process.exit(1);
});
