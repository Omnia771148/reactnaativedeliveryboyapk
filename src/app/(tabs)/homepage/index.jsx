import { styles } from '@/styles/homepage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { API_URL } from '@/constants/api';

export default function HomepageScreen() {
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

  // Fetch delivery boy completed orders and earnings stats from backend API
  const fetchEarnings = async (id) => {
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
  };

  // Animated position of the sliding circle (between 8 for inactive and 138 for active)
  const animatedValue = useRef(new Animated.Value(8)).current;

  // Load user session and fetch latest status from DB on mount
  useEffect(() => {
    const fetchUserStatus = async () => {
      try {
        const storedId = await AsyncStorage.getItem('userid');
        if (!storedId) {
          setLoading(false);
          return;
        }
        setUserid(storedId);

        // Fetch active status from backend
        const response = await fetch(`${API_URL}/api/users/${storedId}`);
        if (response.ok) {
          let data = {};
          try {
            const text = await response.text();
            data = JSON.parse(text);
          } catch (e) {
            console.error('Failed to parse status response:', e);
          }
          setIsActive(!!data.isActive);
          await AsyncStorage.setItem('isActive', String(!!data.isActive));
        }

        // Fetch latest earnings statistics
        await fetchEarnings(storedId);
      } catch (error) {
        console.error('Error fetching status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserStatus();
  }, []);

  // Trigger sliding animation when active state changes
  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: isActive ? 138 : 8,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [isActive]);

  // Sync state update with MongoDB backend API
  const toggleActiveStatus = async () => {
    if (!userid || updating) return;

    setUpdating(true);
    const targetStatus = !isActive;

    try {
      const response = await fetch(`${API_URL}/api/users/${userid}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: targetStatus,
        }),
      });

      let data = {};
      try {
        const text = await response.text();
        data = JSON.parse(text);
      } catch (e) {
        data = { message: 'Invalid response from server. Check if backend is running.' };
      }

      if (response.ok) {
        setIsActive(targetStatus);
        await AsyncStorage.setItem('isActive', String(targetStatus));
        // Refresh earnings statistics after successfully toggling status
        await fetchEarnings(userid);

        if (targetStatus) {
          router.replace('/orders');
        }
      } else {
        Alert.alert('Error', data.message || 'Failed to update active status.');
      }
    } catch (error) {
      console.error('Error toggling status:', error);
      Alert.alert('Error', 'Network error. Check if your backend server is running.');
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
        <View style={styles.headerBar}>
          {/* Left white circle containing the golden logo */}
          <View style={styles.headerCircle}>
            <Image
              source={require('@/assets/images/logo-L.png')}
              style={styles.headerLogo}
              contentFit="contain"
            />
          </View>
          {/* Centered Brand Title */}
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>LEEVON</Text>
          </View>
          {/* Empty spacer to balance layout */}
          <View style={styles.headerSpacer} />
        </View>

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

            {loading || updating ? (
              <View style={styles.buttonLoaderContainer}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            ) : (
              <>
                {/* OPEN Text */}
                <Animated.Text
                  style={[
                    styles.toggleText,
                    styles.openText,
                    { opacity: openOpacity }
                  ]}
                >
                  OPEN
                </Animated.Text>

                {/* CLOSED Text */}
                <Animated.Text
                  style={[
                    styles.toggleText,
                    styles.closedText,
                    { opacity: closedOpacity }
                  ]}
                >
                  CLOSED
                </Animated.Text>

                {/* Sliding White Circle */}
                <Animated.View
                  style={[
                    styles.toggleCircle,
                    { transform: [{ translateX: animatedValue }] }
                  ]}
                />
              </>
            )}
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
    </View>
  );
}
