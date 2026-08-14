import { NativeModules, Platform } from 'react-native';

const { SoundModule } = NativeModules;

export async function playOrderSound() {
  if (Platform.OS !== 'android') return;
  try {
    if (SoundModule) {
      await SoundModule.playSound();
      console.log('Native Android SoundModule: Playing ordernotification.wav loop.');
    }
  } catch (error) {
    console.error('Failed to play native order sound:', error);
  }
}

export async function stopOrderSoundNative() {
  if (Platform.OS !== 'android') return;
  try {
    if (SoundModule) {
      await SoundModule.stopSound();
      console.log('Native Android SoundModule: Sound stopped.');
    }
  } catch (error) {
    console.error('Failed to stop native order sound:', error);
  }
}
