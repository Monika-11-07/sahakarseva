/**
 * Express middleware to authorize users with the "admin" role.
 * Expects JWT authentication middleware (authenticateToken) to run first.
 */
const adminMiddleware = (req, res, next) => {
  try {
    // 1. Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Access token missing",
      });
    }

    // 2. Read role from req.user
    const userRole = (req.user.role || "").toLowerCase().trim();

    // 3. Verify admin role
    if (userRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Access restricted to admin role",
      });
    }

    return next();
  } catch (error) {
    console.error("Admin middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during authorization",
    });
  }
};

module.exports = adminMiddleware;
