require("dotenv").config();

const express = require("express");
const cors = require("cors");
const pool = require("./src/config/database");
const serviceRoutes = require("./src/routes/serviceRoutes");
const authRoutes = require("./src/routes/authRoutes");
const workerRoutes = require("./src/routes/workerRoutes");
const adminRoutes = require("./src/routes/adminRoutes");
const locationRoutes = require("./src/routes/locationRoutes");
const bookingRoutes = require("./src/routes/bookingRoutes");
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/workers", workerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/bookings", bookingRoutes);
// Test Route
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "SahakarSeva Backend Running Successfully 🚀"
  });
});

const PORT = process.env.PORT || 5000;

async function connectDatabase() {
  try {
    const client = await pool.connect();
    console.log("✅ Connected to Supabase PostgreSQL");
    client.release();
  } catch (err) {
    console.error("❌ Database Connection Failed");
    console.error(err.message);
  }
}

connectDatabase();
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});