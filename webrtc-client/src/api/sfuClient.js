import axios from 'axios';

const sfuBaseURL = import.meta.env.VITE_SFU_URL
  ? `${import.meta.env.VITE_SFU_URL}/api`
  : 'http://localhost:8181/api';

const SFU = axios.create({
  baseURL: sfuBaseURL,
  // withCredentials, interceptors, etc. – same pattern as your chat client
});

// attach token if needed
SFU.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default SFU;