import axios from 'axios';

const apiClient = axios.create({
  // Use empty baseURL so all /api/* requests are relative to the current host.
  // Vite's dev server proxy (vite.config.ts) will forward them to the backend
  // on port 4000. This ensures network clients (other devices/phones) work
  // without needing to know the server's local IP address.
  baseURL: '',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      const path = window.location.pathname || '';
      if (path !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
