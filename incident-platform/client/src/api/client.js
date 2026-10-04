import axios from "axios";

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    let message = err.response && err.response.data && err.response.data.message;

    // Errors from blob downloads arrive as a Blob; read the JSON message out of it
    if (err.response && err.response.data instanceof Blob) {
      try {
        message = JSON.parse(await err.response.data.text()).message;
      } catch (e) {
        /* ignore */
      }
    }

    const isLogin = err.config && err.config.url && err.config.url.includes("/auth/login");
    if (err.response && err.response.status === 401 && !isLogin) {
      window.dispatchEvent(new Event("auth:expired"));
    }

    err.message = message || (err.request && !err.response ? "Cannot reach the server. Is the backend running?" : err.message);
    return Promise.reject(err);
  }
);

export const errMsg = (e) => (e && e.message) || "Something went wrong";
export default api;
