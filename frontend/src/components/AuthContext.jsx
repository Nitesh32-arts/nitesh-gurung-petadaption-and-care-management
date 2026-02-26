/* eslint-disable react-refresh/only-export-components */
import { createContext, useEffect, useState } from "react";
import { fetchCurrentUser, loginUser, registerUser } from "../authService";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [accessToken, setAccessToken] = useState(
    typeof window !== "undefined" ? localStorage.getItem("accessToken") : null
  );
  const [refreshToken, setRefreshToken] = useState(
    typeof window !== "undefined" ? localStorage.getItem("refreshToken") : null
  );
  const [user, setUser] = useState(() => {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (!accessToken) return;
      try {
        const profile = await fetchCurrentUser();
        setUser(profile);
        localStorage.setItem("user", JSON.stringify(profile));
      } catch {
        logout();
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveAuth = (userData, tokens) => {
    setUser(userData);
    
    // Ensure tokens are strings and clean them
    const accessToken = typeof tokens.access === 'string' 
      ? tokens.access.trim() 
      : String(tokens.access).trim();
    const refreshToken = typeof tokens.refresh === 'string'
      ? tokens.refresh.trim()
      : String(tokens.refresh).trim();
    
    setAccessToken(accessToken);
    setRefreshToken(refreshToken);
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
  };

  const logout = () => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    localStorage.removeItem("user");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  };

  const login = async ({ emailOrUsername, password }) => {
    setLoading(true);
    try {
      const data = await loginUser({ emailOrUsername, password });
      saveAuth(data.user, data.tokens);
      return data.user;
    } finally {
      setLoading(false);
    }
  };

  const register = async (form, selectedRole) => {
    setLoading(true);
    try {
      const data = await registerUser(form, selectedRole);
      saveAuth(data.user, data.tokens);
      return data.user;
    } finally {
      setLoading(false);
    }
  };

  /** Update the current user in context and localStorage (e.g. after profile edit). */
  const updateUser = (updatedUser) => {
    if (!updatedUser) return;
    setUser(updatedUser);
    localStorage.setItem("user", JSON.stringify(updatedUser));
  };

  const value = {
    user,
    accessToken,
    refreshToken,
    loading,
    login,
    register,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

