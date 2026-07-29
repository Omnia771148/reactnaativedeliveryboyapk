import { BrandHeader } from '@/components/brand-header';
import { API_URL, fetchWithTimeout } from '@/constants/api';
import { styles } from '@/styles/homepage';
import { startDeliveryForegroundService, stopDeliveryForegroundService } from '@/utils/foregroundService';
import { requestNotificationPermission, registerForFCMAsync, saveFCMTokenToBackend } from '@/utils/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Animated, Modal, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomepageScreen() {
  const navigation = useNavigation();
  const [userid, setUserid] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [stats, setStats] = useState({
    todayOrders: 0,
    todayEarnings: 0,
    totalOrders: 0,
    monthlyEarnings: 0,
  });

  // Custom Alert Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('Active Order Pending');
  const [modalMessage, setModalMessage] = useState('');

  // Fetch delivery boy completed orders and earnings stats from backend API
  const fetchEarnings = useCallback(async (id) => {
    try {
      const response = await fetch(`${API_URL}/api/deliveryboy/${id}/earnings`);
      if (response.ok) {
        let data = null;
        try {
          const text = await response.text();
          data = JSON.parse(text);
        } catch (_e) {
          console.error('Failed to parse earnings response JSON');
        }
        if (data) {
          setStats(data);
        }
      }
    } catch (error) {
      console.error('Error fetching earnings:', error);
    }
  }, []);

  // Fetch both active status and latest earnings statistics
  const fetchUserStatusAndEarnings = useCallback(async (id) => {
    const userIdToUse = id || userid;
    if (!userIdToUse) return;

    try {
      // Fetch active status from backend
      const response = await fetch(`${API_URL}/api/users/${userIdToUse}`);
      if (response.ok) {
        let data = {};
        try {
          const text = await response.text();
          data = JSON.parse(text);
        } catch (_e) {
          console.error('Failed to parse status response');
        }
        setIsActive(!!data.isActive);
        await AsyncStorage.setItem('isActive', String(!!data.isActive));
      }

      // Fetch latest earnings statistics
      await fetchEarnings(userIdToUse);
    } catch (error) {
      console.error('Error fetching status and earnings:', error);
    }
  }, [userid, fetchEarnings]);

  // Animated position of the sliding circle (between 8 for inactive and 138 for active)
  const animatedValue = useRef(new Animated.Value(8)).current;

  // Load user session and fetch latest status from DB on mount
  useEffect(() => {
    const loadSessionAndData = async () => {
      try {
        const storedId = await AsyncStorage.getItem('userid');
        if (storedId) {
          setUserid(storedId);
          await fetchUserStatusAndEarnings(storedId);
        }
      } catch (error) {
        console.error('Error loading session:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSessionAndData();
  }, [fetchUserStatusAndEarnings]);

  // Polling and focus listener to keep status & earnings updated
  useEffect(() => {
    // 1. Immediately refresh when screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      if (userid) {
        fetchUserStatusAndEarnings(userid);
      } else {
        AsyncStorage.getItem('userid').then((storedId) => {
          if (storedId) {
            setUserid(storedId);
            fetchUserStatusAndEarnings(storedId);
          }
        });
      }
    });

    // 2. Poll every 5 seconds while component is mounted
    const intervalId = setInterval(() => {
      if (userid) {
        fetchUserStatusAndEarnings(userid);
      } else {
        AsyncStorage.getItem('userid').then((storedId) => {
          if (storedId) {
            setUserid(storedId);
            fetchUserStatusAndEarnings(storedId);
          }
        });
      }
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(intervalId);
    };
  }, [navigation, userid, fetchUserStatusAndEarnings]);

  // Trigger sliding animation & control background service when active state changes
  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: isActive ? 138 : 8,
      duration: 250,
      useNativeDriver: true,
    }).start();

    if (isActive) {
      startDeliveryForegroundService(
        "🟢 Delivery Boy — ON",
        "Searching for nearby orders..."
      );
    } else {
      stopDeliveryForegroundService();
    }
  }, [isActive, animatedValue]);

  // Sync state update with MongoDB backend API
  const toggleActiveStatus = async () => {
    if (!userid || updating) return;

    setUpdating(true);
    const targetStatus = !isActive;

    // Check if trying to turn OFF while having an active delivery order
    if (!targetStatus) {
      try {
        const activeRes = await fetchWithTimeout(`${API_URL}/api/deliveryboy/${userid}/activeorder`, {}, 5000);
        if (activeRes.ok) {
          let activeData = null;
          try {
            const text = await activeRes.text();
            activeData = JSON.parse(text);
          } catch (_e) {}

          if (activeData && (activeData._id || activeData.orderId)) {
            setModalTitle("Active Order Pending");
            setModalMessage("You cannot go offline while you have an active delivery order. Please complete your active order first.");
            setModalVisible(true);
            setUpdating(false);
            return;
          }
        }
      } catch (err) {
        console.warn("Active order check error before going offline:", err);
      }
    }

    if (targetStatus) {
      try {
        await requestNotificationPermission();
      } catch (permErr) {
        console.warn('Error requesting notification permission on toggle:', permErr);
      }
    }

    try {
      const response = await fetchWithTimeout(`${API_URL}/api/users/${userid}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: targetStatus,
        }),
      }, 30000);

      let data = {};
      try {
        const text = await response.text();
        data = JSON.parse(text);
      } catch (_e) {
        data = { message: 'Invalid response from server. Check if backend is running.' };
      }

      if (response.ok) {
        setIsActive(targetStatus);
        await AsyncStorage.setItem('isActive', String(targetStatus));
        // Refresh earnings statistics after successfully toggling status
        await fetchEarnings(userid);

        if (targetStatus) {
          registerForFCMAsync().then((token) => {
            if (token && userid) {
              saveFCMTokenToBackend(userid, token);
            }
          }).catch(console.error);

          router.replace('/orders');
        }
      } else {
        if (data.hasActiveOrder || response.status === 400) {
          setModalTitle("Active Order Pending");
          setModalMessage(data.message || "You cannot go offline while you have an active delivery order. Please complete your active order first.");
          setModalVisible(true);
        } else {
          console.warn('Status update warning:', data.message);
        }
      }
    } catch (error) {
      console.error('Error toggling status:', error);
    } finally {
      setUpdating(false);
    }
  };

  // Interpolate opacities for text and backgrounds based on the slider position
  const openOpacity = animatedValue.interpolate({
    inputRange: [8, 138],
    outputRange: [0, 1],
  });

  const closedOpacity = animatedValue.interpolate({
    inputRange: [8, 138],
    outputRange: [1, 0],
  });

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Custom Header Bar */}
        <BrandHeader />

        {/* Small spacing between Header and Selector */}
        <View style={styles.gap} />

        {/* Custom Animated Status Toggle Pill Button (Directly under the heading bar) */}
        <View style={styles.toggleWrapper}>
          <TouchableOpacity
            style={[
              styles.toggleClickable,
              (loading || updating) && styles.toggleDisabled
            ]}
            onPress={toggleActiveStatus}
            activeOpacity={0.9}
            disabled={loading || updating}
          >
            {/* Teal Background (Fades in/out over the base Red background) */}
            <Animated.View
              style={[
                styles.toggleBackground,
                styles.toggleActiveBg,
                { opacity: openOpacity }
              ]}
            />

            {/* ON Text */}
            <Animated.Text
              style={[
                styles.toggleText,
                styles.openText,
                { opacity: openOpacity }
              ]}
            >
              ON
            </Animated.Text>

            {/* OFF Text */}
            <Animated.Text
              style={[
                styles.toggleText,
                styles.closedText,
                { opacity: closedOpacity }
              ]}
            >
              OFF
            </Animated.Text>

            {/* Sliding White Circle */}
            <Animated.View
              style={[
                styles.toggleCircle,
                { transform: [{ translateX: animatedValue }] }
              ]}
            >
              {(loading || updating) && (
                <ActivityIndicator size="small" color="#2A3037" />
              )}
            </Animated.View>
          </TouchableOpacity>
        </View>

        {/* Main Body content area (Contains earnings cards) */}
        <View style={styles.bodyContainer}>
          {/* Row of two cards (Today orders & Today earnings) */}
          <View style={styles.statsRow}>
            {/* Card 1: Today Orders */}
            <View style={styles.halfCard}>
              <Text style={styles.cardLabel}>Today orders</Text>
              <Text style={styles.cardValue}>{stats.todayOrders}</Text>
            </View>

            {/* Card 2: Today Earnings */}
            <View style={styles.halfCard}>
              <Text style={styles.cardLabel}>Today earnings</Text>
              <Text style={styles.cardValue}>{stats.todayEarnings} Rs</Text>
            </View>
          </View>

          {/* Card 3: Monthly Record */}
          <View style={styles.fullCard}>
            <Text style={styles.monthlyRecordTitle}>Monthly record</Text>
            <View style={styles.monthlyDividerRow}>
              {/* Left Column: Total Orders */}
              <View style={styles.monthlyCol}>
                <Text style={styles.cardLabel}>Total orders</Text>
                <Text style={styles.cardValue}>{stats.totalOrders}</Text>
              </View>

              {/* Middle Divider Line */}
              <View style={styles.verticalDivider} />

              {/* Right Column: Monthly Earnings */}
              <View style={styles.monthlyCol}>
                <Text style={styles.cardLabel}>Monthly earnings</Text>
                <Text style={styles.cardValue}>{stats.monthlyEarnings} Rs</Text>
              </View>
            </View>
          </View>
        </View>
      </SafeAreaView>

      {/* Custom Styled Active Order Alert Modal matching App CSS and Theme */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalIconCircle}>
              <Ionicons name="close" size={38} color="#FFFFFF" />
            </View>
            <Text style={styles.modalTitleText}>{modalTitle}</Text>
            <Text style={styles.modalMessageText}>{modalMessage}</Text>
            <TouchableOpacity
              style={styles.modalButton}
              activeOpacity={0.85}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
