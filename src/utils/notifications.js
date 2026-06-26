import { Platform, PermissionsAndroid } from 'react-native';
import { API_URL } from '@/constants/api';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

function getMessaging() {
  if (isExpoGo) return null;
  try {
    return require('@react-native-firebase/messaging').default;
  } catch (error) {
    console.warn('Firebase Messaging native module not found');
    return null;
  }
}

export async function requestNotificationPermission() {
  if (Platform.OS === 'web') return false;

  const messagingModule = getMessaging();
  if (!messagingModule) {
    console.log('Skipping notification permission - Firebase Messaging not available in Expo Go');
    return false;
  }

  try {
    // 1. Request Android 13+ Notification Permission if applicable
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const hasPermission = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      if (!hasPermission) {
        const status = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        return status === PermissionsAndroid.RESULTS.GRANTED;
      }
      return true;
    }

    // 2. Request FCM Permission (iOS/macOS and general FCM status registration)
    const authStatus = await messagingModule().requestPermission();
    const enabled =
      authStatus === messagingModule.AuthorizationStatus.AUTHORIZED ||
      authStatus === messagingModule.AuthorizationStatus.PROVISIONAL;
    return enabled;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
}

export async function registerForFCMAsync() {
  if (Platform.OS === 'web') return null;

  const messagingModule = getMessaging();
  if (!messagingModule) return null;

  try {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.log('Notification permission was denied');
      return null;
    }

    // Fetch FCM Token
    const token = await messagingModule().getToken();
    console.log('Retrieved FCM Token:', token);
    return token;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
}

export async function saveFCMTokenToBackend(userId, token) {
  if (!userId || !token) return;

  try {
    const response = await fetch(`${API_URL}/api/users/${userId}/push-token`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pushToken: token }),
    });

    if (!response.ok) {
      console.error('Failed to save FCM token on backend:', response.status);
    } else {
      console.log('FCM token successfully registered on backend');
    }
  } catch (error) {
    console.error('Error saving FCM token to backend:', error);
  }
}
