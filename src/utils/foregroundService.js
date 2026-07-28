import { NativeModules, Platform } from 'react-native';

const { ForegroundServiceModule } = NativeModules;

export async function startDeliveryForegroundService(
  title = "🟢 Delivery Boy — Online",
  body = "Searching for nearby orders..."
) {
  if (Platform.OS !== 'android') return;
  try {
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
