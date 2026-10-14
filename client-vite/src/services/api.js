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

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('adminToken');
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
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem('adminToken');
      window.location.href = '/admin';
    }
    return Promise.reject(error);
  }
);

// API endpoints
export const endpoints = {
  // Auth
  login: '/auth/login',
  validateToken: '/auth/validate',
  
  // Print Job
  createPrintJob: '/print-job',
  uploadFile: '/print-job/upload',
  deleteOrder: '/print-job',
  getPreview: '/print-job/preview',
  
  // Payment
  processPayment: '/payment/process',
  verifyPayment: '/payment/verify',
  
  // Tracking
  trackOrder: '/tracking',
  
  // Admin
  dashboard: '/admin/dashboard',
  printJobs: '/admin/print-jobs',
  updateJobStatus: '/admin/print-jobs',
  payments: '/admin/payments',
  
  // Reports
  generateReport: '/reports/generate',
  downloadReport: '/reports/download',
};

// API service functions
export const apiService = {
  // Auth
  login: (credentials) => api.post(endpoints.login, credentials),
  validateToken: () => api.get(endpoints.validateToken),
  
  // Print Job
  createPrintJob: (jobData) => api.post(endpoints.createPrintJob, jobData),
  uploadFile: (formData) => api.post(endpoints.uploadFile, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deleteOrder: async (token) => {
    try {
      const response = await api.delete(`${endpoints.deleteOrder}/${token}`);
      return response.data;
    } catch (error) {
      console.error('Delete order error:', error);
      if (error.response?.status === 404) {
        throw new Error('Order not found or already cancelled');
      } else if (error.response?.status === 400) {
        throw new Error('Order cannot be cancelled after 30 seconds');
      } else {
        throw new Error('Failed to cancel order. Please try again.');
      }
    }
  },
  getPreview: (token) => api.get(`${endpoints.getPreview}/${token}`),
  
  // Payment
  processPayment: (paymentData) => api.post(endpoints.processPayment, paymentData),
  verifyPayment: (paymentId) => api.get(`${endpoints.verifyPayment}/${paymentId}`),
  
  // Tracking
  trackOrder: (token) => api.get(`${endpoints.trackOrder}/${token}`),
  
  // Admin
  get: (endpoint, config = {}) => api.get(endpoint, config),
  post: (endpoint, data, config = {}) => api.post(endpoint, data, config),
  patch: (endpoint, data, config = {}) => api.patch(endpoint, data, config),
  put: (endpoint, data, config = {}) => api.put(endpoint, data, config),
  delete: (endpoint, config = {}) => api.delete(endpoint, config),
  
  // Reports
  generateReport: (params = {}) => api.get(endpoints.generateReport, { params }),
  downloadReport: (reportId) => api.get(`${endpoints.downloadReport}/${reportId}`, {
    responseType: 'blob'
  }),
};

// File upload helper
export const uploadFile = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);
  
  return api.post(endpoints.uploadFile, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (progressEvent) => {
      if (onProgress) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress(percentCompleted);
      }
    },
  });
};

// Payment processing helper
export const processPayment = async (paymentData) => {
  try {
    const response = await api.post(endpoints.processPayment, paymentData);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Payment processing failed');
  }
};

// Order tracking helper
export const trackOrder = async (token) => {
  try {
    const response = await api.get(`${endpoints.trackOrder}/${token}`);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Order not found');
  }
};

// Admin helpers
export const adminService = {
  getOrders: async (filters = {}) => {
    try {
      const response = await api.get(endpoints.getOrders, { params: filters });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to fetch orders');
    }
  },
  
  updateOrderStatus: async (orderId, status) => {
    try {
      const response = await api.put(`${endpoints.updateOrderStatus}/${orderId}`, { status });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to update order status');
    }
  },
  
  getOrderDetails: async (orderId) => {
    try {
      const response = await api.get(`${endpoints.getOrderDetails}/${orderId}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to fetch order details');
    }
  },
};

export default api; 