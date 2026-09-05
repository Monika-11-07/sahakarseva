import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
const TOKEN_STORAGE_KEY = '@sahakarseva_auth_token';
const USER_STORAGE_KEY = '@sahakarseva_user_data';

let memoryAuthToken = null;

export const setAuthToken = (token) => {
  memoryAuthToken = token;
};

export const getAuthToken = async () => {
  if (memoryAuthToken) return memoryAuthToken;
  try {
    const stored = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) memoryAuthToken = stored;
    return stored;
  } catch (_e) {
    return memoryAuthToken;
  }
};

export const saveSession = async (token, user) => {
  memoryAuthToken = token;
  try {
    if (token) await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
    if (user) await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch (_e) {
    console.error('Failed to save session locally:', _e);
  }
};

export const clearSession = async () => {
  memoryAuthToken = null;
  try {
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
    await AsyncStorage.removeItem(USER_STORAGE_KEY);
  } catch (_e) {
    console.error('Failed to clear session:', _e);
  }
};

export const getStoredUser = async () => {
  try {
    const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (_e) {
    return null;
  }
};

async function request(path, options = {}) {
  const token = await getAuthToken();
  const isFormData = options.body instanceof FormData;

  const headers = {
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(token && token !== 'registered' ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  try {
    const url = `${API_BASE_URL}${path}`;
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && (body.message?.includes('token') || body.message?.includes('expired'))) {
        await clearSession();
      }
      throw new Error(body.message || body.error || `Request failed (${response.status})`);
    }
    return body;
  } catch (err) {
    console.error(`API Error [${options.method || 'GET'} ${path}]:`, err.message);
    throw err;
  }
}

// --- Auth Endpoints ---
export const authApi = {
  login: async (credentials) => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    const token = res.access_token || res.token;
    if (token && res.user) {
      await saveSession(token, res.user);
    }
    return res;
  },
  signup: async (userData) => {
    const res = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    let token = res.access_token || res.token;
    let user = res.user;

    // If registration didn't issue token directly, log in to fetch fresh JWT token
    if (!token && userData.email && userData.password) {
      try {
        const loginRes = await authApi.login({
          email: userData.email,
          password: userData.password,
        });
        token = loginRes.access_token || loginRes.token;
        user = loginRes.user || user;
      } catch (_e) {
        // Fallback
      }
    } else if (token && user) {
      await saveSession(token, user);
    }

    return { ...res, access_token: token, user };
  },
  verifyGoogleToken: (idToken) => request('/api/auth/google', { method: 'POST', body: JSON.stringify({ idToken }) }),
  logout: () => clearSession(),
};

// --- Services Endpoints ---
export const servicesApi = {
  getAllServices: () => request('/api/services'),
  getServiceById: (id) => request(`/api/services/${id}`),
};

// --- Location & Nearby Workers ---
export const locationApi = {
  getNearbyWorkers: (latitude, longitude, radiusKm = 15, skill = '') => {
    const params = new URLSearchParams({
      lat: String(latitude),
      lng: String(longitude),
      radius: String(radiusKm),
    });
    if (skill) params.append('skill', skill);
    return request(`/api/workers/nearby?${params.toString()}`);
  },
  updateLocation: (latitude, longitude) =>
    request('/api/location/update', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude }),
    }),
  getMyLocation: () => request('/api/location/my-location'),
};

// --- Workers Endpoints ---
export const workersApi = {
  registerProfile: (data) => request('/api/workers/register-profile', { method: 'POST', body: JSON.stringify(data) }),
  updateProfile: (data) => request('/api/workers/update-profile', { method: 'PUT', body: JSON.stringify(data) }),
  getWorkerMe: () => request('/api/workers/me'),
  uploadKYC: async (aadhaarFile, certificateFile, profileImageFile) => {
    const formData = new FormData();

    if (aadhaarFile) {
      formData.append('aadhaar', {
        uri: aadhaarFile.uri,
        name: aadhaarFile.name || 'aadhaar.jpg',
        type: aadhaarFile.mimeType || aadhaarFile.type || 'image/jpeg',
      });
    }

    if (certificateFile) {
      formData.append('certificate', {
        uri: certificateFile.uri,
        name: certificateFile.name || 'certificate.jpg',
        type: certificateFile.mimeType || certificateFile.type || 'image/jpeg',
      });
    }

    if (profileImageFile) {
      formData.append('profileImage', {
        uri: profileImageFile.uri,
        name: profileImageFile.name || 'profile.jpg',
        type: profileImageFile.mimeType || profileImageFile.type || 'image/jpeg',
      });
    }

    return request('/api/workers/upload-kyc', {
      method: 'POST',
      body: formData,
    });
  },
};

// --- Admin Endpoints ---
export const adminApi = {
  getDashboard: () => request('/api/admin/dashboard'),
  getAllWorkers: () => request('/api/admin/workers'),
  getPendingWorkers: () => request('/api/admin/workers/pending'),
  verifyWorker: (workerId, status = 'VERIFIED') =>
    request(`/api/admin/workers/${workerId}/verify`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
  rejectWorker: (workerId, rejection_reason) =>
    request(`/api/admin/workers/${workerId}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ rejection_reason }),
    }),
};

// --- Bookings Endpoints ---
export const bookingsApi = {
  createBooking: (bookingData) => request('/api/bookings', { method: 'POST', body: JSON.stringify(bookingData) }),
  getUserBookings: () => request('/api/bookings/user'),
  getWorkerBookings: () => request('/api/bookings/worker'),
  updateBookingStatus: (bookingId, status) =>
    request(`/api/bookings/${bookingId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};

// Legacy exports for backwards compatibility
export const getNearbyServices = (lat, lng, skill) => locationApi.getNearbyWorkers(lat, lng, 15, skill);
export const verifyGoogleToken = (token) => authApi.verifyGoogleToken(token);


