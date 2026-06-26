import Constants from 'expo-constants';

const getApiUrl = () => {
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

