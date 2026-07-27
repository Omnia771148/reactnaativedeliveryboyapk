import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { Tabs, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, DeviceEventEmitter, StyleSheet, TouchableOpacity, View, Alert, Text, Modal, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';
import { registerForFCMAsync, saveFCMTokenToBackend } from '@/utils/notifications';
import { isBatteryOptimizationEnabled, requestIgnoreBatteryOptimization, openAppDetailsSettings } from '@/utils/batteryOptimization';
import Constants, { ExecutionEnvironment } from 'expo-constants';

let Audio = null;
try {
  Audio = require('expo-av').Audio;
} catch (e) {
  console.warn('expo-av is not available in this environment:', e);
}

// Custom Tab Bar component with sliding circle transition
function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const animatedIndex = useRef(new Animated.Value(state.index)).current;
  const [translateYAnim] = useState(() => new Animated.Value(0));
  const [orderCount, setOrderCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const checkOrders = async () => {
      try {
        const storedId = await AsyncStorage.getItem('userid');
        const storedActive = await AsyncStorage.getItem('isActive');
        const userIsActive = storedActive !== 'false';

        if (!userIsActive) {
          if (isMounted) setOrderCount(0);
          return;
        }

        let currentActiveOrderId = null;
        if (storedId) {
          try {
            const activeCheckResponse = await fetch(`${API_URL}/api/deliveryboy/${storedId}/activeorder`);
            if (activeCheckResponse.ok) {
              const text = await activeCheckResponse.text();
              if (text && text.trim().length > 0) {
                const activeData = JSON.parse(text);
                if (activeData && activeData.orderId) {
                  currentActiveOrderId = activeData.orderId;
                }
              }
            }
          } catch (err) {}
        }

        const fetchUrl = storedId
          ? `${API_URL}/api/acceptedorders?deliveryBoyId=${storedId}`
          : `${API_URL}/api/acceptedorders`;
        const response = await fetch(fetchUrl);
        if (response.ok) {
          const text = await response.text();
          const data = JSON.parse(text);
          let activeOrders = storedId
            ? (Array.isArray(data) ? data.filter(order => {
              const notRejected = !order.rejectedBy || !order.rejectedBy.includes(storedId);
              const isAvailableOrMine = !order.deliveryBoyId || order.deliveryBoyId === storedId;
              return notRejected && isAvailableOrMine;
            }) : [])
            : data;

          if (currentActiveOrderId) {
            activeOrders = activeOrders.filter(order => order.orderId !== currentActiveOrderId && order._id !== currentActiveOrderId);
          }

          if (isMounted) setOrderCount(activeOrders.length);
        }
      } catch (e) {
        // ignore fetch error
      }
    };

    checkOrders();
    const interval = setInterval(checkOrders, 4000);

    const updateSub = DeviceEventEmitter.addListener('updateOrdersCount', (count) => {
      if (isMounted) setOrderCount(count);
    });

    const refreshSub = DeviceEventEmitter.addListener('refreshOrdersCount', () => {
      checkOrders();
    });

    return () => {
      isMounted = false;
      clearInterval(interval);
      updateSub.remove();
      refreshSub.remove();
    };
  }, []);

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
  // Distance between each tab  85 pixels (available width 340 / 4)
  const translateX = animatedIndex.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: [0, 85, 170, 255],
  });

  const bottomPadding = Math.max(insets.bottom, 12);

  return (
    <Animated.View style={[styles.container, { paddingBottom: bottomPadding, transform: [{ translateY: translateYAnim }] }]}>
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
                <Animated.View style={{ transform: [{ translateY }, { scale }], position: 'relative' }}>
                  <Ionicons
                    name={iconName}
                    size={22}
                    color="#000000"
                  />
                  {index === 1 && orderCount > 0 && (
                    <View style={styles.badgeContainer}>
                      <Text style={styles.badgeText}>
                        {orderCount > 99 ? '99+' : orderCount}
                      </Text>
                    </View>
                  )}
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

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export default function Layout() {
  const [batteryOptimized, setBatteryOptimized] = useState(false);

  useEffect(() => {
    let active = true;
    const checkBatteryStatus = async () => {
      const isOptimized = await isBatteryOptimizationEnabled();
      if (active) {
        setBatteryOptimized(isOptimized);
      }
    };

    checkBatteryStatus();

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        checkBatteryStatus();
      }
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const currentSoundRef = useRef(null);

  const stopSound = async () => {
    if (currentSoundRef.current) {
      try {
        await currentSoundRef.current.stopAsync();
        await currentSoundRef.current.unloadAsync();
      } catch (e) {
        console.warn('Error stopping sound:', e);
      }
      currentSoundRef.current = null;
    }
  };

  useEffect(() => {
    let isMounted = true;
    let unsubscribeMessage = null;
    let unsubscribeTokenRefresh = null;
    let unsubscribeNotificationOpened = null;

    const stopSoundSub = DeviceEventEmitter.addListener('stopOrderSound', () => {
      stopSound();
    });

    const setupNotifications = async () => {
      try {
        const storedId = await AsyncStorage.getItem('userid');
        if (!storedId) return;

        // Register for push notifications and get FCM token
        const token = await registerForFCMAsync();
        if (token && isMounted) {
          await saveFCMTokenToBackend(storedId, token);
        }

        if (isExpoGo) {
          console.log('Skipping FCM notification setup: running in Expo Go');
          return;
        }

        let messagingModule;
        try {
          messagingModule = require('@react-native-firebase/messaging').default;
        } catch (e) {
          console.warn('Firebase Messaging module not found');
          return;
        }

        // Handle token refresh dynamically
        unsubscribeTokenRefresh = messagingModule().onTokenRefresh(async (newToken) => {
          if (isMounted) {
            console.log('FCM Token Refreshed:', newToken);
            await saveFCMTokenToBackend(storedId, newToken);
          }
        });

        // Listen to messages received in the foreground
        unsubscribeMessage = messagingModule().onMessage(async (remoteMessage) => {
          if (isMounted) {
            console.log('Foreground Message received:', remoteMessage);

            try {
              if (Audio) {
                // Stop any previous playing sound instance
                await stopSound();

                // Play the custom WAV sound file continuously in a loop until accepted/rejected/dismissed
                const { sound } = await Audio.Sound.createAsync(
                  require('../../../assets/ordernotification.wav'),
                  { isLooping: true }
                );
                currentSoundRef.current = sound;
                await sound.playAsync();
              } else {
                console.warn('Audio is not available, skipping custom notification sound.');
              }
            } catch (error) {
              console.error('Failed to play custom notification sound:', error);
            }

            // Display visual notification alert popup in the foreground
            Alert.alert(
              remoteMessage.notification?.title || 'New Order Available!',
              remoteMessage.notification?.body || 'Check the orders screen for details.',
              [
                {
                  text: 'View Live Orders',
                  onPress: () => {
                    stopSound();
                    router.push('/liveorders');
                  }
                },
                {
                  text: 'Dismiss',
                  style: 'cancel',
                  onPress: () => {
                    stopSound();
                  }
                }
              ],
              { cancelable: true }
            );
          }
        });

        // Handle when a notification is clicked while the app is in the background
        unsubscribeNotificationOpened = messagingModule().onNotificationOpenedApp((remoteMessage) => {
          if (isMounted) {
            console.log('Notification caused app to open from background:', remoteMessage);
            stopSound();
            router.push('/liveorders');
          }
        });

        // Check if the app was opened from a completely closed (quit) state via a notification
        messagingModule()
          .getInitialNotification()
          .then((remoteMessage) => {
            if (remoteMessage && isMounted) {
              console.log('Notification caused app to open from quit state:', remoteMessage);
              stopSound();
              router.push('/liveorders');
            }
          });

      } catch (error) {
        console.error('Failed to setup FCM notifications in layout:', error);
      }
    };

    setupNotifications();

    return () => {
      isMounted = false;
      stopSound();
      stopSoundSub.remove();
      if (unsubscribeMessage) unsubscribeMessage();
      if (unsubscribeTokenRefresh) unsubscribeTokenRefresh();
      if (unsubscribeNotificationOpened) unsubscribeNotificationOpened();
    };
  }, []);

  if (batteryOptimized) {
    return (
      <View style={styles.blockContainer}>
        <View style={styles.blockCard}>
          <FontAwesome name="exclamation-triangle" size={48} color="#C53030" style={{ marginBottom: 16 }} />
          <Text style={styles.blockTitle}>Action Required</Text>
          <Text style={styles.blockDescription}>
            In order to receive delivery requests and order notifications in the background, you must change your battery settings to "No Restrictions".
          </Text>
          <Pressable 
            onPress={() => requestIgnoreBatteryOptimization()}
            style={({ pressed }) => [
              styles.blockButton,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }
            ]}
          >
            <Text style={styles.blockButtonText}>{"ALLOW \"NO RESTRICTIONS\""}</Text>
          </Pressable>

          <Pressable 
            onPress={() => openAppDetailsSettings()}
            style={({ pressed }) => [
              styles.blockSecondaryButton,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }
            ]}
          >
            <Text style={styles.blockSecondaryButtonText}>{"OPEN APP SETTINGS (Xiaomi / Samsung)"}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

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
  badgeContainer: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: '#E53935', // Premium Red color for order notification
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#E53935',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 6,
    zIndex: 10,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    includeFontPadding: false,
  },
  blockContainer: {
    flex: 1,
    backgroundColor: '#FAF9F6',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  blockCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  blockTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2D3748',
    marginBottom: 12,
  },
  blockDescription: {
    fontSize: 14,
    color: '#4A5568',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  blockButton: {
    width: '100%',
    backgroundColor: '#208AEF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  blockButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  blockSecondaryButton: {
    width: '100%',
    backgroundColor: '#EDF2F7',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  blockSecondaryButtonText: {
    color: '#2D3748',
    fontWeight: '600',
    fontSize: 13,
  },
});
