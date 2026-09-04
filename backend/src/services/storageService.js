const { supabaseAdmin } = require("../config/supabase");
const path = require("path");

const BUCKET_NAME = "worker-documents";

/**
 * Uploads a file buffer to Supabase Storage and returns the public URL.
 * @param {Object} file - Multer file object containing buffer, originalname, mimetype
 * @param {string} folder - Document type folder ('aadhaar', 'certificate', 'profile')
 * @param {string} userId - User ID
 * @returns {Promise<string>} Public URL of uploaded file
 */
const uploadToSupabase = async (file, folder, userId) => {
  if (!file || !file.buffer) {
    throw new Error("Invalid file provided for upload");
  }

  const ext = path.extname(file.originalname) || ".png";
  const sanitizedOriginalName = path
    .basename(file.originalname, ext)
    .replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `${userId}/${folder}_${Date.now()}_${sanitizedOriginalName}${ext}`;

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });

  if (error) {
    console.error(`Supabase storage upload error for ${folder}:`, error.message);
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data: urlData } = supabaseAdmin.storage
    .from(BUCKET_NAME)
    .getPublicUrl(fileName);

  return urlData.publicUrl;
};

module.exports = { uploadToSupabase, BUCKET_NAME };
