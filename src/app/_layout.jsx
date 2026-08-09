import { Slot } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Font from 'expo-font';
import { useEffect, useState } from 'react';

import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function RootLayout() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync({
          'CursiveScript': require('../../assets/fonts/GreatVibes-Regular.ttf'),
        });
        setFontsLoaded(true);
      } catch (e) {
        console.warn('Failed to load fonts:', e);
        setFontsLoaded(true); // Proceed with system fallbacks if it fails
      }
    }
    loadFonts();
  }, []);

  if (!fontsLoaded) {
    return null; // Render nothing (or a splash screen) until fonts are ready
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider style={styles.container}>
        <Slot />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6', // Default cream background color for all pages
  },
});
