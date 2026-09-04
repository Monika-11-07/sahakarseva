const express = require("express");
const router = express.Router();
const { getPendingWorkers, getWorkerById, verifyWorker, rejectWorker, getAdminDashboard, getAllWorkers } = require("../controllers/adminController");
const { authenticateToken } = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

// All admin routes require JWT authentication and 'admin' role authorization
router.use(authenticateToken, adminMiddleware);

router.get("/dashboard", getAdminDashboard);
router.get("/workers", getAllWorkers);
router.get("/workers/pending", getPendingWorkers);
router.get("/workers/:id", getWorkerById);
router.put("/workers/:id/verify", verifyWorker);
router.put("/workers/:id/reject", rejectWorker);

module.exports = router;
