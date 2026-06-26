import '@expo/metro-runtime';
import { App } from 'expo-router/build/qualified-entry';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

if (!isExpoGo) {
  try {
    const messaging = require('@react-native-firebase/messaging').default;
    // Register background handler for FCM
    // This handler receives a message when the app is in the background or quit state.
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('Message handled in the background!', remoteMessage);
    });
  } catch (error) {
    console.warn('Firebase Messaging native module is not available.');
  }
} else {
  console.log('Running in Expo Go - skipping Firebase Messaging background handler.');
}

// Render the root component
renderRootComponent(App);
