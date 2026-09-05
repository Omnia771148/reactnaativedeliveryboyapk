import { NativeModules, Platform, PermissionsAndroid } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const { ForegroundServiceModule } = NativeModules;
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

function getExpoNotifications() {
  if (isExpoGo && Platform.OS === 'android') return null;
  try {
    return require('expo-notifications');
  } catch (e) {
    return null;
  }
}

export async function startDeliveryForegroundService(
  title = "🟢 Delivery Boy — ON",
  body = "Searching for nearby orders..."
) {
  if (Platform.OS !== 'android') return;
  try {
    // On Android 13+ (API 33+), ensure POST_NOTIFICATIONS is granted
    if (Platform.Version >= 33) {
      const hasPermission = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      if (!hasPermission) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          console.log('Skipping foreground service: notification permission not granted.');
          return;
        }
      }
    }

    // 1. Try native Foreground Service Module (Android Kotlin Service)
    if (ForegroundServiceModule) {
      try {
        await ForegroundServiceModule.startService(title, body);
        console.log('Foreground Service started successfully via native module.');
        return; // Native service handles the sticky notification cleanly!
      } catch (nativeErr) {
        console.warn('Native ForegroundServiceModule error, using fallback:', nativeErr);
      }
    }

    // 2. Fallback to Expo Notifications ONLY if Native Module is not available
    const Notifications = getExpoNotifications();
    if (Notifications) {
      try {
        await Notifications.setNotificationChannelAsync('delivery_online_status_channel', {
          name: 'Delivery Online Status',
          description: 'Shows status bar indicator when delivery boy is searching for orders',
          importance: Notifications.AndroidImportance.HIGH,
          sound: null,
          vibrationPattern: null,
          showBadge: false,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });

        await Notifications.scheduleNotificationAsync({
          identifier: 'delivery-online-status-notification',
          content: {
            title: title,
            body: body,
            sticky: true,
            autoDismiss: false,
            color: '#00C853',
            priority: Notifications.AndroidNotificationPriority.HIGH,
            sound: false,
            channelId: 'delivery_online_status_channel',
          },
          trigger: null,
        });
        console.log('Fallback sticky online notification scheduled via expo-notifications.');
      } catch (notifErr) {
        console.warn('Expo notifications sticky status warning:', notifErr);
      }
    }
  } catch (error) {
    console.error('Failed to start Foreground Service:', error);
  }
}

export async function stopDeliveryForegroundService() {
  if (Platform.OS !== 'android') return;
  try {
    // 1. Stop native Foreground Service Module
    if (ForegroundServiceModule) {
      try {
        await ForegroundServiceModule.stopService();
        console.log('Foreground Service stopped via native module.');
      } catch (nativeErr) {
        console.warn('Native stopService warning:', nativeErr);
      }
    }

    // 2. Dismiss fallback Expo notification
    const Notifications = getExpoNotifications();
    if (Notifications) {
      try {
        await Notifications.dismissNotificationAsync('delivery-online-status-notification');
        console.log('Fallback online notification dismissed.');
      } catch (notifErr) {
        console.warn('Expo notification dismiss warning:', notifErr);
      }
    }
  } catch (error) {
    console.error('Failed to stop Foreground Service:', error);
  }
}
