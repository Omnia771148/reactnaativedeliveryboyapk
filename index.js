import '@expo/metro-runtime';
import messaging from '@react-native-firebase/messaging';
import { App } from 'expo-router/build/qualified-entry';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';

// Register background handler for FCM
// This handler receives a message when the app is in the background or quit state.
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('Message handled in the background!', remoteMessage);
});

// Render the root component
renderRootComponent(App);
