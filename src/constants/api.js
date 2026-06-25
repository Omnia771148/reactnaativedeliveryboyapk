import Constants from 'expo-constants';

const getApiUrl = () => {
  if (__DEV__) {
    // Local fallback to connect to your local machine running the backend index.js during development
    const debuggerHost = Constants.expoConfig?.hostUri;
    if (debuggerHost) {
      const ip = debuggerHost.split(':')[0];
      return `http://${ip}:5000`;
    }
    return 'http://localhost:5000';
  }

  // Remote Render backend URL (used automatically in production APK builds)
  return 'https://deliveryboybackend-shbd.onrender.com';
};

export const API_URL = getApiUrl();

export const fetchWithTimeout = async (url, options = {}, timeout = 10000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

