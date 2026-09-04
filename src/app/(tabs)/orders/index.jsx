import { BrandHeader } from '@/components/brand-header';
import { LoadingOverlay } from '@/components/loading-overlay';
import { API_URL } from '@/constants/api';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, DeviceEventEmitter, FlatList, Linking, Modal, Platform, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';



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
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedOrderToReject, setSelectedOrderToReject] = useState(null);

  const bounceAnim = useRef(new Animated.Value(0)).current;
  const ordersRef = useRef([]);
  const isFirstFetch = useRef(true);

  const currentSoundRef = useRef(null);
  const soundTimeoutRef = useRef(null);
  const isPlayingLoopRef = useRef(false);

  const stopOrderSound = async () => {
    DeviceEventEmitter.emit('stopOrderSound');
  };

  const playSound = async () => {
    DeviceEventEmitter.emit('startOrderSound');
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
              if (activeData && (activeData._id || activeData.orderId || activeData.id)) {
                hasActive = true;
                currentActiveOrderId = activeData._id || activeData.orderId || activeData.id;
              }
            }
          }
        } catch (err) {
          console.error('Failed to check active order status:', err);
        }
      }
      setHasActiveOrder(hasActive);

      const fetchUrl = `${API_URL}/api/acceptedorders`;
      const response = await fetch(fetchUrl);
      if (response.ok) {
        let data = [];
        try {
          const text = await response.text();
          data = JSON.parse(text);
        } catch (_e) {
          console.error('Failed to parse accepted orders JSON');
        }
        // Filter out orders that have already been accepted or assigned
        let activeOrders = storedId
          ? (Array.isArray(data) ? data.filter(order => {
            const notRejected = !order.rejectedBy || !order.rejectedBy.includes(storedId);
            const isUnassigned =
              !order.deliveryBoyId &&
              !order.deliveryBoyName &&
              !order.deliveryDetails &&
              order.status !== 'accepted' &&
              order.status !== 'out_for_delivery' &&
              order.status !== 'completed' &&
              order.isAccepted !== true;
            return notRejected && isUnassigned;
          }) : [])
          : data;

        // Filter out the order that the current delivery boy has already accepted
        if (currentActiveOrderId) {
          activeOrders = activeOrders.filter(order => order.orderId !== currentActiveOrderId && order._id !== currentActiveOrderId);
        }

        if (activeOrders.length === 0 || hasActive || currentActiveOrderId) {
          DeviceEventEmitter.emit('stopOrderSound');
        } else if (userIsActive) {
          DeviceEventEmitter.emit('startOrderSound');
        }

        ordersRef.current = activeOrders;
        isFirstFetch.current = false;

        setOrders(activeOrders);
        DeviceEventEmitter.emit('updateOrdersCount', activeOrders.length);
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

    const refreshSub = DeviceEventEmitter.addListener('refreshOrdersCount', () => {
      fetchOrders();
    });

    return () => {
      clearInterval(intervalId);
      refreshSub.remove();
    };
  }, []);

  useEffect(() => {
    // Instantly refresh active/inactive status and orders whenever the tab comes into focus
    const unsubscribeFocus = navigation.addListener('focus', () => {
      fetchOrders();
    });

    return () => {
      unsubscribeFocus();
    };
  }, [navigation]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const openUrlInBrowserOrApp = async (url) => {
    try {
      if (Platform.OS === 'web') {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('Failed to open map URL:', error);
      if (Platform.OS === 'web') {
        window.location.assign(url);
      } else {
        customAlert('Error', 'Cannot open Google Maps');
      }
    }
  };

  const extractCoordinates = (sourceObj) => {
    if (!sourceObj) return null;

    const candidateSources = [
      sourceObj.userCoordinates,
      sourceObj.customerCoordinates,
      sourceObj.restaurantLocation,
      sourceObj.location,
      sourceObj.deliveryLocation,
      sourceObj.userLocation,
      sourceObj
    ];

    for (let src of candidateSources) {
      if (!src) continue;

      if (typeof src === 'string') {
        try {
          src = JSON.parse(src);
        } catch (e) {
          continue;
        }
      }

      if (typeof src === 'object' && src !== null) {
        if (Array.isArray(src.coordinates) && src.coordinates.length >= 2) {
          const lng = Number(src.coordinates[0]);
          const lat = Number(src.coordinates[1]);
          if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
            return { lat, lng };
          }
        }

        const latVal = src.lat ?? src.latitude ?? src.latitiude;
        const lngVal = src.lng ?? src.longitude ?? src.lngitude ?? src.long;

        if (latVal !== undefined && latVal !== null && lngVal !== undefined && lngVal !== null) {
          const lat = Number(latVal);
          const lng = Number(lngVal);
          if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
            return { lat, lng };
          }
        }
      }
    }

    return null;
  };

  const handleOpenMap = async (item) => {
    if (!item) return;

    let url = null;
    const coords = extractCoordinates(item.restaurantLocation || item.location || item);

    if (coords && coords.lat && coords.lng) {
      url = `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;
    }

    if (!url) {
      url = item.rest || item.restaurantLocation?.url || item.googleMapsUrl;
      if (typeof url !== 'string' || (!url.startsWith('http://') && !url.startsWith('https://'))) {
        url = null;
      }
    }

    if (!url) {
      const restName = item?.restaurantName || (typeof item?.rest === 'string' && !item?.rest.startsWith('http') ? item.rest : '');
      const restAddr = item?.restaurantAddress || item?.restaurantLocation?.address || '';
      const queryStr = [restName, restAddr].filter(Boolean).join(', ');
      if (queryStr) {
        url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryStr)}`;
      }
    }

    if (!url) {
      customAlert('Error', 'Google Map link or coordinates are not available for this restaurant');
      return;
    }

    openUrlInBrowserOrApp(url);
  };

  const handleAcceptOrder = async (order) => {
    if (updating) return;
    setUpdating(true);
    try {
      const deliveryBoyId = await AsyncStorage.getItem('userid');
      const deliveryBoyName = await AsyncStorage.getItem('name');
      const deliveryBoyPhone = await AsyncStorage.getItem('phone');

      if (!deliveryBoyId || !deliveryBoyName || !deliveryBoyPhone) {
        setErrorModalMessage('Delivery partner profile details not found. Please log in again.');
        setErrorModalVisible(true);
        return;
      }

      // Check locally if there's an active order first
      if (hasActiveOrder) {
        setErrorModalMessage('You already have an active order.\n\nPlease complete your current order before accepting a new one.');
        setErrorModalVisible(true);
        return;
      }

      // Send atomic POST accept request to server
      const targetOrderId = order._id || order.orderId || order.id;
      const response = await fetch(`${API_URL}/api/acceptedorders/${targetOrderId}/accept`, {
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
        data = { message: 'Server returned an invalid response. Please try again.' };
      }

      // Determine if assignment was successful for THIS delivery partner
      const assignedBoyId = data.deliveryBoyId || data.order?.deliveryBoyId || data.deliveryBoyUserid || data.driverId;
      const isAssignedToOther = assignedBoyId && String(assignedBoyId) !== String(deliveryBoyId);
      const isAlreadyAcceptedMsg = data.message && (
        data.message.toLowerCase().includes('already accepted') ||
        data.message.toLowerCase().includes('already taken') ||
        data.message.toLowerCase().includes('other delivery boy')
      );

      if (response.ok && !isAssignedToOther && data.success !== false && !data.isAlreadyAccepted) {
        // Successfully accepted by THIS delivery partner
        setOrders((prev) => prev.filter(o => o._id !== order._id && o.orderId !== order.orderId));
        setHasActiveOrder(true);
        DeviceEventEmitter.emit('stopOrderSound');
        DeviceEventEmitter.emit('refreshOrdersCount');
        setTimeout(() => {
          router.replace('/liveorders');
        }, 0);
      } else {
        // Order was already accepted by another driver (409 Conflict, 400, or payload conflict)
        if (
          response.status === 409 ||
          response.status === 400 ||
          isAssignedToOther ||
          isAlreadyAcceptedMsg ||
          data.isAlreadyAccepted === true
        ) {
          setErrorModalMessage("sorry the order was already accepted by other delivery boy\n\nbetter luck next time");
        } else {
          setErrorModalMessage(data.message || 'Failed to accept order.');
        }
        setErrorModalVisible(true);
        fetchOrders();
      }
    } catch (error) {
      console.error('Failed to accept order:', error);
      setErrorModalMessage('Network error. Please check your connection and try again.');
      setErrorModalVisible(true);
      fetchOrders();
    } finally {
      setUpdating(false);
    }
  };

  const promptRejectOrder = (order) => {
    setSelectedOrderToReject(order);
    setRejectModalVisible(true);
  };

  const cancelRejectOrder = () => {
    setRejectModalVisible(false);
    setSelectedOrderToReject(null);
  };

  const confirmRejectOrder = async () => {
    if (!selectedOrderToReject) return;
    const orderToReject = selectedOrderToReject;
    setRejectModalVisible(false);
    setSelectedOrderToReject(null);
    await handleRejectOrder(orderToReject);
  };

  const handleRejectOrder = async (order) => {
    if (updating) return;
    setUpdating(true);
    try {
      const userId = await AsyncStorage.getItem('userid');
      if (!userId) {
        setErrorModalMessage('Delivery boy ID not found in local storage. Please log in again.');
        setErrorModalVisible(true);
        return;
      }

      const targetOrderId = order._id || order.orderId || order.id;
      if (!targetOrderId) {
        setErrorModalMessage('Invalid order ID.');
        setErrorModalVisible(true);
        return;
      }

      let response = await fetch(`${API_URL}/api/acceptedorders/${targetOrderId}/reject`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deliveryBoyId: userId }),
      });

      if (response.status === 404 || response.status === 405) {
        response = await fetch(`${API_URL}/api/acceptedorders/${targetOrderId}/reject`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ deliveryBoyId: userId }),
        });
      }

      if (response.ok) {
        await stopOrderSound();
        DeviceEventEmitter.emit('stopOrderSound');
        fetchOrders(); // Refresh to remove the rejected order from view
      } else {
        let errorData = {};
        try {
          const text = await response.text();
          errorData = JSON.parse(text);
        } catch (_e) {
          errorData = { message: 'Server is starting up or returned an invalid response. Please try again in a few seconds.' };
        }
        setErrorModalMessage(errorData.message || 'Failed to reject order');
        setErrorModalVisible(true);
      }
    } catch (error) {
      console.error('Failed to reject order:', error);
      setErrorModalMessage('Network error. Please try again.');
      setErrorModalVisible(true);
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
          <Text style={styles.detailValue}>
            {(() => {
              const dist = item.deliveryDistance ?? item.distance ?? item.location?.distanceText;
              if (dist === undefined || dist === null || dist === '') return 'N/A';
              if (typeof dist === 'number') return `${dist} km`;
              return `${dist}`;
            })()}
          </Text>
        </View>

        {/* Card Row: Delivery Fee */}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Delivery fee</Text>
          <Text style={styles.detailSeparator}>-</Text>
          <Text style={styles.detailValue}>₹ {item.deliveryFee ?? item.deliveryCharge ?? item.deliverycharges ?? item.amount ?? item.total ?? 0}</Text>
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
            onPress={() => promptRejectOrder(item)}
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
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Rejection Confirmation Modal */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={cancelRejectOrder}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContainer}>
            <View style={styles.confirmModalIconCircle}>
              <Ionicons name="warning-outline" size={36} color="#FFFFFF" />
            </View>
            <Text style={styles.confirmModalTitle}>Reject Order?</Text>
            <Text style={styles.confirmModalMessageText}>
              Are you sure you want to reject this order?
            </Text>
            <View style={styles.confirmModalButtonRow}>
              <TouchableOpacity
                style={[styles.confirmModalButton, styles.confirmCancelButton]}
                activeOpacity={0.8}
                onPress={cancelRejectOrder}
              >
                <Text style={styles.confirmCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmModalButton, styles.confirmRejectButton]}
                activeOpacity={0.8}
                onPress={confirmRejectOrder}
              >
                <Text style={styles.confirmRejectButtonText}>Reject</Text>
              </TouchableOpacity>
            </View>
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
    paddingBottom: 110,
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
  confirmModalContainer: {
    width: '85%',
    maxWidth: 340,
    backgroundColor: '#FAF9F6',
    borderRadius: 28,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  confirmModalIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#CE3A31',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2A3037',
    marginBottom: 10,
    textAlign: 'center',
  },
  confirmModalMessageText: {
    fontSize: 15,
    color: '#4A5568',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  confirmModalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmModalButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmCancelButton: {
    backgroundColor: '#EAE5D9',
    borderWidth: 1,
    borderColor: '#DCD5C7',
  },
  confirmCancelButtonText: {
    color: '#2A3037',
    fontSize: 15,
    fontWeight: '700',
  },
  confirmRejectButton: {
    backgroundColor: '#CE3A31',
  },
  confirmRejectButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
