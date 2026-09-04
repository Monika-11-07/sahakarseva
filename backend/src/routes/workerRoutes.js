const express = require("express");
const router = express.Router();
const { registerProfile, updateProfile, uploadKYC, getWorkerMe, getNearbyWorkers } = require("../controllers/workerController");
const { authenticateToken, requireWorkerRole } = require("../middleware/authMiddleware");
const { uploadKYCFields } = require("../middleware/uploadMiddleware");

// Authentication middleware applied for worker routes
router.use(authenticateToken);

// GET /api/workers/nearby accessible to authenticated users
router.get("/nearby", getNearbyWorkers);

// Worker role restricted endpoints
router.use(requireWorkerRole);
router.post("/register-profile", registerProfile);
router.put("/update-profile", updateProfile);
router.post("/upload-kyc", uploadKYCFields, uploadKYC);
router.get("/me", getWorkerMe);

module.exports = router;
