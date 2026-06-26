import { BrandHeader } from '@/components/brand-header';
import { LoadingOverlay } from '@/components/loading-overlay';
import { API_URL } from '@/constants/api';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, FlatList, Linking, Modal, Platform, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

let Audio = null;
try {
  Audio = require('expo-av').Audio;
} catch (e) {
  console.warn('expo-av is not available in this environment:', e);
}

const customAlert = (title, message, buttons = []) => {
  if (Platform.OS === 'web') {
    if (buttons && buttons.length > 0) {
      const cancelBtn = buttons.find(b => b.style === 'cancel' || (b.text && b.text.toLowerCase() === 'cancel'));
      const actionBtn = buttons.find(b => b !== cancelBtn);

      if (cancelBtn) {
        const confirmed = window.confirm(`${title}\n\n${message}`);
        if (confirmed) {
          if (actionBtn && actionBtn.onPress) {
            actionBtn.onPress();
          }
        } else {
          if (cancelBtn && cancelBtn.onPress) {
            cancelBtn.onPress();
          }
        }
      } else {
        window.alert(`${title}\n\n${message}`);
        if (actionBtn && actionBtn.onPress) {
          actionBtn.onPress();
        }
      }
    } else {
      window.alert(`${title}\n\n${message}`);
    }
  } else {
    Alert.alert(title, message, buttons);
  }
};

export default function OrdersScreen() {
  const navigation = useNavigation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState('');
  const [updating, setUpdating] = useState(false);
  const [hasActiveOrder, setHasActiveOrder] = useState(false);

  const bounceAnim = useRef(new Animated.Value(0)).current;
  const ordersRef = useRef([]);
  const isFirstFetch = useRef(true);

  const playSound = async () => {
    if (!Audio) {
      console.warn('Audio is not available, skipping playSound.');
      return;
    }
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('@/assets/ordernotification.wav'),
        { shouldPlay: true }
      );
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          sound.unloadAsync().catch((err) => console.error('Error unloading sound:', err));
        }
      });
    } catch (error) {
      console.error('Failed to play order notification sound:', error);
    }
  };

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: -12, // Bob up by 12px
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0, // Bob down
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );

    if (!loading && orders.length === 0) {
      animation.start();
    } else {
      animation.stop();
      bounceAnim.setValue(0);
    }

    return () => {
      animation.stop();
    };
  }, [loading, orders, bounceAnim]);

  const fetchOrders = async () => {
    try {
      const storedId = await AsyncStorage.getItem('userid');

      // Read active status solely from AsyncStorage to avoid database round-trips
      const storedActive = await AsyncStorage.getItem('isActive');
      const userIsActive = storedActive !== 'false'; // Default to true if not set
      setIsActive(userIsActive);

      if (!userIsActive) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Check if this delivery boy has an active order in progress
      let hasActive = false;
      let currentActiveOrderId = null;
      if (storedId) {
        try {
          const activeCheckResponse = await fetch(`${API_URL}/api/deliveryboy/${storedId}/activeorder`);
          if (activeCheckResponse.ok) {
            const text = await activeCheckResponse.text();
            if (text && text.trim().length > 0) {
              const activeData = JSON.parse(text);
              if (activeData && activeData.orderId) {
                hasActive = true;
                currentActiveOrderId = activeData.orderId;
              }
            }
          }
        } catch (err) {
          console.error('Failed to check active order status:', err);
        }
      }
      setHasActiveOrder(hasActive);

      const fetchUrl = storedId
        ? `${API_URL}/api/acceptedorders?deliveryBoyId=${storedId}`
        : `${API_URL}/api/acceptedorders`;
      const response = await fetch(fetchUrl);
      if (response.ok) {
        let data = [];
        try {
          const text = await response.text();
          data = JSON.parse(text);
        } catch (_e) {
          console.error('Failed to parse accepted orders JSON');
        }
        // Filter out orders that have already been rejected by this user or accepted by another delivery boy
        let activeOrders = storedId
          ? (Array.isArray(data) ? data.filter(order => {
            const notRejected = !order.rejectedBy || !order.rejectedBy.includes(storedId);
            // Show order if it is unassigned OR assigned to this delivery boy specifically
            const isAvailableOrMine = !order.deliveryBoyId || order.deliveryBoyId === storedId;
            return notRejected && isAvailableOrMine;
          }) : [])
          : data;

        // Filter out the order that the current delivery boy has already accepted
        if (currentActiveOrderId) {
          activeOrders = activeOrders.filter(order => order.orderId !== currentActiveOrderId && order._id !== currentActiveOrderId);
        }

        // Compare fetched orders with previously stored orders
        const prevOrderIds = ordersRef.current.map(o => o._id || o.orderId);
        const currentOrderIds = activeOrders.map(o => o._id || o.orderId);
        const hasNewOrder = currentOrderIds.some(id => !prevOrderIds.includes(id));

        if (hasNewOrder) {
          playSound();
        }

        ordersRef.current = activeOrders;
        isFirstFetch.current = false;

        setOrders(activeOrders);
      } else {
        console.error('Failed to fetch accepted orders:', response.status);
      }
    } catch (error) {
      console.error('Failed to fetch accepted orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const setupAudio = async () => {
      if (!Audio) return;
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
        });
      } catch (err) {
        console.warn('Failed to setup audio mode:', err);
      }
    };
    setupAudio();

    const loadInitialStatus = async () => {
      try {
        const storedActive = await AsyncStorage.getItem('isActive');
        if (storedActive !== null) {
          setIsActive(storedActive === 'true');
        }
      } catch (e) {
        console.error('Failed to load initial active status:', e);
      }
    };
    loadInitialStatus();

    fetchOrders();

    const intervalId = setInterval(() => {
      fetchOrders();
    }, 5000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    // Instantly refresh active/inactive status and orders whenever the tab comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      fetchOrders();
    });

    return unsubscribe;
  }, [navigation]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const handleOpenMap = async (item) => {
    // Extract coordinates from restaurantLocation, location, or top-level properties
    let lat = null;
    let lng = null;

    if (item?.restaurantLocation?.lat && item?.restaurantLocation?.lng) {
      lat = item.restaurantLocation.lat;
      lng = item.restaurantLocation.lng;
    } else if (item?.location?.lat && item?.location?.lng) {
      lat = item.location.lat;
      lng = item.location.lng;
    } else if (item?.lat && item?.lng) {
      lat = item.lat;
      lng = item.lng;
    }

    let url = item?.rest;

    // Use coordinates if available to construct a stable Google Maps query link
    if (lat && lng) {
      url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    }

    if (!url) {
      customAlert('Error', 'Google Map link or coordinates are not available');
      return;
    }

    try {
      await Linking.openURL(url);
    } catch (error) {
      customAlert('Error', 'Cannot open the Google Map link');
      console.error('Failed to open map URL:', error);
    }
  };

  const handleAcceptOrder = async (order) => {
    if (updating) return;
    setUpdating(true);
    try {
      const deliveryBoyId = await AsyncStorage.getItem('userid');
      const deliveryBoyName = await AsyncStorage.getItem('name');
      const deliveryBoyPhone = await AsyncStorage.getItem('phone');

      if (!deliveryBoyId || !deliveryBoyName || !deliveryBoyPhone) {
        customAlert('Error', 'Delivery partner profile details not found. Please log in again.');
        return;
      }

      // Check locally if there's an active order first
      if (hasActiveOrder) {
        customAlert(
          'Active Order Alert',
          'You already have an active order. Please complete it to accept a second order.'
        );
        return;
      }

      // Live check with backend to prevent race condition
      try {
        const activeCheckResponse = await fetch(`${API_URL}/api/deliveryboy/${deliveryBoyId}/activeorder`);
        if (activeCheckResponse.ok) {
          const text = await activeCheckResponse.text();
          if (text && text.trim().length > 0) {
            const activeData = JSON.parse(text);
            if (activeData && activeData.orderId) {
              setHasActiveOrder(true);
              customAlert(
                'Active Order Alert',
                'You already have an active order. Please complete it to accept a second order.'
              );
              return;
            }
          }
        }
      } catch (err) {
        console.error('Failed live active order check:', err);
      }

      const response = await fetch(`${API_URL}/api/acceptedorders/${order._id}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deliveryBoyId,
          deliveryBoyName,
          deliveryBoyPhone,
        }),
      });

      let data = {};
      try {
        const text = await response.text();
        data = JSON.parse(text);
      } catch (_e) {
        data = { message: 'Server is starting up or returned an invalid response. Please try again in a few seconds.' };
      }

      if (response.ok) {
        fetchOrders();
        router.replace('/liveorders');
      } else {
        // Double check if the order has been accepted by someone else in case of error (500, 409, etc.)
        let isAlreadyTaken = false;
        try {
          const checkRes = await fetch(`${API_URL}/api/acceptedorders`);
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            const matchingOrder = Array.isArray(checkData) ? checkData.find(o => o._id === order._id) : null;
            if (matchingOrder && matchingOrder.deliveryBoyId && matchingOrder.deliveryBoyId !== deliveryBoyId) {
              isAlreadyTaken = true;
            }
          }
        } catch (e) {
          console.error("Failed to verify if order is taken:", e);
        }

        if (
          response.status === 409 ||
          response.status === 500 ||
          isAlreadyTaken ||
          (data.message && data.message.toLowerCase().includes('already accepted'))
        ) {
          setErrorModalMessage("sorry the order was already accepted by other delivery boy\n\nbetter luck next time");
          setErrorModalVisible(true);
        } else {
          customAlert('Error', data.message || 'Failed to accept order.', [
            {
              text: 'OK',
              onPress: () => {
                fetchOrders();
              },
            },
          ]);
        }
      }
    } catch (error) {
      console.error('Failed to accept order:', error);
      customAlert('Error', 'Network error. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const handleRejectOrder = async (order) => {
    if (updating) return;
    setUpdating(true);
    try {
      const userId = await AsyncStorage.getItem('userid');
      if (!userId) {
        customAlert('Error', 'Delivery boy ID not found in local storage. Please log in again.');
        return;
      }

      const response = await fetch(`${API_URL}/api/acceptedorders/${order._id}/reject`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deliveryBoyId: userId }),
      });

      if (response.ok) {
        fetchOrders(); // Refresh to remove the rejected order from view
      } else {
        let errorData = {};
        try {
          const text = await response.text();
          errorData = JSON.parse(text);
        } catch (_e) {
          errorData = { message: 'Server is starting up or returned an invalid response. Please try again in a few seconds.' };
        }
        customAlert('Error', errorData.message || 'Failed to reject order');
      }
    } catch (error) {
      console.error('Failed to reject order:', error);
      customAlert('Error', 'Network error. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const renderOrderItem = ({ item }) => {
    return (
      <View style={styles.orderCard}>
        {/* Card Row: Restaurant */}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Restaurant</Text>
          <Text style={styles.detailSeparator}>-</Text>
          <Text style={styles.detailValue} numberOfLines={1}>{item.restaurantName || 'N/A'}</Text>
        </View>

        {/* Card Row: Location */}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Location</Text>
          <Text style={styles.detailSeparator}>-</Text>
          <View style={styles.valueContainer}>
            <TouchableOpacity
              style={styles.mapButton}
              activeOpacity={0.8}
              onPress={() => handleOpenMap(item)}
            >
              <Text style={styles.mapButtonText}>View Map</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Card Row: Distance */}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Distance</Text>
          <Text style={styles.detailSeparator}>-</Text>
          <Text style={styles.detailValue}>{item.location?.distanceText || 'N/A'}</Text>
        </View>

        {/* Card Row: Delivery Fee */}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Delivery fee</Text>
          <Text style={styles.detailSeparator}>-</Text>
          <Text style={styles.detailValue}>₹ {item.deliveryCharge || 0}</Text>
        </View>

        {/* Buttons Row */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            activeOpacity={0.9}
            onPress={() => handleAcceptOrder(item)}
          >
            <Text style={styles.buttonText}>Accept order</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            activeOpacity={0.9}
            onPress={() => handleRejectOrder(item)}
          >
            <Text style={styles.buttonText}>Reject order</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    return (
      <View style={styles.emptyContainer}>
        <Animated.View style={[styles.boxWrapper, { transform: [{ translateY: bounceAnim }] }]}>
          <Ionicons name="cube-outline" size={72} color="#8E8882" />
          <Ionicons name="heart" size={20} color="#8E8882" style={styles.heartIcon} />
        </Animated.View>
        <Text style={styles.emptyTitle}>No Orders Yet</Text>
        <Text style={styles.emptySubtitle}>We are looking for new requests nearby. Stay tuned!</Text>
      </View>
    );
  };

  if (loading) {
    return <LoadingOverlay visible={true} />;
  }

  return (
    <View style={styles.container}>
      <LoadingOverlay visible={updating} />
      <SafeAreaView style={styles.safeArea}>
        {/* Custom Header Bar */}
        <BrandHeader />

        {isActive && hasActiveOrder && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={20} color="#FFFFFF" />
            <Text style={styles.warningBannerText}>
              You have an active order. Complete it to accept more.
            </Text>
          </View>
        )}

        {!isActive ? (
          <View style={styles.inactiveContainer}>
            <View style={styles.inactiveIconContainer}>
              <Ionicons name="notifications-off-outline" size={48} color="#FFFFFF" />
            </View>
            <Text style={styles.inactiveTitle}>You are inactive</Text>
            <Text style={styles.inactiveSubtitle}>Please activate your status to see and accept orders.</Text>
            <TouchableOpacity
              style={styles.inactiveButton}
              activeOpacity={0.9}
              onPress={() => router.replace('/homepage')}
            >
              <Text style={styles.inactiveButtonText}>Activate Status</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={orders}
            renderItem={renderOrderItem}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={renderEmptyState}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={['#B58A55']}
                tintColor="#B58A55"
              />
            }
          />
        )}
      </SafeAreaView>

      <Modal
        visible={errorModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalIconCircle}>
              <Ionicons name="close" size={36} color="#FFFFFF" />
            </View>
            <Text style={styles.modalMessageText}>
              {errorModalMessage}
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              activeOpacity={0.8}
              onPress={() => {
                setErrorModalVisible(false);
                fetchOrders();
              }}
            >
              <Text style={styles.modalButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#CE3A31', // Crimson red theme
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  warningBannerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },

  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  orderCard: {
    backgroundColor: '#EAE5D9', // Warm sand/beige card background
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    width: 100,
    fontSize: 15,
    color: '#2A3037',
    fontWeight: '600',
  },
  detailSeparator: {
    width: 20,
    fontSize: 15,
    color: '#8E8882',
    fontWeight: '600',
    textAlign: 'center',
  },
  detailValue: {
    flex: 1,
    fontSize: 15,
    color: '#2A3037',
    fontWeight: '600',
  },
  valueContainer: {
    flex: 1,
    alignItems: 'flex-start',
  },
  mapButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 15,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  mapButtonText: {
    fontSize: 14,
    color: '#2A3037',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  acceptButton: {
    backgroundColor: '#2E7D32', // Darker forest/emerald green
  },
  rejectButton: {
    backgroundColor: '#CE3A31', // Crimson/red
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2A3037',
    marginTop: 15,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#8E8882',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
  },
  boxWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    width: 80,
    height: 80,
  },
  heartIcon: {
    position: 'absolute',
    top: 34,
  },
  inactiveContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  inactiveIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#CE3A31', // Solid red background
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  inactiveTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2A3037',
    marginBottom: 10,
    textAlign: 'center',
  },
  inactiveSubtitle: {
    fontSize: 15,
    color: '#8E8882',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  inactiveButton: {
    backgroundColor: '#CE3A31', // Crimson red
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  inactiveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    maxWidth: 320,
    backgroundColor: '#FAF9F6',
    borderRadius: 28,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  modalIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalMessageText: {
    fontSize: 18,
    color: '#000000',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  modalButton: {
    backgroundColor: '#000000',
    width: 180,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
