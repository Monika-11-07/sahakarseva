const express = require("express");
const router = express.Router();
const {
  postBooking,
  getCustomerBookings,
  getWorkerBookings,
  updateBookingStatus,
  deleteBooking,
} = require("../controllers/bookingController");
const { authenticateToken, requireCustomerRole, requireWorkerRole } = require("../middleware/authMiddleware");

// All booking endpoints require JWT token authentication
router.use(authenticateToken);

// Customer endpoints
router.post("/", requireCustomerRole, postBooking);
router.get("/customer", requireCustomerRole, getCustomerBookings);
router.delete("/:id", requireCustomerRole, deleteBooking);

// Worker endpoints
router.get("/worker", requireWorkerRole, getWorkerBookings);
router.put("/:id/status", requireWorkerRole, updateBookingStatus);

module.exports = router;
