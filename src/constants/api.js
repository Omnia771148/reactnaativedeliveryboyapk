export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://deliveryboy-backend-production.up.railway.app';

console.log(`[API Config] Connecting to backend at: ${API_URL}`);

export const fetchWithTimeout = async (url, options = {}, timeout = 30000) => {
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


