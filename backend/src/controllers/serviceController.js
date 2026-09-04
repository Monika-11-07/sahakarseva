const pool = require("../config/database");

const getServices = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, icon FROM services ORDER BY id"
    );

    res.status(200).json({
      success: true,
      services: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = { getServices };