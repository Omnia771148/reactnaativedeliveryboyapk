import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Local backend port configuration (e.g. 5000, 5001, 8000, 3000)
// Matches your local backend running on port 5000
const LOCAL_PORT = process.env.EXPO_PUBLIC_API_PORT || 5000;

const LIVE_RAILWAY_URL = 'https://deliveryboy-backend-production.up.railway.app';

const getLocalHost = () => {
  // 1. Try to get Expo dev server host IP (for physical devices running via Expo Go)
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoGo?.developer?.manifestHost ||
    Constants.manifest?.debuggerHost;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') return ip;
  }
  // 2. Android Emulator fallback
  if (Platform.OS === 'android') {
    return '10.0.2.2';
  }
  // 3. Web & iOS Simulator fallback
  return 'localhost';
};

const getApiUrl = () => {
  // Explicit env override if specified
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // Connect to local backend by default
  const host = getLocalHost();
  return `http://${host}:${LOCAL_PORT}`;
};

export const API_URL = getApiUrl();

console.log(`[API Config] Connecting to local backend at: ${API_URL}`);

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


