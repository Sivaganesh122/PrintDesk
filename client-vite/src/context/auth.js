// src/services/auth.js
import api from '../services/api';

export const facultyLogin = async (department_name, password) => {
  try {
    const { data } = await api.post('/faculty-login', { department_name, password });

    if (data.success && data.token) {
      localStorage.setItem('faculty_token', data.token);
      localStorage.setItem('faculty_department', data.faculty.department_name);
      return { success: true, data };
    }
    return { success: false, error: data.message || 'Login failed' };
  } catch (err) {
    return { success: false, error: err.response?.data?.message || err.message };
  }
};

export const facultyLogout = () => {
  localStorage.removeItem('faculty_token');
  localStorage.removeItem('faculty_department');
};
