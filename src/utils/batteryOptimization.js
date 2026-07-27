import { NativeModules, Platform } from 'react-native';

const { BatteryOptimizationModule } = NativeModules;

/**
 * Checks if battery optimization is enabled (background tasks restricted).
 * On Android, if battery optimization is enabled, returns true.
 * Returns false on iOS or if the check fails.
 */
export async function isBatteryOptimizationEnabled() {
  if (Platform.OS !== 'android') return false;
  
  try {
    if (!BatteryOptimizationModule) {
      console.warn("BatteryOptimizationModule is not registered natively.");
      return false;
    }
    return await BatteryOptimizationModule.isBatteryOptimizationEnabled();
  } catch (error) {
    console.error("Error checking battery optimization status:", error);
    return false;
  }
}

/**
 * Requests the OS to ignore battery optimizations for the app (whitelists the app as "No restrictions").
 * Handles direct prompt as well as fallback to App Details settings for devices (Xiaomi, Oppo, Vivo, Samsung).
 */
export function requestIgnoreBatteryOptimization() {
  if (Platform.OS !== 'android') return;

  try {
    if (!BatteryOptimizationModule) {
      console.warn("BatteryOptimizationModule is not registered natively.");
      return;
    }
    BatteryOptimizationModule.requestIgnoreBatteryOptimization();
  } catch (error) {
    console.error("Error requesting battery optimization ignore:", error);
  }
}

/**
 * Opens App Info / Details settings directly for custom OEM ROMs (Xiaomi, Oppo, Vivo, Samsung, OnePlus)
 * where direct OS dialogs are intercepted by manufacturer settings.
 */
export function openAppDetailsSettings() {
  if (Platform.OS !== 'android') return;

  try {
    if (!BatteryOptimizationModule) {
      console.warn("BatteryOptimizationModule is not registered natively.");
      return;
    }
    BatteryOptimizationModule.openAppDetailsSettings();
  } catch (error) {
    console.error("Error opening App Details settings:", error);
  }
}
