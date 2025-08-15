import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiService } from '../services/api';

const AdminAuthContext = createContext();

export const useAdminAuth = () => useContext(AdminAuthContext);

export const AdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      apiService.validateToken().then(res => {
        console.log('DEBUG /api/auth/validate response:', res.data);
        if (res.data && res.data.user) setAdmin(res.data.user);
        else localStorage.removeItem('adminToken');
        setLoading(false);
      }).catch(() => {
        localStorage.removeItem('adminToken');
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const res = await apiService.login({ username, password });
    const { token, admin } = res.data.data || {};
    if (token && admin) {
      localStorage.setItem('adminToken', token);
      setAdmin(admin);
      return { success: true };
    }
    return { success: false, error: 'Login failed' };
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    setAdmin(null);
  };

  return (
    <AdminAuthContext.Provider value={{ admin, login, logout, loading }}>
      {children}
    </AdminAuthContext.Provider>
  );
}; 