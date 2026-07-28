import { Platform, PermissionsAndroid, Linking } from 'react-native';
import { API_URL } from '@/constants/api';
import Constants, { ExecutionEnvironment } from 'expo-constants';

export function openNotificationSettings() {
  if (Platform.OS === 'web') return;
  try {
    Linking.openSettings();
  } catch (err) {
    console.error('Error opening settings:', err);
  }
}

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
        if (status !== PermissionsAndroid.RESULTS.GRANTED) {
          console.warn('POST_NOTIFICATIONS permission denied on Android 13+');
        }
      }
    }

    // 2. Request FCM Permission
    const authStatus = await messagingModule().requestPermission();
    const enabled =
      authStatus === messagingModule.AuthorizationStatus.AUTHORIZED ||
      authStatus === messagingModule.AuthorizationStatus.PROVISIONAL;
    return enabled;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return true; // Fallback return true so token fetch is attempted on Android
  }
}

export async function registerForFCMAsync() {
  if (Platform.OS === 'web') return null;

  const messagingModule = getMessaging();
  if (!messagingModule) return null;

  try {
    await requestNotificationPermission();

    // Register device for remote messages on iOS
    if (Platform.OS === 'ios') {
      await messagingModule().registerDeviceForRemoteMessages();
    }

    // Fetch FCM Token with up to 3 retry attempts for maximum reliability
    let token = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        token = await messagingModule().getToken();
        if (token) {
          console.log(`Retrieved FCM Token successfully (attempt ${attempt}):`, token);
          break;
        }
      } catch (err) {
        console.warn(`FCM getToken attempt ${attempt} failed:`, err.message || err);
        if (attempt < 3) {
          await new Promise((res) => setTimeout(res, 1000));
        }
      }
    }

    return token;
  } catch (error) {
    console.error('Error in registerForFCMAsync:', error);
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
      console.log('FCM token successfully registered on backend for user:', userId);
    }
  } catch (error) {
    console.error('Error saving FCM token to backend:', error);
  }
}
