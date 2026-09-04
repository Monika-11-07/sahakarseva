const pool = require("../config/database");
const { updateWorkerLocation, getWorkerLocation } = require("../services/geoService");

/**
 * Controller for updating worker live location.
 * POST /api/location/update
 * Requires JWT authentication & 'worker' role.
 */
const updateLocation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { latitude, longitude } = req.body || {};

    // 1. Validate latitude and longitude parameters
    if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    const latNum = Number(latitude);
    const lngNum = Number(longitude);

    if (isNaN(latNum) || isNaN(lngNum)) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude must be valid numeric values",
      });
    }

    if (latNum < -90 || latNum > 90) {
      return res.status(400).json({
        success: false,
        message: "Latitude must be between -90 and 90 degrees",
      });
    }

    if (lngNum < -180 || lngNum > 180) {
      return res.status(400).json({
        success: false,
        message: "Longitude must be between -180 and 180 degrees",
      });
    }

    // 2. Fetch worker ID associated with the authenticated user
    const workerResult = await pool.query(
      "SELECT id FROM workers WHERE user_id = $1",
      [userId]
    );

    if (workerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Worker profile not found. Please register worker profile first.",
      });
    }

    const workerId = workerResult.rows[0].id;

    // 3. Upsert worker location using geoService PostGIS query
    const locationData = await updateWorkerLocation(workerId, latNum, lngNum);

    return res.status(200).json({
      success: true,
      message: "Worker location updated successfully",
      latitude: Number(locationData.latitude),
      longitude: Number(locationData.longitude),
      updated_at: locationData.updated_at,
      data: {
        worker_id: locationData.worker_id,
        latitude: Number(locationData.latitude),
        longitude: Number(locationData.longitude),
        updated_at: locationData.updated_at,
      },
    });
  } catch (error) {
    console.error("Location update error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

/**
 * Controller for retrieving authenticated worker's stored location.
 * GET /api/location/my-location
 * Requires JWT authentication & 'worker' role.
 */
const getMyLocation = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Fetch worker ID associated with authenticated user
    const workerResult = await pool.query(
      "SELECT id FROM workers WHERE user_id = $1",
      [userId]
    );

    if (workerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Worker profile not found. Please register worker profile first.",
      });
    }

    const workerId = workerResult.rows[0].id;

    // 2. Query stored location converted into latitude & longitude via ST_Y and ST_X
    const locationData = await getWorkerLocation(workerId);

    if (!locationData) {
      return res.status(404).json({
        success: false,
        message: "Worker location not found. Please update location first.",
      });
    }

    const latitude = Number(locationData.latitude);
    const longitude = Number(locationData.longitude);

    return res.status(200).json({
      success: true,
      message: "Worker location retrieved successfully",
      latitude: latitude,
      longitude: longitude,
      updated_at: locationData.updated_at,
      data: {
        worker_id: locationData.worker_id,
        latitude: latitude,
        longitude: longitude,
        updated_at: locationData.updated_at,
      },
    });
  } catch (error) {
    console.error("Get my location error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

module.exports = {
  updateLocation,
  getMyLocation,
};
