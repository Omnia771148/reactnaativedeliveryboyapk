import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

if (!isExpoGo) {
  try {
    require('@react-native-firebase/app');
    const messaging = require('@react-native-firebase/messaging').default;
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('Message handled in the background!', remoteMessage);
    });
  } catch (error) {
    console.warn('Firebase Messaging background handler error:', error);
  }
} else {
  console.log('Running in Expo Go - skipping Firebase native modules.');
}

import 'expo-router/entry';
