// scripts/cleanup_local_uploads.js
const fs = require('fs');
const path = require('path');

function cleanDir(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  let count = 0;
  const items = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dirPath, item.name);
    if (item.isDirectory()) {
      count += cleanDir(fullPath);
    } else {
      fs.unlinkSync(fullPath);
      count++;
    }
  }
  return count;
}

const uploadsDir = path.join(__dirname, '../public/uploads');
const removedCount = cleanDir(uploadsDir);
console.log(`✅ Local disk cleanup complete! Removed ${removedCount} local files from backend/public/uploads/`);
