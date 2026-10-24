import axios from 'axios';
import { auth } from '../config/firebase';

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

// Request interceptor: automatically attach Firebase ID token if a user is signed in
apiClient.interceptors.request.use(
  async (config) => {
    try {
      if (auth && auth.currentUser) {
        const token = await auth.currentUser.getIdToken();
        if (token) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    } catch (_err) {
      // Proceed without token if token fetch fails; backend will return 401 on protected routes
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor normalizing backend error payloads without infinite retry loops
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const backendError = error.response?.data?.error;
    const status = error.response?.status || 500;
    const normalizedError = {
      status,
      message:
        backendError?.message ||
        error.message ||
        'An unexpected network error occurred.',
      details: backendError?.details || null,
    };
    return Promise.reject(normalizedError);
  }
);

export const healthApi = {
  check: () => apiClient.get('/health'),
};

export const authApi = {
  me: () => apiClient.get('/auth/me'),
  updateProfile: (data) => apiClient.put('/auth/profile', data),
  listDoctors: () => apiClient.get('/auth/doctors'),
  devApproveDoctor: (data) => apiClient.post('/auth/dev-approve-doctor', data),
};

export const patientsApi = {
  list: (params) => apiClient.get('/patients', { params }),
  getMyProfile: () => apiClient.get('/patients/me'),
  saveMyProfile: (data) => apiClient.put('/patients/me', data),
  getById: (id) => apiClient.get(`/patients/${id}`),
  create: (data) => apiClient.post('/patients', data),
  update: (id, data) => apiClient.put(`/patients/${id}`, data),
  remove: (id) => apiClient.delete(`/patients/${id}`),
  assignDoctor: (id, doctor_user_id) =>
    apiClient.post(`/patients/${id}/assign-doctor`, { doctor_user_id }),
  revokeDoctor: (id, doctor_user_id) =>
    apiClient.delete(`/patients/${id}/assign-doctor/${doctor_user_id}`),
};

export const symptomsApi = {
  engineStatus: () => apiClient.get('/symptoms/engine-status'),
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
