const express = require("express");
const router = express.Router();
const { updateLocation, getMyLocation } = require("../controllers/locationController");
const { authenticateToken, requireWorkerRole } = require("../middleware/authMiddleware");

// Location routes require JWT authentication and worker role
router.use(authenticateToken, requireWorkerRole);

router.post("/update", updateLocation);
router.get("/my-location", getMyLocation);

module.exports = router;
