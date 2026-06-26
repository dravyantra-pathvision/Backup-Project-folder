// services/uploadService.js
const fs = require('fs');
const path = require('path');
const supabaseAdmin = require('../config/supabase');

const uploadFile = async (bucket, file, req) => {
  const fileName = `${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;

  if (supabaseAdmin) {
    try {
      const { error } = await supabaseAdmin.storage
        .from(bucket)
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });

      if (!error) {
        const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(fileName);
        return { url: data.publicUrl };
      }
      console.warn('Supabase upload failed, falling back to local storage:', error);
    } catch (e) {
      console.warn('Supabase upload threw error, falling back to local storage:', e);
    }
  }

  // Local storage fallback
  const uploadDir = path.join(__dirname, '../public/uploads', bucket);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filePath = path.join(uploadDir, fileName);
  fs.writeFileSync(filePath, file.buffer);

  // Construct absolute URL
  const protocol = req.protocol;
  const host = req.get('host');
  const publicUrl = `${protocol}://${host}/uploads/${bucket}/${fileName}`;
  return { url: publicUrl };
};

module.exports = {
  uploadFile
};
