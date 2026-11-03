import axios from 'axios';

const rawBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
const baseURL = rawBaseUrl.endsWith('/api') ? rawBaseUrl : `${rawBaseUrl.replace(/\/+$/, '')}/api`;

// Create axios instance with default configuration
const api = axios.create({
  baseURL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

const isAdminRequest = (config) => /^\/?(admin|payment|reports)\/|^\/?auth\/validate/.test(config.url || '');

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    if (config.headers?.Authorization) {
      return config;
    }
    const token = isAdminRequest(config)
      ? localStorage.getItem('adminToken')
      : localStorage.getItem('studentToken') || localStorage.getItem('faculty_token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // An expired admin session goes back to the admin login. Any other 401 (such as a
    // wrong student password) is left for the page that made the request to show.
    if (error.response?.status === 401 && error.config && isAdminRequest(error.config)
      && localStorage.getItem('adminToken')) {
      localStorage.removeItem('adminToken');
      if (window.location.pathname.startsWith('/admin')) {
        window.location.href = '/admin-login';
      }
    }
    return Promise.reject(error);
  }
);

// API endpoints
export const endpoints = {
  // Auth
  login: '/auth/login',
  validateToken: '/auth/validate',
  studentRegister: '/auth/student-register',
  studentLogin: '/auth/student-login',
  studentMe: '/auth/student-me',
  
  // Print Job
  createPrintJob: '/print-job/create',
  deleteOrder: '/print-job/order',

  // Tracking
  myOrders: '/tracking/mine',
};

// API service functions
export const apiService = {
  // Auth
  login: (credentials) => api.post(endpoints.login, credentials),
  validateToken: () => api.get(endpoints.validateToken),
  studentRegister: (data) => api.post(endpoints.studentRegister, data),
  studentLogin: (credentials) => api.post(endpoints.studentLogin, credentials),
  getStudentProfile: () => api.get(endpoints.studentMe),
  
  // Print Job
  createPrintJob: (formData, authToken) => api.post(endpoints.createPrintJob, formData, {
    headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${authToken}` },
    timeout: 5 * 60 * 1000 // Several large documents can take longer than the default timeout
  }),
  deleteOrder: async (orderNumber, authToken) => {
    try {
      const response = await api.delete(`${endpoints.deleteOrder}/${orderNumber}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      return response.data;
    } catch (error) {
      console.error('Delete order error:', error);
      if (error.response?.status === 404) {
        throw new Error('Order not found or already cancelled');
      } else if (error.response?.status === 400) {
        throw new Error(error.response.data?.error || 'This order can no longer be cancelled');
      } else {
        throw new Error('Failed to cancel order. Please try again.');
      }
    }
  },

  // Tracking
  getMyOrders: () => api.get(endpoints.myOrders),

  // Admin
  get: (endpoint, config = {}) => api.get(endpoint, config),
  post: (endpoint, data, config = {}) => api.post(endpoint, data, config),
  patch: (endpoint, data, config = {}) => api.patch(endpoint, data, config),
  put: (endpoint, data, config = {}) => api.put(endpoint, data, config),
  delete: (endpoint, config = {}) => api.delete(endpoint, config),
};

export default api;
