import { Platform, PermissionsAndroid, Linking } from 'react-native';
import { API_URL } from '@/constants/api';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';

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

  try {
    // 1. Expo Notifications Permission Request
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    // 2. Android 13+ POST_NOTIFICATIONS Permission Request
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const hasPermission = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      if (!hasPermission) {
        const reqStatus = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        if (reqStatus !== PermissionsAndroid.RESULTS.GRANTED) {
          console.warn('POST_NOTIFICATIONS permission not granted');
        }
      }
    }

    // 3. iOS FCM Permission Request
    const messagingModule = getMessaging();
    if (messagingModule && Platform.OS === 'ios') {
      try {
        const authStatus = await messagingModule().requestPermission();
        if (
          authStatus === messagingModule.AuthorizationStatus.AUTHORIZED ||
          authStatus === messagingModule.AuthorizationStatus.PROVISIONAL
        ) {
          finalStatus = 'granted';
        }
      } catch (iosErr) {
        console.warn('iOS Firebase messaging requestPermission warning:', iosErr);
      }
    }

    return finalStatus === 'granted';
  } catch (error) {
    console.warn('Error requesting notification permission (caught safely):', error);
    return true;
  }
}

export async function registerForFCMAsync(forceRefresh = false) {
  if (Platform.OS === 'web') return null;

  try {
    await requestNotificationPermission();

    let token = null;
    const messagingModule = getMessaging();

    // Strategy 1: Try React Native Firebase Messaging module
    if (messagingModule) {
      try {
        if (Platform.OS === 'ios') {
          await messagingModule().registerDeviceForRemoteMessages();
        }

        if (forceRefresh) {
          try {
            await messagingModule().deleteToken();
            console.log('Deleted existing FCM token for forced refresh');
          } catch (delErr) {
            console.warn('Could not delete FCM token during force refresh:', delErr.message || delErr);
          }
        }

        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            token = await messagingModule().getToken();
            if (token) {
              console.log(`Retrieved FCM Token successfully via Firebase Messaging (attempt ${attempt}):`, token);
              break;
            }
          } catch (err) {
            console.warn(`FCM getToken attempt ${attempt} failed:`, err.message || err);
            if (attempt < 3) {
              await new Promise((res) => setTimeout(res, 1000));
            }
          }
        }
      } catch (fbError) {
        console.warn('Firebase Messaging token fetch error, attempting fallback:', fbError.message || fbError);
      }
    }

    // Strategy 2: Fallback to Expo Notifications getDevicePushTokenAsync()
    if (!token) {
      try {
        const deviceTokenRes = await Notifications.getDevicePushTokenAsync();
        if (deviceTokenRes && deviceTokenRes.data) {
          token = deviceTokenRes.data;
          console.log('Retrieved FCM Token via Expo Notifications getDevicePushTokenAsync fallback:', token);
        }
      } catch (expoErr) {
        console.warn('Expo getDevicePushTokenAsync fallback failed:', expoErr.message || expoErr);
      }
    }

    if (!token) {
      console.error('Failed to retrieve any FCM push token from device');
    }

    return token;
  } catch (error) {
    console.error('Error in registerForFCMAsync:', error);
    return null;
  }
}

export async function saveFCMTokenToBackend(userId, token) {
  if (!userId || !token) {
    console.warn('saveFCMTokenToBackend skipped: missing userId or token', { userId, token: !!token });
    return false;
  }

  try {
    console.log(`Saving FCM token to backend for user ${userId}...`);
    const response = await fetch(`${API_URL}/api/users/${userId}/push-token`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pushToken: token }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`Failed to save FCM token on backend: HTTP ${response.status}`, errText);
      return false;
    } else {
      console.log('FCM token successfully registered on backend for user:', userId);
      return true;
    }
  } catch (error) {
    console.error('Error saving FCM token to backend:', error);
    return false;
  }
}

export async function ensureFCMTokenRegistered(userId, forceRefresh = false) {
  if (!userId) return null;
  try {
    const token = await registerForFCMAsync(forceRefresh);
    if (token) {
      const success = await saveFCMTokenToBackend(userId, token);
      if (!success) {
        console.warn('FCM token backend save failed on first attempt, retrying once in 1.5s...');
        await new Promise((res) => setTimeout(res, 1500));
        await saveFCMTokenToBackend(userId, token);
      }
    } else {
      console.warn('ensureFCMTokenRegistered: Could not retrieve valid FCM token');
    }
    return token;
  } catch (err) {
    console.error('Error ensuring FCM token registered:', err);
    return null;
  }
}


