import { NativeModules, Platform, PermissionsAndroid } from 'react-native';

const { ForegroundServiceModule } = NativeModules;

export async function startDeliveryForegroundService(
  title = "🟢 Delivery Boy — Online",
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

    if (ForegroundServiceModule) {
      await ForegroundServiceModule.startService(title, body);
      console.log('Foreground Service started successfully.');
    }
  } catch (error) {
    console.error('Failed to start Foreground Service:', error);
  }
}

export async function stopDeliveryForegroundService() {
  if (Platform.OS !== 'android') return;
  try {
    if (ForegroundServiceModule) {
      await ForegroundServiceModule.stopService();
      console.log('Foreground Service stopped.');
    }
  } catch (error) {
    console.error('Failed to stop Foreground Service:', error);
  }
}
