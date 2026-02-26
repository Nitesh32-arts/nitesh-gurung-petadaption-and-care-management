import axios from "axios";

const apiClient = axios.create({
  baseURL: "/api/", // Relative URL - Vite proxy will forward to Django
});

// Request interceptor - clean and attach token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    // Clean token (remove any whitespace or quotes)
    const cleanToken = token.trim().replace(/^["']|["']$/g, "");
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${cleanToken}`;
  }
  return config;
});

// Response interceptor - handle 401 and refresh token
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retrying, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem("refreshToken");
        if (!refreshToken) {
          // No refresh token, logout user
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          localStorage.removeItem("user");
          window.location.href = "/login";
          return Promise.reject(error);
        }

        // Try to refresh the access token
        const response = await axios.post("/api/auth/token/refresh/", {
          refresh: refreshToken.trim().replace(/^["']|["']$/g, ""),
        });

        const { access } = response.data;
        localStorage.setItem("accessToken", access);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${access}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed, logout user
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;


