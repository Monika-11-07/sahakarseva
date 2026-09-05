const express = require("express");
const router = express.Router();
const { register, login, getProfile } = require("../controllers/authController");
const { authenticateToken } = require("../middleware/authMiddleware");

router.post("/register", register);
router.post("/signup", register);
router.post("/login", login);

// Protected user profile routes
router.get("/profile", authenticateToken, getProfile);
router.get("/me", authenticateToken, getProfile);

module.exports = router;
