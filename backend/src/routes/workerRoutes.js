const express = require("express");
const router = express.Router();
const { registerProfile, updateProfile, uploadKYC, getWorkerMe, getNearbyWorkers } = require("../controllers/workerController");
const { authenticateToken, optionalAuthenticateToken, requireWorkerRole } = require("../middleware/authMiddleware");
const { uploadKYCFields } = require("../middleware/uploadMiddleware");

// GET /api/workers/nearby accessible publicly or with optional authentication
router.get("/nearby", optionalAuthenticateToken, getNearbyWorkers);

// Worker role restricted endpoints require valid JWT authentication
router.use(authenticateToken);
router.use(requireWorkerRole);
router.post("/register-profile", registerProfile);
router.put("/update-profile", updateProfile);
router.post("/upload-kyc", uploadKYCFields, uploadKYC);
router.get("/me", getWorkerMe);

module.exports = router;
