// services/uploadService.js
// Extracted upload helper utilizing Supabase Admin SDK L432-459 of index.js
const supabaseAdmin = require('../config/supabase');

const uploadFile = async (bucket, file) => {
  const fileName = `${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;

  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });

  if (error) {
    throw error;
  }

  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(fileName);
  return { url: data.publicUrl };
};

module.exports = {
  uploadFile
};
