import axios from 'axios';

/**
 * Centralized Axios client configured to use relative /api endpoints
 * proxied through Vite to http://localhost:5000.
 */
const apiClient = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor normalizing backend error payloads
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const backendError = error.response?.data?.error;
    const normalizedError = {
      status: error.response?.status || 500,
      message:
        backendError?.message ||
        error.message ||
        'An unexpected network error occurred.',
      details: backendError?.details || null,
    };
    return Promise.reject(normalizedError);
  }
);

// Exported API helper methods for all backend endpoints
export const healthApi = {
  check: () => apiClient.get('/health'),
};

export const patientsApi = {
  list: (params) => apiClient.get('/patients', { params }),
  getById: (id) => apiClient.get(`/patients/${id}`),
  create: (data) => apiClient.post('/patients', data),
  update: (id, data) => apiClient.put(`/patients/${id}`, data),
  remove: (id) => apiClient.delete(`/patients/${id}`),
};

export const symptomsApi = {
  check: (data) => apiClient.post('/symptoms/check', data),
  history: (params) => apiClient.get('/symptoms/history', { params }),
};

export const dashboardApi = {
  stats: () => apiClient.get('/dashboard/stats'),
  recent: (params) => apiClient.get('/dashboard/recent', { params }),
};

export const notesApi = {
  list: (params) => apiClient.get('/notes', { params }),
  create: (data) => apiClient.post('/notes', data),
};

export default apiClient;
