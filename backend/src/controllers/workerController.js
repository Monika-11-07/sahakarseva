const pool = require("../config/database");
const { uploadToSupabase } = require("../services/storageService");
const { getNearbyWorkers: findNearbyWorkers } = require("../services/geoService");

/**
 * Register a new worker profile.
 * POST /api/workers/register-profile
 * Requires JWT authentication & 'worker' role.
 */
const registerProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { skill, experience, cooperative_name, district, state, bio } = req.body;

    // 1. Validation
    if (!skill || typeof skill !== "string" || !skill.trim()) {
      return res.status(400).json({
        success: false,
        message: "Skill is required",
      });
    }

    const expNum = Number(experience);
    if (experience !== undefined && experience !== null && (isNaN(expNum) || expNum < 0)) {
      return res.status(400).json({
        success: false,
        message: "Experience must be a non-negative number",
      });
    }

    const trimmedSkill = skill.trim();
    const parsedExperience = isNaN(expNum) ? 0 : expNum;
    const trimmedCoop = cooperative_name && typeof cooperative_name === "string" ? cooperative_name.trim() : null;
    const trimmedDistrict = district && typeof district === "string" ? district.trim() : null;
    const trimmedState = state && typeof state === "string" ? state.trim() : null;
    const trimmedBio = bio && typeof bio === "string" ? bio.trim() : null;

    // 2. Check if worker profile already exists for this user
    const existingWorker = await pool.query(
      "SELECT id FROM workers WHERE user_id = $1",
      [userId]
    );

    if (existingWorker.rows.length > 0) {
      const updateResult = await pool.query(
        `UPDATE workers 
         SET skill = $1, experience = $2, cooperative_name = $3, district = $4, state = $5, bio = $6
         WHERE user_id = $7
         RETURNING id, user_id, skill, experience, cooperative_name, district, state, bio, verification_status, rating, available, created_at`,
        [trimmedSkill, parsedExperience, trimmedCoop, trimmedDistrict, trimmedState, trimmedBio, userId]
      );

      return res.status(200).json({
        success: true,
        message: "Worker profile updated successfully",
        data: updateResult.rows[0],
      });
    }

    // 3. Insert new worker profile with defaults (verification_status = 'PENDING', rating = 0, available = true)
    const insertResult = await pool.query(
      `INSERT INTO workers (user_id, skill, experience, cooperative_name, district, state, bio, verification_status, rating, available)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', 0, true)
       RETURNING id, user_id, skill, experience, cooperative_name, district, state, bio, verification_status, rating, available, created_at`,
      [userId, trimmedSkill, parsedExperience, trimmedCoop, trimmedDistrict, trimmedState, trimmedBio]
    );

    const worker = insertResult.rows[0];

    return res.status(201).json({
      success: true,
      message: "Worker profile registered successfully",
      data: worker,
    });
  } catch (error) {
    console.error("Worker registration error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

/**
 * Update existing worker profile attributes (experience, district, state, bio, available).
 * PUT /api/workers/update-profile
 * Requires JWT authentication & 'worker' role.
 * Note: verification_status cannot be updated via this endpoint.
 */
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Check if worker profile exists
    const checkWorker = await pool.query(
      "SELECT * FROM workers WHERE user_id = $1",
      [userId]
    );

    if (checkWorker.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Worker profile not found",
      });
    }

    const currentWorker = checkWorker.rows[0];
    const { experience, district, state, bio, available } = req.body;

    // 2. Validate experience if provided
    let newExp = currentWorker.experience;
    if (experience !== undefined && experience !== null) {
      const expNum = Number(experience);
      if (isNaN(expNum) || expNum < 0) {
        return res.status(400).json({
          success: false,
          message: "Experience must be a non-negative number",
        });
      }
      newExp = expNum;
    }

    let newDistrict = district !== undefined ? (typeof district === "string" ? district.trim() : district) : currentWorker.district;
    let newState = state !== undefined ? (typeof state === "string" ? state.trim() : state) : currentWorker.state;
    let newBio = bio !== undefined ? (typeof bio === "string" ? bio.trim() : bio) : currentWorker.bio;
    let newAvailable = available !== undefined ? Boolean(available) : currentWorker.available;

    // 3. Update database record (verification_status remains untouched)
    const updateResult = await pool.query(
      `UPDATE workers
       SET experience = $1, district = $2, state = $3, bio = $4, available = $5
       WHERE user_id = $6
       RETURNING id, user_id, skill, experience, cooperative_name, district, state, bio, verification_status, rating, available, created_at, aadhaar_url, certificate_url, profile_image_url`,
      [newExp, newDistrict, newState, newBio, newAvailable, userId]
    );

    return res.status(200).json({
      success: true,
      message: "Worker profile updated successfully",
      data: updateResult.rows[0],
    });
  } catch (error) {
    console.error("Worker update error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

/**
 * Upload KYC document files (aadhaar, certificate, profileImage) to Supabase Storage.
 * POST /api/workers/upload-kyc
 * Requires multipart/form-data, JWT authentication, and 'worker' role.
 */
const uploadKYC = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Check if worker profile exists
    const checkWorker = await pool.query(
      "SELECT * FROM workers WHERE user_id = $1",
      [userId]
    );

    if (checkWorker.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Worker profile not found. Please register worker profile first.",
      });
    }

    const currentWorker = checkWorker.rows[0];
    const files = req.files || {};

    const aadhaarFile = files.aadhaar ? files.aadhaar[0] : null;
    const certificateFile = files.certificate ? files.certificate[0] : null;
    const profileImageFile = files.profileImage ? files.profileImage[0] : null;

    if (!aadhaarFile && !certificateFile && !profileImageFile) {
      return res.status(400).json({
        success: false,
        message: "At least one KYC file (aadhaar, certificate, or profileImage) is required for upload",
      });
    }

    let aadhaarUrl = currentWorker.aadhaar_url;
    let certificateUrl = currentWorker.certificate_url;
    let profileImageUrl = currentWorker.profile_image_url;

    // 2. Upload files to Supabase Storage worker-documents bucket
    if (aadhaarFile) {
      aadhaarUrl = await uploadToSupabase(aadhaarFile, "aadhaar", userId);
    }

    if (certificateFile) {
      certificateUrl = await uploadToSupabase(certificateFile, "certificate", userId);
    }

    if (profileImageFile) {
      profileImageUrl = await uploadToSupabase(profileImageFile, "profileImage", userId);
    }

    // 3. Store returned public URLs in PostgreSQL workers table
    const updateResult = await pool.query(
      `UPDATE workers
       SET aadhaar_url = $1, certificate_url = $2, profile_image_url = $3
       WHERE user_id = $4
       RETURNING id, user_id, skill, experience, cooperative_name, district, state, bio, verification_status, rating, available, created_at, aadhaar_url, certificate_url, profile_image_url`,
      [aadhaarUrl, certificateUrl, profileImageUrl, userId]
    );

    return res.status(200).json({
      success: true,
      message: "KYC documents uploaded successfully",
      data: updateResult.rows[0],
    });
  } catch (error) {
    console.error("KYC upload error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

/**
 * Retrieve authenticated worker profile by joining users and workers tables.
 * GET /api/workers/me
 * Requires JWT authentication & 'worker' role.
 */
const getWorkerMe = async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT 
        u.full_name,
        u.email,
        u.phone,
        w.id AS worker_id,
        w.user_id,
        w.skill,
        w.experience,
        w.cooperative_name,
        w.district,
        w.state,
        w.bio,
        w.rating,
        w.available,
        w.verification_status,
        w.aadhaar_url,
        w.certificate_url,
        w.profile_image_url,
        w.created_at
      FROM users u
      INNER JOIN workers w ON u.id = w.user_id
      WHERE u.id = $1
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Worker profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Worker profile retrieved successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Get worker me error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

/**
 * Get nearby verified and available workers within a radius.
 * GET /api/workers/nearby
 * Query Params: lat, lng, radius (in km), skill (optional)
 * Accessible by authenticated users (or workers).
 */
const getNearbyWorkers = async (req, res) => {
  try {
    const { lat, lng, radius, skill } = req.query;

    if (lat === undefined || lat === null || lng === undefined || lng === null) {
      return res.status(400).json({
        success: false,
        message: "Latitude (lat) and Longitude (lng) query parameters are required",
      });
    }

    const latNum = Number(lat);
    const lngNum = Number(lng);

    if (isNaN(latNum) || isNaN(lngNum)) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude must be valid numeric values",
      });
    }

    if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      return res.status(400).json({
        success: false,
        message: "Latitude must be between -90 and 90, Longitude between -180 and 180",
      });
    }

    const radiusNum = radius !== undefined && radius !== null ? Number(radius) : 10; // Default 10km radius if not provided
    if (isNaN(radiusNum) || radiusNum <= 0) {
      return res.status(400).json({
        success: false,
        message: "Radius must be a positive numeric value in kilometers",
      });
    }

    const workers = await findNearbyWorkers(latNum, lngNum, radiusNum, skill);

    return res.status(200).json({
      success: true,
      message: "Nearby workers retrieved successfully",
      count: workers.length,
      workers: workers,
      data: {
        count: workers.length,
        workers: workers,
      },
    });
  } catch (error) {
    console.error("Get nearby workers error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

module.exports = { registerProfile, updateProfile, uploadKYC, getWorkerMe, getNearbyWorkers };
