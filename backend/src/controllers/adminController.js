const pool = require("../config/database");

/**
 * Get all pending worker profiles for admin review.
 * GET /api/admin/workers/pending
 * Requires JWT authentication & 'admin' role.
 * Returns count and workers array.
 */
const getPendingWorkers = async (req, res) => {
  try {
    const query = `
      SELECT 
        w.id,
        w.id AS worker_id,
        w.user_id,
        u.full_name,
        u.email,
        u.phone,
        w.skill,
        w.experience,
        w.cooperative_name,
        w.district,
        w.state,
        w.bio,
        w.verification_status,
        w.rejection_reason,
        w.rating,
        w.available,
        w.aadhaar_url,
        w.certificate_url,
        w.profile_image_url,
        w.created_at
      FROM workers w
      INNER JOIN users u ON w.user_id = u.id
      WHERE LOWER(w.verification_status) = 'pending'
      ORDER BY w.created_at DESC
    `;

    const result = await pool.query(query);
    const workers = result.rows;
    const count = workers.length;

    return res.status(200).json({
      success: true,
      message: "Pending worker profiles retrieved successfully",
      count: count,
      workers: workers,
      data: {
        count: count,
        workers: workers,
      },
    });
  } catch (error) {
    console.error("Get pending workers error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

/**
 * Get complete worker profile by ID (worker ID or user ID) for admin review.
 * GET /api/admin/workers/:id
 * Requires JWT authentication & 'admin' role.
 */
const getWorkerById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        w.id AS worker_id,
        w.id,
        w.user_id,
        u.full_name,
        u.email,
        u.phone,
        w.skill,
        w.experience,
        w.cooperative_name,
        w.district,
        w.state,
        w.bio,
        w.verification_status,
        w.rejection_reason,
        w.rating,
        w.available,
        w.aadhaar_url,
        w.certificate_url,
        w.profile_image_url,
        w.created_at
      FROM workers w
      INNER JOIN users u ON w.user_id = u.id
      WHERE w.id::text = $1 OR w.user_id::text = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Worker profile not found",
      });
    }

    const workerProfile = result.rows[0];

    return res.status(200).json({
      success: true,
      message: "Worker profile retrieved successfully",
      worker: workerProfile,
      data: workerProfile,
    });
  } catch (error) {
    console.error("Get worker by ID error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

/**
 * Verify worker profile status (updates verification_status to VERIFIED).
 * PUT /api/admin/workers/:id/verify
 * Requires JWT authentication & 'admin' role.
 */
const verifyWorker = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    const targetStatus = status ? String(status).toUpperCase().trim() : "VERIFIED";

    if (!["VERIFIED", "REJECTED", "PENDING"].includes(targetStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Allowed values: 'VERIFIED', 'REJECTED', 'PENDING'",
      });
    }

    // 1. Update verification_status in workers table and clear rejection_reason if verifying
    const updateResult = await pool.query(
      `UPDATE workers
       SET verification_status = $1, rejection_reason = NULL
       WHERE id::text = $2 OR user_id::text = $2
       RETURNING id, user_id`,
      [targetStatus, id]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Worker profile not found",
      });
    }

    const workerId = updateResult.rows[0].id;

    // 2. Fetch full updated worker profile with user details
    const profileQuery = `
      SELECT 
        w.id AS worker_id,
        w.id,
        w.user_id,
        u.full_name,
        u.email,
        u.phone,
        w.skill,
        w.experience,
        w.cooperative_name,
        w.district,
        w.state,
        w.bio,
        w.verification_status,
        w.rejection_reason,
        w.rating,
        w.available,
        w.aadhaar_url,
        w.certificate_url,
        w.profile_image_url,
        w.created_at
      FROM workers w
      INNER JOIN users u ON w.user_id = u.id
      WHERE w.id = $1
    `;

    const profileResult = await pool.query(profileQuery, [workerId]);
    const updatedWorker = profileResult.rows[0];

    return res.status(200).json({
      success: true,
      message: "Worker profile verified successfully",
      worker: updatedWorker,
      data: updatedWorker,
    });
  } catch (error) {
    console.error("Verify worker error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

/**
 * Reject worker profile status and save rejection_reason.
 * PUT /api/admin/workers/:id/reject
 * Requires JWT authentication & 'admin' role.
 */
const rejectWorker = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejection_reason } = req.body || {};

    if (!rejection_reason || typeof rejection_reason !== "string" || !rejection_reason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    const trimmedReason = rejection_reason.trim();

    // 1. Update verification_status = 'REJECTED' and rejection_reason in workers table
    const updateResult = await pool.query(
      `UPDATE workers
       SET verification_status = 'REJECTED', rejection_reason = $1
       WHERE id::text = $2 OR user_id::text = $2
       RETURNING id, user_id`,
      [trimmedReason, id]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Worker profile not found",
      });
    }

    const workerId = updateResult.rows[0].id;

    // 2. Fetch full updated worker profile with user details
    const profileQuery = `
      SELECT 
        w.id AS worker_id,
        w.id,
        w.user_id,
        u.full_name,
        u.email,
        u.phone,
        w.skill,
        w.experience,
        w.cooperative_name,
        w.district,
        w.state,
        w.bio,
        w.verification_status,
        w.rejection_reason,
        w.rating,
        w.available,
        w.aadhaar_url,
        w.certificate_url,
        w.profile_image_url,
        w.created_at
      FROM workers w
      INNER JOIN users u ON w.user_id = u.id
      WHERE w.id = $1
    `;

    const profileResult = await pool.query(profileQuery, [workerId]);
    const updatedWorker = profileResult.rows[0];

    return res.status(200).json({
      success: true,
      message: "Worker profile rejected successfully",
      rejection_reason: trimmedReason,
      worker: updatedWorker,
      data: updatedWorker,
    });
  } catch (error) {
    console.error("Reject worker error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

/**
 * Get admin dashboard worker statistics.
 * GET /api/admin/dashboard
 * Requires JWT authentication & 'admin' role.
 */
const getAdminDashboard = async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*)::INTEGER AS total_workers,
        COUNT(CASE WHEN LOWER(verification_status) = 'verified' THEN 1 END)::INTEGER AS verified_workers,
        COUNT(CASE WHEN LOWER(verification_status) = 'pending' THEN 1 END)::INTEGER AS pending_workers,
        COUNT(CASE WHEN LOWER(verification_status) = 'rejected' THEN 1 END)::INTEGER AS rejected_workers,
        COUNT(CASE WHEN available = true THEN 1 END)::INTEGER AS available_workers
      FROM workers
    `;

    const result = await pool.query(query);
    const stats = result.rows[0] || {
      total_workers: 0,
      verified_workers: 0,
      pending_workers: 0,
      rejected_workers: 0,
      available_workers: 0,
    };

    return res.status(200).json({
      success: true,
      message: "Admin dashboard statistics retrieved successfully",
      dashboard: stats,
      total_workers: stats.total_workers,
      verified_workers: stats.verified_workers,
      pending_workers: stats.pending_workers,
      rejected_workers: stats.rejected_workers,
      available_workers: stats.available_workers,
      data: stats,
    });
  } catch (error) {
    console.error("Get admin dashboard error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

/**
 * Get all worker profiles (verified, pending, rejected) with location coordinates for admin review.
 * GET /api/admin/workers
 * Requires JWT authentication & 'admin' role.
 * Returns success, count, and workers array sorted by created_at DESC.
 */
const getAllWorkers = async (req, res) => {
  try {
    const query = `
      SELECT 
        w.id,
        w.id AS worker_id,
        w.user_id,
        u.full_name,
        u.email,
        u.phone,
        w.skill,
        w.experience,
        w.cooperative_name,
        w.district,
        w.state,
        w.bio,
        w.verification_status,
        w.rejection_reason,
        w.rating,
        w.available,
        w.aadhaar_url,
        w.certificate_url,
        w.profile_image_url,
        w.created_at,
        ST_Y(wl.location::geometry) AS latitude,
        ST_X(wl.location::geometry) AS longitude
      FROM workers w
      INNER JOIN users u ON w.user_id = u.id
      LEFT JOIN worker_locations wl ON w.id = wl.worker_id
      ORDER BY w.created_at DESC
    `;

    const result = await pool.query(query);
    const workers = result.rows.map((row) => ({
      ...row,
      latitude: row.latitude !== null && row.latitude !== undefined ? Number(row.latitude) : null,
      longitude: row.longitude !== null && row.longitude !== undefined ? Number(row.longitude) : null,
    }));

    const count = workers.length;

    return res.status(200).json({
      success: true,
      message: "All worker profiles retrieved successfully",
      count: count,
      workers: workers,
      data: {
        count: count,
        workers: workers,
      },
    });
  } catch (error) {
    console.error("Get all workers error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

module.exports = {
  getPendingWorkers,
  getWorkerById,
  verifyWorker,
  rejectWorker,
  getAdminDashboard,
  getAllWorkers,
};
