import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="contact" />
      <Stack.Screen name="orders" />
      <Stack.Screen name="reviews" />
    </Stack>
  );
}