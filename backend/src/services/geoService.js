const pool = require("../config/database");

/**
 * Update or insert worker location into worker_locations using PostGIS geography ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography.
 * @param {string} workerId - UUID of the worker
 * @param {number} latitude - Latitude float coordinate
 * @param {number} longitude - Longitude float coordinate
 * @returns {Promise<Object>} Updated location record with latitude and longitude
 */
const updateWorkerLocation = async (workerId, latitude, longitude) => {
  const query = `
    INSERT INTO worker_locations (worker_id, location, updated_at)
    VALUES (
      $1,
      ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
      NOW()
    )
    ON CONFLICT (worker_id)
    DO UPDATE SET
      location = ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
      updated_at = NOW()
    RETURNING
      worker_id,
      ST_Y(location::geometry) AS latitude,
      ST_X(location::geometry) AS longitude,
      updated_at;
  `;

  const result = await pool.query(query, [workerId, longitude, latitude]);
  return result.rows[0];
};

/**
 * Fetch worker location converted into latitude and longitude using ST_Y and ST_X.
 * @param {string} workerId - UUID of the worker
 * @returns {Promise<Object|null>} Location record with latitude, longitude, and updated_at
 */
const getWorkerLocation = async (workerId) => {
  const query = `
    SELECT 
      worker_id,
      ST_Y(location::geometry) AS latitude,
      ST_X(location::geometry) AS longitude,
      updated_at
    FROM worker_locations
    WHERE worker_id = $1;
  `;

  const result = await pool.query(query, [workerId]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Fetch nearby verified and available workers within specified radius (in km) and optional skill filter.
 * @param {number} latitude - Target latitude float coordinate
 * @param {number} longitude - Target longitude float coordinate
 * @param {number} radiusKm - Search radius in kilometers
 * @param {string} [skill] - Optional skill filter
 * @returns {Promise<Array>} List of matching nearby workers ordered by distance
 */
const getNearbyWorkers = async (latitude, longitude, radiusKm, skill) => {
  const radiusMeters = radiusKm * 1000;
  let paramIndex = 4;
  let skillCondition = "";
  const queryParams = [longitude, latitude, radiusMeters];

  if (skill && typeof skill === "string" && skill.trim()) {
    skillCondition = `AND LOWER(w.skill) = LOWER($${paramIndex})`;
    queryParams.push(skill.trim());
    paramIndex++;
  }

  const query = `
    SELECT 
      w.id AS worker_id,
      w.user_id,
      u.full_name,
      u.phone,
      w.skill,
      w.district,
      w.rating,
      w.experience,
      ROUND((ST_Distance(
        wl.location,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      ) / 1000.0)::numeric, 2) AS distance_km
    FROM workers w
    INNER JOIN users u ON w.user_id = u.id
    INNER JOIN worker_locations wl ON w.id = wl.worker_id
    WHERE LOWER(w.verification_status) = 'verified'
      AND w.available = true
      AND ST_DWithin(
        wl.location,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3
      )
      ${skillCondition}
    ORDER BY distance_km ASC;
  `;

  const result = await pool.query(query, queryParams);
  return result.rows;
};

module.exports = {
  updateWorkerLocation,
  getWorkerLocation,
  getNearbyWorkers,
};
