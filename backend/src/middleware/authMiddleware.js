const jwt = require("jsonwebtoken");
const supabase = require("../config/supabase");
const pool = require("../config/database");

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader || typeof authHeader !== "string") {
      return res.status(401).json({
        success: false,
        message: "Access token missing",
      });
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({
        success: false,
        message: "Invalid token format. Format must be 'Bearer <token>'",
      });
    }

    const token = parts[1].trim();
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token missing",
      });
    }

    // 1. Verify token with Supabase Auth
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data || !data.user) {
      // Secondary check with jsonwebtoken if JWT_SECRET is configured
      if (process.env.JWT_SECRET) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          req.user = decoded;
          return next();
        } catch (jwtErr) {
          // Fallback failed
        }
      }

      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    const user = data.user;

    // 2. Fetch full user details from DB and attach to req.user
    let userRole = user.user_metadata?.role || "";
    let fullName = user.user_metadata?.full_name || "";
    let phone = user.user_metadata?.phone || "";

    try {
      const dbResult = await pool.query(
        "SELECT id, full_name, email, phone, role FROM users WHERE id = $1",
        [user.id]
      );
      if (dbResult.rows.length > 0) {
        const dbUser = dbResult.rows[0];
        fullName = dbUser.full_name || fullName;
        userRole = dbUser.role || userRole;
        phone = dbUser.phone || phone;
      }
    } catch (dbErr) {
      console.error("Database lookup error in authMiddleware:", dbErr.message);
    }

    req.user = {
      id: user.id,
      email: user.email,
      full_name: fullName,
      phone: phone,
      role: userRole,
      app_metadata: user.app_metadata,
      user_metadata: user.user_metadata,
    };

    return next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(401).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Access token missing",
      });
    }

    const userRole = (req.user.role || "").toLowerCase().trim();
    const normalizedAllowedRoles = allowedRoles.map((r) => r.toLowerCase().trim());

    if (!normalizedAllowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Access restricted to worker role",
      });
    }

    return next();
  };
};

const requireWorkerRole = authorizeRoles("worker");

module.exports = { authenticateToken, authorizeRoles, requireWorkerRole };
