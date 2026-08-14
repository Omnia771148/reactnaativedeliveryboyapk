import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { Tabs, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, DeviceEventEmitter, StyleSheet, TouchableOpacity, View, Alert, Text, Modal, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, fetchWithTimeout } from '@/constants/api';
import { registerForFCMAsync, saveFCMTokenToBackend, ensureFCMTokenRegistered } from '@/utils/notifications';
import { startDeliveryForegroundService, stopDeliveryForegroundService } from '@/utils/foregroundService';
import { playOrderSound, stopOrderSoundNative } from '@/utils/soundService';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('order_notifications', {
    name: 'Order Notifications',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 200, 500, 200, 500],
    lightColor: '#008000',
    sound: 'ordernotification.wav',
    enableVibrate: true,
    enableLights: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    audioAttributes: {
      usage: Notifications.AndroidAudioUsage.NOTIFICATION_RINGTONE,
      contentType: Notifications.AndroidAudioContentType.SONIFICATION,
    },
  }).catch((err) => console.warn('Failed to set Android notification channel:', err));
}

// Notification Channel configured for order_notifications

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
          DeviceEventEmitter.emit('stopOrderSound');
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

        const fetchUrl = `${API_URL}/api/acceptedorders`;
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

          if (isMounted) {
            setOrderCount(activeOrders.length);
            if (activeOrders.length > 0 && !currentActiveOrderId) {
              DeviceEventEmitter.emit('startOrderSound');
            } else {
              DeviceEventEmitter.emit('stopOrderSound');
            }
          }
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
  const [orderModalVisible, setOrderModalVisible] = useState(false);
  const [orderModalData, setOrderModalData] = useState({ title: '', body: '' });

  useEffect(() => {


    // Restore foreground service if driver was OPEN when app was last open
    AsyncStorage.getItem('isActive').then((val) => {
      if (val === 'true') {
        startDeliveryForegroundService(
          "🟢 Delivery Boy — ON",
          "Searching for nearby orders..."
        );
      }
    });
  }, []);

  // Single-device automatic logout verification effect
  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      try {
        const storedId = await AsyncStorage.getItem('userid');
        const storedSessionId = await AsyncStorage.getItem('sessionId');

        if (storedId) {
          const res = await fetchWithTimeout(`${API_URL}/api/verify-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userid: storedId, sessionId: storedSessionId }),
          }, 4000);

          if (res.status === 403 || res.status === 401) {
            const data = await res.json().catch(() => ({}));
            if (isMounted) {
              await AsyncStorage.multiRemove([
                'userid',
                'sessionId',
                'name',
                'phone',
                'isActive',
                'updatedAt',
                'lastLoginDate',
              ]);
              stopDeliveryForegroundService();
              const isActuallyBlocked = data.isBlocked === true || data.code === 'ACCOUNT_BLOCKED';
              const alertTitle = isActuallyBlocked ? 'Account Blocked' : 'Session Expired';
              const alertMsg = isActuallyBlocked
                ? 'Your account has been blocked by administration. You have been automatically logged out.'
                : 'Your session has expired or was logged in from another device.';

              Alert.alert(
                alertTitle,
                alertMsg,
                [{ text: 'OK', onPress: () => router.replace('/') }]
              );
            }
          }
        }
      } catch (err) {
        console.warn('Session validity check warning:', err);
      }
    };

    checkSession();
    const interval = setInterval(checkSession, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const currentSoundRef = useRef(null);
  const soundTimeoutRef = useRef(null);
  const isPlayingLoopRef = useRef(false);

  const stopSound = async () => {
    isPlayingLoopRef.current = false;
    if (soundTimeoutRef.current) {
      clearTimeout(soundTimeoutRef.current);
      soundTimeoutRef.current = null;
    }
    await stopOrderSoundNative();
  };

  const playRepeatingSoundWithBreak = async () => {
    isPlayingLoopRef.current = true;
    await playOrderSound();
  };

  useEffect(() => {
    let isMounted = true;
    let unsubscribeMessage = null;
    let unsubscribeTokenRefresh = null;
    let unsubscribeNotificationOpened = null;

    const stopSoundSub = DeviceEventEmitter.addListener('stopOrderSound', () => {
      stopSound();
    });

    const startSoundSub = DeviceEventEmitter.addListener('startOrderSound', () => {
      playRepeatingSoundWithBreak();
    });



    const setupNotifications = async () => {
      try {
        const storedId = await AsyncStorage.getItem('userid');
        if (!storedId) return;

        // Clean up any previously attached FCM listeners to avoid duplicates
        if (unsubscribeMessage) { unsubscribeMessage(); unsubscribeMessage = null; }
        if (unsubscribeTokenRefresh) { unsubscribeTokenRefresh(); unsubscribeTokenRefresh = null; }
        if (unsubscribeNotificationOpened) { unsubscribeNotificationOpened(); unsubscribeNotificationOpened = null; }

        // Register for push notifications and ensure token is synced to backend DB
        await ensureFCMTokenRegistered(storedId);

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

            // Check if delivery boy already has an active order in progress/tracker
            let hasActiveOrderInTracker = false;
            try {
              if (storedId) {
                const activeRes = await fetch(`${API_URL}/api/deliveryboy/${storedId}/activeorder`);
                if (activeRes.ok) {
                  const activeText = await activeRes.text();
                  if (activeText && activeText.trim().length > 0) {
                    const activeJson = JSON.parse(activeText);
                    if (activeJson && activeJson.orderId) {
                      hasActiveOrderInTracker = true;
                    }
                  }
                }
              }
            } catch (err) {
              console.warn('Failed to check active order status in foreground handler:', err);
            }

            if (!hasActiveOrderInTracker) {
              try {
                await playRepeatingSoundWithBreak();
              } catch (error) {
                console.error('Failed to play custom notification sound:', error);
              }
            } else {
              console.log('User has active order in tracker; suppressing sound.');
              await stopSound();
            }

            // Refresh orders count and list in app
            DeviceEventEmitter.emit('refreshOrdersCount');

            // Trigger local top banner notification popup
            try {
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: remoteMessage.notification?.title || 'New Order Available!',
                  body: remoteMessage.notification?.body || 'A new delivery order request is available.',
                  sound: 'ordernotification.wav',
                  channelId: 'order_notifications',
                },
                trigger: null,
              });
            } catch (notifErr) {
              console.warn('Local notification trigger warning:', notifErr);
            }
          }
        });

        // Handle when a notification is clicked while the app is in the background
        unsubscribeNotificationOpened = messagingModule().onNotificationOpenedApp((remoteMessage) => {
          if (isMounted) {
            console.log('Notification caused app to open from background:', remoteMessage);
            router.push('/orders');
            DeviceEventEmitter.emit('refreshOrdersCount');
          }
        });

        // Check if the app was opened from a completely closed (quit) state via a notification
        messagingModule()
          .getInitialNotification()
          .then((remoteMessage) => {
            if (remoteMessage && isMounted) {
              console.log('Notification caused app to open from quit state:', remoteMessage);
              router.push('/orders');
              DeviceEventEmitter.emit('refreshOrdersCount');
            }
          });

      } catch (error) {
        console.error('Failed to setup FCM notifications in layout:', error);
      }
    };

    setupNotifications();

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        setupNotifications();
      }
    });

    const expoNotifResponseSub = Notifications.addNotificationResponseReceivedListener((_response) => {
      if (isMounted) {
        console.log('Expo local notification tapped by user, navigating to orders');
        router.push('/orders');
        DeviceEventEmitter.emit('refreshOrdersCount');
      }
    });

    return () => {
      isMounted = false;
      stopSoundSub.remove();
      startSoundSub.remove();
      appStateSub.remove();
      expoNotifResponseSub.remove();
      if (unsubscribeMessage) unsubscribeMessage();
      if (unsubscribeTokenRefresh) unsubscribeTokenRefresh();
      if (unsubscribeNotificationOpened) unsubscribeNotificationOpened();
    };
  }, []);



  return (
    <View style={{ flex: 1 }}>
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
    </View>
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
  orderModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  orderModalCard: {
    width: '100%',
    backgroundColor: '#1E293B', // Rich dark slate card background
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#22C55E', // Glowing neon green border
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  orderModalHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22C55E',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
    gap: 6,
  },
  orderModalHeaderBadgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
  },
  orderModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
  },
  orderModalBody: {
    fontSize: 15,
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  orderModalAcceptBtn: {
    width: '100%',
    backgroundColor: '#16A34A',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 14,
    marginBottom: 12,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  orderModalAcceptBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  orderModalDismissBtn: {
    width: '100%',
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  orderModalDismissBtnText: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 13,
  },
});
