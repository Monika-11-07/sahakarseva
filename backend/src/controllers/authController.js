const pool = require("../config/database");
const supabase = require("../config/supabase");

const register = async (req, res) => {
  try {
    const { full_name, email, phone, password, role } = req.body;

    // 1. Validation
    if (!full_name || typeof full_name !== "string" || !full_name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Full name is required",
      });
    }

    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    if (!phone || (typeof phone !== "string" && typeof phone !== "number") || !String(phone).trim()) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password is required and must be at least 6 characters long",
      });
    }

    if (!role || typeof role !== "string" || !role.trim()) {
      return res.status(400).json({
        success: false,
        message: "Role is required",
      });
    }

    const trimmedFullName = full_name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = String(phone).trim();
    const trimmedRole = role.trim();

    // 2. Check duplicate email or phone in database
    const existingUserCheck = await pool.query(
      "SELECT email, phone FROM users WHERE LOWER(email) = LOWER($1) OR phone = $2",
      [trimmedEmail, trimmedPhone]
    );

    if (existingUserCheck.rows.length > 0) {
      const match = existingUserCheck.rows.find(
        (u) => u.email.toLowerCase() === trimmedEmail
      );
      if (match) {
        return res.status(400).json({
          success: false,
          message: "Email already registered",
        });
      }
      return res.status(400).json({
        success: false,
        message: "Phone number already registered",
      });
    }

    // 3. Register user in Supabase Auth (using admin.createUser to avoid email rate limits)
    let authData;
    let authError;

    if (supabase.auth.admin && typeof supabase.auth.admin.createUser === "function") {
      const res = await supabase.auth.admin.createUser({
        email: trimmedEmail,
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: trimmedFullName,
          phone: trimmedPhone,
          role: trimmedRole,
        },
      });
      authData = res.data;
      authError = res.error;
    } else {
      const res = await supabase.auth.signUp({
        email: trimmedEmail,
        password: password,
        options: {
          data: {
            full_name: trimmedFullName,
            phone: trimmedPhone,
            role: trimmedRole,
          },
        },
      });
      authData = res.data;
      authError = res.error;
    }

    if (authError) {
      let status = 400;
      let message = authError.message;
      if (
        message.toLowerCase().includes("already registered") ||
        message.toLowerCase().includes("already exists")
      ) {
        message = "Email already registered";
      }
      return res.status(status).json({
        success: false,
        message: message,
      });
    }

    if (!authData || !authData.user) {
      return res.status(500).json({
        success: false,
        message: "Failed to create Supabase Auth account",
      });
    }

    const userId = authData.user.id;

    // 4. Save user details in database (public.users)
    try {
      const dbResult = await pool.query(
        "INSERT INTO users (id, full_name, email, phone, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, email, phone, role, created_at",
        [userId, trimmedFullName, trimmedEmail, trimmedPhone, trimmedRole]
      );

      const dbUser = dbResult.rows[0];

      // 5. Automatically sign in to generate JWT access_token
      let accessToken = null;
      let refreshToken = null;
      try {
        const loginRes = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password: password,
        });
        if (loginRes.data && loginRes.data.session) {
          accessToken = loginRes.data.session.access_token;
          refreshToken = loginRes.data.session.refresh_token;
        }
      } catch (_loginErr) {
        console.warn("Auto-login post registration notice:", _loginErr.message);
      }

      // 6. Return user details & tokens
      return res.status(201).json({
        success: true,
        message: "User registered successfully",
        access_token: accessToken,
        refresh_token: refreshToken,
        token: accessToken,
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        user: {
          id: dbUser.id,
          full_name: dbUser.full_name,
          email: dbUser.email,
          phone: dbUser.phone,
          role: dbUser.role,
        },
      });
    } catch (dbError) {
      // Rollback Supabase auth user if db insertion fails
      try {
        if (supabase.auth.admin && typeof supabase.auth.admin.deleteUser === "function") {
          await supabase.auth.admin.deleteUser(userId);
        }
      } catch (rollbackErr) {
        console.error("Failed to rollback Supabase user:", rollbackErr.message);
      }

      if (dbError.code === "23505") {
        if (dbError.constraint && dbError.constraint.includes("phone")) {
          return res.status(400).json({
            success: false,
            message: "Phone number already registered",
          });
        }
        if (dbError.constraint && dbError.constraint.includes("email")) {
          return res.status(400).json({
            success: false,
            message: "Email already registered",
          });
        }
        return res.status(400).json({
          success: false,
          message: "User with given email or phone already exists",
        });
      }

      throw dbError;
    }
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validation
    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    if (!password || typeof password !== "string" || !password.trim()) {
      return res.status(400).json({
        success: false,
        message: "Password is required",
      });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // 2. Authenticate with Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: password,
      });

    if (authError || !authData || !authData.session) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const { user, session } = authData;

    // 3. Fetch user details from PostgreSQL database
    let fullName = user.user_metadata?.full_name || "";
    let userRole = user.user_metadata?.role || "";

    try {
      const dbResult = await pool.query(
        "SELECT id, full_name, email, phone, role FROM users WHERE id = $1 OR LOWER(email) = LOWER($2)",
        [user.id, trimmedEmail]
      );
      if (dbResult.rows.length > 0) {
        fullName = dbResult.rows[0].full_name || fullName;
        userRole = dbResult.rows[0].role || userRole;
      }
    } catch (dbErr) {
      console.error("Error fetching user profile from database:", dbErr.message);
    }

    // 4. Return access_token, refresh_token, role, full_name, and success message
    return res.status(200).json({
      success: true,
      message: "Login successful",
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      role: userRole,
      full_name: fullName,
      user: {
        id: user.id,
        email: user.email,
        full_name: fullName,
        role: userRole,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const dbResult = await pool.query(
      "SELECT id, full_name, email, phone, role, created_at FROM users WHERE id = $1",
      [userId]
    );

    const userProfile = dbResult.rows.length > 0 ? dbResult.rows[0] : req.user;

    return res.status(200).json({
      success: true,
      user: userProfile,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

module.exports = { register, login, getProfile };
