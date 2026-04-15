import { createContext, useContext, useEffect, useState } from "react";
import apiClient from "../api/client";

const AuthContext = createContext(undefined);

const STORAGE_KEY = "carbon-market-user";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
  let isMounted = true;

  const bootstrapAuth = async () => {
    // 1) Try to restore from localStorage for fast client-side hydration
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (isMounted) {
      setUser(parsed);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    }

    // 2) Ask the backend who is logged in based on the httpOnly JWT cookie
    try {
    const response = await apiClient.get("/auth/me");
    if (response.data?.user && isMounted) {
      setUser(response.data.user);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(response.data.user));
    }
    } catch (error) {
    // If the session is no longer valid, clear any stale client-side data
    if (error?.response?.status === 401) {
      localStorage.removeItem(STORAGE_KEY);
      if (isMounted) {
      setUser(null);
      }
    }
    } finally {
    if (isMounted) {
      setIsHydrated(true);
    }
    }
  };

  bootstrapAuth();

  return () => {
    isMounted = false;
  };
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  const login = async (credentials) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post("/auth/login", credentials);
      if (response.data?.user) {
        setUser(response.data.user);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(response.data.user));
      }
      return response.data;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post("/auth/register", payload);
      if (response.data?.user) {
        setUser(response.data.user);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(response.data.user));
      }
      return response.data;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // ignore network/backend errors for client-side logout
    }
    setUser(null);
  };

  const updateUser = (updates) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  const value = {
    user,
    isLoading,
    isHydrated,
    isAuthenticated: Boolean(user),
    updateUser,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};
