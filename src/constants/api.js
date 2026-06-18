import Constants from 'expo-constants';

const getApiUrl = () => {
  // Use the Render backend url provided by the user
  return 'https://deliveryboybackend-shbd.onrender.com';
  
  // Local fallback (commented out in case local debugging is needed in the future)
  /*
  const debuggerHost = Constants.expoConfig?.hostUri;
  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0];
    return `http://${ip}:5000`;
  }
  return 'http://localhost:5000';
  */
};

export const API_URL = getApiUrl();
