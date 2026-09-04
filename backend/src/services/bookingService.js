const pool = require("../config/database");

/**
 * Service function to create a new booking in PostgreSQL bookings table.
 * @param {Object} bookingData
 * @param {string} bookingData.customerId - UUID of the customer from JWT
 * @param {string} bookingData.workerId - UUID of target worker (or worker user)
 * @param {string} bookingData.serviceName - Name of service
 * @param {string} bookingData.bookingDate - Booking date (YYYY-MM-DD)
 * @param {string} bookingData.bookingTime - Booking time (HH:MM or HH:MM:SS)
 * @param {string} bookingData.address - Service address
 * @param {number|null} bookingData.latitude - Latitude float coordinate
 * @param {number|null} bookingData.longitude - Longitude float coordinate
 * @param {string|null} bookingData.notes - Additional booking notes
 * @returns {Promise<Object>} Inserted booking database row
 */
const createBooking = async ({
  customerId,
  workerId,
  serviceName,
  bookingDate,
  bookingTime,
  address,
  latitude,
  longitude,
  notes,
}) => {
  const query = `
    INSERT INTO bookings (
      customer_id,
      worker_id,
      service_name,
      booking_date,
      booking_time,
      address,
      latitude,
      longitude,
      notes,
      status,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING', NOW())
    RETURNING 
      id,
      customer_id,
      worker_id,
      service_name,
      booking_date,
      booking_time,
      address,
      latitude,
      longitude,
      notes,
      status,
      created_at;
  `;

  const values = [
    customerId,
    workerId || null,
    serviceName,
    bookingDate,
    bookingTime,
    address,
    latitude !== undefined && latitude !== null ? Number(latitude) : null,
    longitude !== undefined && longitude !== null ? Number(longitude) : null,
    notes || null,
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};

/**
 * Fetch all bookings created by a specific customer, joined with workers and users.
 * @param {string} customerId - UUID of the authenticated customer
 * @returns {Promise<Array>} List of customer's bookings sorted newest first
 */
const getCustomerBookings = async (customerId) => {
  const query = `
    SELECT 
      b.id AS booking_id,
      b.id,
      b.customer_id,
      b.worker_id,
      u.full_name AS worker_name,
      u.phone AS worker_phone,
      u.email AS worker_email,
      b.service_name AS service,
      b.service_name,
      b.booking_date AS date,
      b.booking_date,
      b.booking_time AS time,
      b.booking_time,
      b.address,
      b.status AS booking_status,
      b.status,
      b.latitude,
      b.longitude,
      b.notes,
      b.created_at
    FROM bookings b
    LEFT JOIN workers w ON (b.worker_id = w.id OR b.worker_id = w.user_id)
    LEFT JOIN users u ON (w.user_id = u.id OR b.worker_id = u.id)
    WHERE b.customer_id = $1
    ORDER BY b.created_at DESC, b.id DESC;
  `;

  const result = await pool.query(query, [customerId]);
  return result.rows;
};

/**
 * Fetch all bookings assigned to a specific worker, joined with customer users.
 * @param {string} workerUserId - UUID of the authenticated worker (users.id)
 * @returns {Promise<Array>} List of worker's assigned bookings sorted by booking_date and booking_time
 */
const getWorkerBookings = async (workerUserId) => {
  const query = `
    SELECT 
      b.id AS booking_id,
      b.id,
      b.customer_id,
      b.worker_id,
      u.full_name AS customer_name,
      u.full_name AS customer_full_name,
      u.phone AS customer_phone,
      u.phone,
      u.email AS customer_email,
      b.service_name,
      b.service_name AS service,
      b.booking_date,
      b.booking_date AS date,
      b.booking_time,
      b.booking_time AS time,
      b.address,
      b.status AS booking_status,
      b.status,
      b.latitude,
      b.longitude,
      b.notes,
      b.created_at
    FROM bookings b
    JOIN users u ON b.customer_id = u.id
    LEFT JOIN workers w ON (b.worker_id = w.id OR b.worker_id = w.user_id)
    WHERE b.worker_id = $1 
       OR w.user_id = $1 
       OR w.id = $1
    ORDER BY b.booking_date ASC, b.booking_time ASC, b.created_at DESC;
  `;

  const result = await pool.query(query, [workerUserId]);
  return result.rows;
};

/**
 * Update status of a booking by worker after ownership validation and transition rules check.
 * @param {Object} params
 * @param {string} params.bookingId - UUID/ID of the booking
 * @param {string} params.workerUserId - UUID of the authenticated worker (users.id)
 * @param {string} params.newStatus - Target status to transition to
 * @returns {Promise<Object>} Updated booking record
 */
const updateBookingStatusByWorker = async ({ bookingId, workerUserId, newStatus }) => {
  // 1. Fetch existing booking and worker association
  const findQuery = `
    SELECT 
      b.*,
      w.user_id AS worker_user_id,
      w.id AS worker_profile_id
    FROM bookings b
    LEFT JOIN workers w ON (b.worker_id = w.id OR b.worker_id = w.user_id)
    WHERE b.id::text = $1;
  `;
  const findResult = await pool.query(findQuery, [bookingId]);

  if (findResult.rows.length === 0) {
    const error = new Error("Booking not found");
    error.statusCode = 404;
    throw error;
  }

  const booking = findResult.rows[0];

  // 2. Validate worker ownership (must be assigned to this booking)
  const isAssignedWorker =
    (booking.worker_id && (booking.worker_id.toString() === workerUserId.toString() || booking.worker_id.toString() === booking.worker_profile_id?.toString())) ||
    (booking.worker_user_id && booking.worker_user_id.toString() === workerUserId.toString()) ||
    (booking.worker_profile_id && booking.worker_profile_id.toString() === workerUserId.toString());

  if (!isAssignedWorker) {
    const error = new Error("Forbidden: You are not assigned to update this booking");
    error.statusCode = 403;
    throw error;
  }

  // 3. State transitions check:
  // PENDING -> ACCEPTED / REJECTED
  // ACCEPTED -> ON_THE_WAY
  // ON_THE_WAY -> STARTED
  // STARTED -> COMPLETED
  const currentStatus = (booking.status || "").toUpperCase().trim();
  const targetStatus = newStatus.toUpperCase().trim();

  const allowedTransitions = {
    PENDING: ["ACCEPTED", "REJECTED"],
    ACCEPTED: ["ON_THE_WAY"],
    ON_THE_WAY: ["STARTED"],
    STARTED: ["COMPLETED"],
  };

  const validNextStatuses = allowedTransitions[currentStatus] || [];
  if (!validNextStatuses.includes(targetStatus)) {
    const error = new Error(
      `Invalid status transition from '${currentStatus}' to '${targetStatus}'. Allowed next status(es): ${validNextStatuses.length > 0 ? validNextStatuses.join(", ") : "None (booking is finalized)"}`
    );
    error.statusCode = 400;
    throw error;
  }

  // 4. Update status in DB
  const updateQuery = `
    UPDATE bookings
    SET status = $1
    WHERE id = $2
    RETURNING *;
  `;
  const updateResult = await pool.query(updateQuery, [targetStatus, booking.id]);
  return updateResult.rows[0];
};

/**
 * Cancel a booking by the customer who created it, if status is PENDING.
 * @param {Object} params
 * @param {string} params.bookingId - ID of booking to cancel
 * @param {string} params.customerId - UUID of the authenticated customer (req.user.id)
 * @returns {Promise<Object>} Cancelled booking database record
 */
const cancelBookingByCustomer = async ({ bookingId, customerId }) => {
  // 1. Check if booking exists
  const findQuery = `SELECT * FROM bookings WHERE id::text = $1;`;
  const findResult = await pool.query(findQuery, [bookingId]);

  if (findResult.rows.length === 0) {
    const error = new Error("Booking not found");
    error.statusCode = 404;
    throw error;
  }

  const booking = findResult.rows[0];

  // 2. Customer ownership check
  if (booking.customer_id.toString() !== customerId.toString()) {
    const error = new Error("Forbidden: You can only cancel your own bookings");
    error.statusCode = 403;
    throw error;
  }

  // 3. Status check: must be PENDING
  const currentStatus = (booking.status || "").toUpperCase().trim();
  if (currentStatus !== "PENDING") {
    const error = new Error(`Only bookings with status 'PENDING' can be cancelled. Current status is '${booking.status}'`);
    error.statusCode = 400;
    throw error;
  }

  // 4. Update status = CANCELLED
  const updateQuery = `
    UPDATE bookings
    SET status = 'CANCELLED'
    WHERE id = $1
    RETURNING *;
  `;
  const updateResult = await pool.query(updateQuery, [booking.id]);
  return updateResult.rows[0];
};

module.exports = {
  createBooking,
  getCustomerBookings,
  getWorkerBookings,
  updateBookingStatusByWorker,
  cancelBookingByCustomer,
};
