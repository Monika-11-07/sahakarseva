const pool = require("../config/database");
const {
  createBooking,
  getCustomerBookings: fetchCustomerBookings,
  getWorkerBookings: fetchWorkerBookings,
  updateBookingStatusByWorker,
  cancelBookingByCustomer,
} = require("../services/bookingService");

/**
 * Controller to create a new booking request.
 * POST /api/bookings
 * Requires Customer Authentication (JWT).
 */
const postBooking = async (req, res) => {
  try {
    const customerId = req.user.id;
    const {
      worker_id,
      service_name,
      booking_date,
      booking_time,
      address,
      latitude,
      longitude,
      notes,
    } = req.body || {};

    // 1. Mandatory input validations
    if (!service_name || typeof service_name !== "string" || !service_name.trim()) {
      return res.status(400).json({
        success: false,
        message: "service_name is required",
      });
    }

    if (!booking_date || typeof booking_date !== "string" || !booking_date.trim()) {
      return res.status(400).json({
        success: false,
        message: "booking_date is required (YYYY-MM-DD)",
      });
    }

    if (!booking_time || typeof booking_time !== "string" || !booking_time.trim()) {
      return res.status(400).json({
        success: false,
        message: "booking_time is required (e.g. 10:30)",
      });
    }

    if (!address || typeof address !== "string" || !address.trim()) {
      return res.status(400).json({
        success: false,
        message: "address is required",
      });
    }

    // 2. Validate optional worker_id if provided (ensure worker exists in workers table)
    let validWorkerId = null;
    if (worker_id && typeof worker_id === "string" && worker_id.trim()) {
      const trimmedWorkerId = worker_id.trim();
      const workerCheck = await pool.query(
        "SELECT id FROM workers WHERE id::text = $1 OR user_id::text = $1",
        [trimmedWorkerId]
      );
      if (workerCheck.rows.length > 0) {
        validWorkerId = workerCheck.rows[0].id;
      } else {
        // If provided worker_id doesn't exist in workers table, set validWorkerId as trimmedWorkerId if valid UUID
        validWorkerId = trimmedWorkerId;
      }
    }

    // 3. Create booking using bookingService
    const newBooking = await createBooking({
      customerId: customerId,
      workerId: validWorkerId,
      serviceName: service_name.trim(),
      bookingDate: booking_date.trim(),
      bookingTime: booking_time.trim(),
      address: address.trim(),
      latitude: latitude,
      longitude: longitude,
      notes: notes && typeof notes === "string" ? notes.trim() : null,
    });

    return res.status(201).json({
      success: true,
      message: "Booking created successfully",
      booking_id: newBooking.id,
      id: newBooking.id,
      status: newBooking.status,
      booking: newBooking,
      data: newBooking,
    });
  } catch (error) {
    console.error("Create booking error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

/**
 * Controller to fetch all bookings created by the authenticated customer.
 * GET /api/bookings/customer
 * Requires Customer Authentication (JWT).
 */
const getCustomerBookings = async (req, res) => {
  try {
    const customerId = req.user.id;

    const bookings = await fetchCustomerBookings(customerId);

    return res.status(200).json({
      success: true,
      message: "Customer bookings retrieved successfully",
      count: bookings.length,
      bookings: bookings,
      data: {
        count: bookings.length,
        bookings: bookings,
      },
    });
  } catch (error) {
    console.error("Get customer bookings error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

/**
 * Controller to fetch all bookings assigned to the authenticated worker.
 * GET /api/bookings/worker
 * Requires Worker Authentication (JWT).
 */
const getWorkerBookings = async (req, res) => {
  try {
    const workerUserId = req.user.id;

    const bookings = await fetchWorkerBookings(workerUserId);

    return res.status(200).json({
      success: true,
      message: "Worker bookings retrieved successfully",
      count: bookings.length,
      bookings: bookings,
      data: {
        count: bookings.length,
        bookings: bookings,
      },
    });
  } catch (error) {
    console.error("Get worker bookings error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

/**
 * Controller to update booking status by assigned worker.
 * PUT /api/bookings/:id/status
 * Requires Worker Authentication (JWT).
 */
const updateBookingStatus = async (req, res) => {
  try {
    const workerUserId = req.user.id;
    const { id } = req.params;
    const { status, booking_status } = req.body || {};
    const newStatus = status || booking_status;

    if (!newStatus || typeof newStatus !== "string" || !newStatus.trim()) {
      return res.status(400).json({
        success: false,
        message: "status is required in request body",
      });
    }

    const updatedBooking = await updateBookingStatusByWorker({
      bookingId: id,
      workerUserId: workerUserId,
      newStatus: newStatus.trim(),
    });

    return res.status(200).json({
      success: true,
      message: `Booking status successfully updated to ${updatedBooking.status}`,
      booking: updatedBooking,
      data: updatedBooking,
    });
  } catch (error) {
    console.error("Update booking status error:", error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

/**
 * Controller to cancel a booking request by customer.
 * DELETE /api/bookings/:id
 * Requires Customer Authentication (JWT).
 */
const deleteBooking = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { id } = req.params;

    const cancelledBooking = await cancelBookingByCustomer({
      bookingId: id,
      customerId: customerId,
    });

    return res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      booking: cancelledBooking,
      data: cancelledBooking,
    });
  } catch (error) {
    console.error("Cancel booking error:", error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

module.exports = {
  postBooking,
  getCustomerBookings,
  getWorkerBookings,
  updateBookingStatus,
  deleteBooking,
};
