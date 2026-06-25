import { Ionicons } from '@expo/vector-icons';
import { Tabs, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View, DeviceEventEmitter } from 'react-native';

// Custom Tab Bar component with sliding circle transition
function CustomTabBar({ state, descriptors, navigation }) {
  const animatedIndex = useRef(new Animated.Value(state.index)).current;
  const [translateYAnim] = useState(() => new Animated.Value(0));

  // Animate the index change smoothly
  useEffect(() => {
    // Reset tab bar visibility to visible when switching tabs
    Animated.timing(translateYAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start();

    Animated.spring(animatedIndex, {
      toValue: state.index,
      useNativeDriver: true,
      tension: 68,
      friction: 12,
    }).start();
  }, [state.index]);

  // Listen to show/hide events from screens
  useEffect(() => {
    const hideSub = DeviceEventEmitter.addListener('hideTabBar', () => {
      Animated.timing(translateYAnim, {
        toValue: 120, // Slides off-screen downwards
        duration: 300,
        useNativeDriver: true,
      }).start();
    });

    const showSub = DeviceEventEmitter.addListener('showTabBar', () => {
      Animated.timing(translateYAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      hideSub.remove();
      showSub.remove();
    };
  }, []);

  const tabs = [
    { name: 'homepage/index', iconName: 'home' },
    { name: 'orders/index', iconName: 'notifications' },
    { name: 'liveorders/index', iconName: 'map' },
    { name: 'settings', iconName: 'settings' },
  ];

  // Calculate sliding translateX for active white circle (width of bar is 360)
  // Distance between each tab is 85 pixels (available width 340 / 4)
  const translateX = animatedIndex.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: [0, 85, 170, 255],
  });

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: translateYAnim }] }]}>
      <View style={styles.navBarWrapper}>
        {/* 1. Sand-Colored Background Bar with Shadow/Elevation */}
        <View style={styles.navBarBg} />

        {/* 2. Transparent Tab Items Container */}
        <View style={styles.tabItemsContainer}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            // Interpolate scaling, translation, and opacity of small circles dynamically
            const translateY = animatedIndex.interpolate({
              inputRange: index === 0 ? [0, 1] : index === 3 ? [2, 3] : [index - 1, index, index + 1],
              outputRange: index === 0 ? [-14, 0] : index === 3 ? [0, -14] : [0, -14, 0],
              extrapolate: 'clamp',
            });

            const scale = animatedIndex.interpolate({
              inputRange: index === 0 ? [0, 1] : index === 3 ? [2, 3] : [index - 1, index, index + 1],
              outputRange: index === 0 ? [1.2, 1.0] : index === 3 ? [1.0, 1.2] : [1.0, 1.2, 1.0],
              extrapolate: 'clamp',
            });

            const smallCircleOpacity = animatedIndex.interpolate({
              inputRange: index === 0 ? [0, 0.5] : index === 3 ? [2.5, 3] : [index - 0.5, index, index + 0.5],
              outputRange: index === 0 ? [0, 1] : index === 3 ? [1, 0] : [1, 0, 1],
              extrapolate: 'clamp',
            });

            const iconName = tabs[index]?.iconName || 'help-circle';

            return (
              <TouchableOpacity
                key={route.key}
                onPress={onPress}
                activeOpacity={0.8}
                style={styles.tabItem}
              >
                {/* Inactive Static Small Circle Background (Fades out when active circle approaches) */}
                {!isFocused && (
                  <Animated.View
                    style={[
                      styles.smallCircle,
                      { opacity: smallCircleOpacity }
                    ]}
                  />
                )}

                {/* Icon Container (Lifts and scales up when selected) */}
                <Animated.View style={{ transform: [{ translateY }, { scale }] }}>
                  <Ionicons
                    name={iconName}
                    size={22}
                    color="#000000"
                  />
                </Animated.View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 3. Sliding Active White Circle (rendered on top of background bar) */}
        <Animated.View
          style={[
            styles.activeCircle,
            { transform: [{ translateX }] }
          ]}
        />
      </View>
    </Animated.View>
  );
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import { Alert } from 'react-native';
import { registerForFCMAsync, saveFCMTokenToBackend } from '@/utils/notifications';

export default function Layout() {
  useEffect(() => {
    let isMounted = true;
    let unsubscribeMessage = null;
    let unsubscribeTokenRefresh = null;
    let unsubscribeNotificationOpened = null;

    const setupNotifications = async () => {
      try {
        const storedId = await AsyncStorage.getItem('userid');
        if (!storedId) return;

        // Register for push notifications and get FCM token
        const token = await registerForFCMAsync();
        if (token && isMounted) {
          await saveFCMTokenToBackend(storedId, token);
        }

        // Handle token refresh dynamically
        unsubscribeTokenRefresh = messaging().onTokenRefresh(async (newToken) => {
          if (isMounted) {
            console.log('FCM Token Refreshed:', newToken);
            await saveFCMTokenToBackend(storedId, newToken);
          }
        });

        // Listen to messages received in the foreground
        unsubscribeMessage = messaging().onMessage(async (remoteMessage) => {
          if (isMounted) {
            console.log('Foreground Message received:', remoteMessage);
            Alert.alert(
              remoteMessage.notification?.title || 'New Order Alert',
              remoteMessage.notification?.body || 'A new order has been received.'
            );
          }
        });

        // Handle when a notification is clicked while the app is in the background
        unsubscribeNotificationOpened = messaging().onNotificationOpenedApp((remoteMessage) => {
          if (isMounted) {
            console.log('Notification caused app to open from background:', remoteMessage);
            router.push('/orders');
          }
        });

        // Check if the app was opened from a completely closed (quit) state via a notification
        messaging()
          .getInitialNotification()
          .then((remoteMessage) => {
            if (remoteMessage && isMounted) {
              console.log('Notification caused app to open from quit state:', remoteMessage);
              router.push('/orders');
            }
          });

      } catch (error) {
        console.error('Failed to setup FCM notifications in layout:', error);
      }
    };

    setupNotifications();

    return () => {
      isMounted = false;
      if (unsubscribeMessage) unsubscribeMessage();
      if (unsubscribeTokenRefresh) unsubscribeTokenRefresh();
      if (unsubscribeNotificationOpened) unsubscribeNotificationOpened();
    };
  }, []);

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="homepage/index"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="orders/index"
        options={{
          title: 'Orders',
        }}
      />
      <Tabs.Screen
        name="liveorders/index"
        options={{
          title: 'Live Orders',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 16,
    backgroundColor: 'transparent',
    pointerEvents: 'box-none',
  },
  navBarWrapper: {
    width: 360,
    height: 68,
    position: 'relative',
  },
  navBarBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#DCD5C7', // Sand/Beige color matching header
    borderRadius: 34,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  tabItemsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 10,
    zIndex: 2,
  },
  tabItem: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    width: 60,
    zIndex: 2,
  },
  smallCircle: {
    position: 'absolute',
    top: 14,
    left: 10, // Centered horizontally: (60px tabItem width - 40px circle width) / 2 = 10px
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    zIndex: -1,
  },
  activeCircle: {
    position: 'absolute',
    top: -8, // Centers the circle vertically relative to active tab item (height 68 - height 56 = 12, offset up by 14 = -8)
    left: 24.5, // Center offset of first tab (10 padding + 42.5 segment center - 28 half-width)
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 10, // Must be higher than navBar elevation (8) to render on top on Android
    zIndex: 1,
  },
});
