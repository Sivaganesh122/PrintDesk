import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiService } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore student session from token
  useEffect(() => {
    const token = localStorage.getItem('studentToken');
    if (token) {
      apiService.getStudentProfile()
        .then(res => {
          if (res.data?.success && res.data?.user) {
            setUser(res.data.user);
          } else {
            localStorage.removeItem('studentToken');
            setUser(null);
          }
          setLoading(false);
        })
        .catch(() => {
          localStorage.removeItem('studentToken');
          setUser(null);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (registration_number, password) => {
    try {
      const res = await apiService.studentLogin({
        registration_number: registration_number.trim(),
        password
      });

      if (res.data?.success && res.data?.token) {
        localStorage.setItem('studentToken', res.data.token);
        setUser(res.data.user);
        return { success: true, user: res.data.user };
      }
      return { success: false, error: res.data?.error || 'Login failed' };
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message || 'Login failed';
      return { success: false, error: errorMsg };
    }
  };

  const register = async (data) => {
    try {
      const res = await apiService.studentRegister(data);
      if (res.data?.success && res.data?.token) {
        localStorage.setItem('studentToken', res.data.token);
        setUser(res.data.user);
        return { success: true, user: res.data.user };
      }
      return { success: false, error: res.data?.error || 'Registration failed' };
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message || 'Registration failed';
      return { success: false, error: errorMsg };
    }
  };

  const logout = () => {
    localStorage.removeItem('studentToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      register,
      logout,
      loading,
      isAuthenticated: Boolean(user)
    }}>
      {children}
    </AuthContext.Provider>
  );
}; 