import { BrandHeader } from '@/components/brand-header';
import { LoadingOverlay } from '@/components/loading-overlay';
import { API_URL } from '@/constants/api';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LiveOrdersScreen() {
  const navigation = useNavigation();
  const [userid, setUserid] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // OTP entry state (5 separate boxes)
  const [otp, setOtp] = useState(['', '', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState(null);
  const inputRefs = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)];

  // Custom alert modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState('success');
  const [modalMessage, setModalMessage] = useState('');

  // Pickup confirmation modal state
  const [pickupModalVisible, setPickupModalVisible] = useState(false);

  // Preparation time & live countdown timer state
  const [remainingTimeText, setRemainingTimeText] = useState('');
  const [isTimerOverdue, setIsTimerOverdue] = useState(false);

  const getPrepTimeVal = useCallback((order) => {
    if (!order) return null;
    let raw =
      order.preparationTime ??
      order.prepTime ??
      order.preparation_time ??
      order.prep_time ??
      order.cookingTime ??
      order.estimatedPreparationTime ??
      order.prepMinutes ??
      order.timeToPrepare ??
      order.estimatedTime;

    if (raw !== undefined && raw !== null && raw !== '') {
      const parsed = typeof raw === 'number' ? raw : parseInt(String(raw).match(/\d+/)?.[0] || '0', 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
      return raw;
    }

    if (order.estimatedPrepEndTime) {
      const end = new Date(order.estimatedPrepEndTime).getTime();
      const startStr = order.acceptedAt || order.orderDate || order.createdAt || order.updatedAt;
      const start = startStr ? new Date(startStr).getTime() : Date.now();
      if (!isNaN(end) && !isNaN(start) && end > start) {
        const diffMins = Math.round((end - start) / (60 * 1000));
        if (diffMins > 0) return diffMins;
      }
    }

    return null;
  }, []);

  useEffect(() => {
    if (!activeOrder) {
      setRemainingTimeText('');
      setIsTimerOverdue(false);
      return;
    }

    const rawPrep = getPrepTimeVal(activeOrder);
    let targetTime = null;

    if (activeOrder.estimatedPrepEndTime) {
      const parsedEnd = new Date(activeOrder.estimatedPrepEndTime).getTime();
      if (!isNaN(parsedEnd)) {
        targetTime = parsedEnd;
      }
    }

    if (!targetTime) {
      if (!rawPrep) {
        setRemainingTimeText('');
        setIsTimerOverdue(false);
        return;
      }

      let prepMinutes = null;
      if (typeof rawPrep === 'number' && !isNaN(rawPrep)) {
        prepMinutes = rawPrep;
      } else if (typeof rawPrep === 'string') {
        const match = rawPrep.match(/\d+/);
        if (match) {
          prepMinutes = parseInt(match[0], 10);
        }
      }

      if (!prepMinutes || isNaN(prepMinutes)) {
        setRemainingTimeText(String(rawPrep));
        setIsTimerOverdue(false);
        return;
      }

      const startStr = activeOrder.acceptedAt || activeOrder.orderDate || activeOrder.createdAt || activeOrder.updatedAt;
      const startTime = startStr ? new Date(startStr).getTime() : null;
      const baseTime = startTime && !isNaN(startTime) ? startTime : Date.now();
      targetTime = baseTime + prepMinutes * 60 * 1000;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const diffMs = targetTime - now;

      if (diffMs > 0) {
        const totalSec = Math.floor(diffMs / 1000);
        const mins = Math.floor(totalSec / 60);
        const secs = totalSec % 60;
        setRemainingTimeText(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
        setIsTimerOverdue(false);
      } else {
        setRemainingTimeText('00:00');
        setIsTimerOverdue(true);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [activeOrder, getPrepTimeVal]);

  const fetchActiveOrder = useCallback(async (userIdToUse) => {
    const id = userIdToUse || userid;
    if (!id) {
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${API_URL}/api/deliveryboy/${id}/activeorder`);
      if (response.ok) {
        let data = null;
        try {
          const text = await response.text();
          data = JSON.parse(text);
        } catch (_e) {
          console.error('Failed to parse active order JSON');
        }
        if (data) {
          setActiveOrder(data);
        }
      } else if (response.status === 404) {
        setActiveOrder(null);
      } else {
        console.error('Failed to fetch active order:', response.status);
      }
    } catch (error) {
      console.error('Error fetching active order:', error);
    } finally {
      setLoading(false);
    }
  }, [userid]);

  // Initial load
  useEffect(() => {
    const loadSessionAndData = async () => {
      try {
        const storedId = await AsyncStorage.getItem('userid');
        if (storedId) {
          setUserid(storedId);
          await fetchActiveOrder(storedId);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error loading session:', error);
        setLoading(false);
      }
    };
    loadSessionAndData();
  }, [fetchActiveOrder]);

  // Fetch data whenever screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Clear OTP inputs when navigating back to screen
      setOtp(['', '', '', '', '']);
      if (userid) {
        fetchActiveOrder(userid);
      } else {
        AsyncStorage.getItem('userid').then((storedId) => {
          if (storedId) {
            setUserid(storedId);
            fetchActiveOrder(storedId);
          }
        });
      }
    });
    return unsubscribe;
  }, [navigation, userid, fetchActiveOrder]);

  const openUrlInBrowserOrApp = async (url) => {
    console.log('openUrlInBrowserOrApp opening URL:', url);
    try {
      if (Platform.OS === 'web') {
        const win = window.open(url, '_blank');
        if (!win || win.closed || typeof win.closed === 'undefined') {
          window.location.href = url;
        }
      } else {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('Failed to open map URL:', error);
      if (Platform.OS === 'web') {
        window.location.href = url;
      } else {
        Alert.alert('Error', 'Cannot open Google Maps');
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

  const handleOpenMap = async () => {
    if (!activeOrder) return;

    let url = null;
    const coords = extractCoordinates(activeOrder.restaurantLocation || activeOrder);

    if (coords && coords.lat && coords.lng) {
      url = `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;
    }

    if (!url) {
      url = activeOrder.rest || activeOrder.restaurantLocation?.url || activeOrder.restaurantMapUrl;
      if (typeof url !== 'string' || (!url.startsWith('http://') && !url.startsWith('https://'))) {
        url = null;
      }
    }

    if (!url) {
      const restName = activeOrder.restaurantName || (typeof activeOrder.rest === 'string' && !activeOrder.rest.startsWith('http') ? activeOrder.rest : '');
      const restAddr = activeOrder.restaurantAddress || activeOrder.restaurantLocation?.address || '';
      const queryStr = [restName, restAddr].filter(Boolean).join(', ');
      if (queryStr) {
        url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryStr)}`;
      }
    }

    if (!url) {
      const msg = 'Restaurant map details or location are not available.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
      return;
    }

    openUrlInBrowserOrApp(url);
  };

  const handleOpenCustomerMap = async () => {
    if (!activeOrder) return;

    let lat = null;
    let lng = null;

    // Read userCoordinates object properties (lat and lng)
    if (activeOrder.userCoordinates && typeof activeOrder.userCoordinates === 'object') {
      lat = activeOrder.userCoordinates.lat;
      lng = activeOrder.userCoordinates.lng;
    }

    // In case userCoordinates was stored as stringified JSON
    if ((lat === undefined || lng === undefined || lat === null || lng === null) && typeof activeOrder.userCoordinates === 'string') {
      try {
        const parsed = JSON.parse(activeOrder.userCoordinates);
        lat = parsed.lat;
        lng = parsed.lng;
      } catch (e) { }
    }

    // Fallbacks for location object or root lat/lng
    if (lat === undefined || lng === undefined || lat === null || lng === null) {
      lat = activeOrder.location?.lat ?? activeOrder.lat;
      lng = activeOrder.location?.lng ?? activeOrder.lng;
    }

    if (lat === undefined || lng === undefined || lat === null || lng === null) {
      const errorMsg = 'userCoordinates object with lat and lng is missing in order data';
      if (Platform.OS === 'web') {
        window.alert(errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
      return;
    }

    // Generate Google Maps URL using exact userCoordinates lat and lng
    const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

    openUrlInBrowserOrApp(googleMapsUrl);
  };

  const processPickupOrder = async () => {
    if (!activeOrder || updating) return;

    setUpdating(true);
    try {
      const response = await fetch(`${API_URL}/api/acceptedbydeliveries/${activeOrder.orderId}/pickup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      let data = {};
      let rawText = '';
      try {
        rawText = await response.text();
        data = JSON.parse(rawText);
      } catch (_e) {
        const snippet = rawText ? rawText.trim().slice(0, 120) : 'Empty response';
        data = { message: `Server returned invalid response (Status: ${response.status}).\n\nPreview: ${snippet}` };
      }

      if (response.ok) {
        // Refresh local state to render OTP input layout
        await fetchActiveOrder(userid);
      } else {
        Alert.alert('Error', data.message || 'Failed to update order status.');
      }
    } catch (error) {
      console.error('Failed to pickup order:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const handlePickupOrder = () => {
    if (!activeOrder || updating) return;
    setPickupModalVisible(true);
  };

  const confirmPickupOrder = () => {
    setPickupModalVisible(false);
    processPickupOrder();
  };

  const handleOtpChange = (text, index) => {
    // Alphanumeric filters for OTP inputs
    const cleanText = text.replace(/[^a-zA-Z0-9]/g, '');
    const newOtp = [...otp];

    if (cleanText === '') {
      newOtp[index] = '';
      setOtp(newOtp);
      return;
    }

    newOtp[index] = cleanText.slice(-1); // Only store the last character typed
    setOtp(newOtp);

    // Auto-focus shifting logic
    if (index < 4 && inputRefs[index + 1]?.current) {
      inputRefs[index + 1].current.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    // Backward focus shifting on backspace
    if (e.nativeEvent.key === 'Backspace') {
      const newOtp = [...otp];
      if (otp[index] === '') {
        if (index > 0) {
          newOtp[index - 1] = '';
          setOtp(newOtp);
          if (inputRefs[index - 1]?.current) {
            inputRefs[index - 1].current.focus();
          }
        }
      } else {
        newOtp[index] = '';
        setOtp(newOtp);
        if (index > 0 && inputRefs[index - 1]?.current) {
          inputRefs[index - 1].current.focus();
        }
      }
    }
  };

  const handleCompleteOrder = async () => {
    const otpString = otp.join('');
    if (otpString.length < 5) {
      setModalType('error');
      setModalMessage('Please enter all 5 digits of the OTP.');
      setModalVisible(true);
      return;
    }

    setUpdating(true);
    try {
      const response = await fetch(`${API_URL}/api/acceptedbydeliveries/${activeOrder.orderId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ otp: otpString }),
      });

      let data = {};
      let rawText = '';
      try {
        rawText = await response.text();
        data = JSON.parse(rawText);
      } catch (_e) {
        const snippet = rawText ? rawText.trim().slice(0, 120) : 'Empty response';
        data = { message: `Server returned invalid response (Status: ${response.status}).\n\nPreview: ${snippet}` };
      }

      if (response.ok) {
        setModalType('success');
        setModalMessage('Order completed successfully!');
        setModalVisible(true);
      } else {
        setModalType('error');
        setModalMessage(data.message || 'otp is wrong');
        setModalVisible(true);
      }
    } catch (error) {
      console.error('Failed to complete order:', error);
      setModalType('error');
      setModalMessage('Network error. Please try again.');
      setModalVisible(true);
    } finally {
      setUpdating(false);
    }
  };

  const handleModalClose = async () => {
    setModalVisible(false);
    if (modalType === 'success') {
      setOtp(['', '', '', '', '']); // Clear input
      await fetchActiveOrder(userid); // Returns to empty state
      DeviceEventEmitter.emit('refreshOrdersCount');
      router.replace('/homepage');
    } else {
      // Focus back on first OTP box
      if (inputRefs[0]?.current) {
        inputRefs[0].current.focus();
      }
    }
  };

  const isOutForDelivery = activeOrder?.status === 'out for delivery';

  if (loading) {
    return <LoadingOverlay visible={true} />;
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Custom Header Bar */}
        <BrandHeader />

        {activeOrder ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {isOutForDelivery ? (
              // Phase 2: Customer Details & OTP Verification UI (Out for Delivery state)
              <View style={styles.mainCard}>

                {/* CUSTOMER DETAILS BLOCK */}
                <View style={[styles.block, styles.detailsBlock]}>
                  <Text style={styles.blockLabel}>Customer Details</Text>

                  <View style={styles.detailTextRow}>
                    <Text style={styles.detailTextLabel}>Order ID:</Text>
                    <Text style={styles.detailTextVal}>{activeOrder.orderId || 'N/A'}</Text>
                  </View>

                  <View style={styles.detailTextRow}>
                    <Text style={styles.detailTextLabel}>Name:</Text>
                    <Text style={styles.detailTextVal}>{activeOrder.userName || 'N/A'}</Text>
                  </View>

                  <View style={styles.detailTextRow}>
                    <Text style={styles.detailTextLabel}>Phone:</Text>
                    <TouchableOpacity
                      style={styles.phonePillButton}
                      activeOpacity={0.8}
                      onPress={() => Linking.openURL(`tel:${activeOrder.userPhone}`)}
                    >
                      <Ionicons name="call" size={14} color="#FFFFFF" style={styles.phoneIcon} />
                      <Text style={styles.phonePillText}>{activeOrder.userPhone || 'N/A'}</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.detailTextRow}>
                    <Text style={styles.detailTextLabel}>Address:</Text>
                    <Text style={styles.detailTextVal}>
                      {activeOrder.flatNo ? `${activeOrder.flatNo}, ` : ''}
                      {activeOrder.street ? `${activeOrder.street}, ` : ''}
                      {activeOrder.landmark ? `${activeOrder.landmark}\n` : ''}
                      {activeOrder.deliveryAddress || 'N/A'}
                    </Text>
                  </View>

                  <View style={styles.detailTextRow}>
                    <Text style={styles.detailTextLabel}>Location:</Text>
                    <TouchableOpacity
                      style={styles.locationPillButton}
                      activeOpacity={0.8}
                      onPress={handleOpenCustomerMap}
                    >
                      <Ionicons name="location" size={14} color="#FFFFFF" />
                      <Text style={styles.locationPillText}>VIEW IN MAP</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* CUSTOMER OTP BLOCK */}
                <View style={styles.block}>
                  <Text style={styles.otpSectionTitle}>Customer OTP</Text>

                  <View style={styles.otpRow}>
                    {otp.map((digit, index) => (
                      <TextInput
                        key={index}
                        ref={inputRefs[index]}
                        style={[
                          styles.otpInput,
                          focusedIndex === index && styles.otpInputFocused
                        ]}
                        maxLength={1}
                        value={digit}
                        onChangeText={(text) => handleOtpChange(text, index)}
                        onKeyPress={(e) => handleKeyPress(e, index)}
                        onFocus={() => setFocusedIndex(index)}
                        onBlur={() => setFocusedIndex(null)}
                        placeholder=""
                        keyboardType="default"
                        autoCapitalize="none"
                        autoCorrect={false}
                        selectTextOnFocus
                      />
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.completeButton,
                      (otp.join('').length < 5 || updating) && styles.disabledCompleteButton
                    ]}
                    activeOpacity={0.9}
                    onPress={handleCompleteOrder}
                    disabled={otp.join('').length < 5 || updating}
                  >
                    {updating ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.completeButtonText}>COMPLETE</Text>
                    )}
                  </TouchableOpacity>
                </View>

              </View>
            ) : (
              // Phase 1: Order Acceptance / Pickup details screen
              <View style={styles.mainCard}>
                {/* ORDER ID BLOCK */}
                <View style={styles.block}>
                  <Text style={styles.blockLabel}>ORDER ID</Text>
                  <Text style={styles.orderIdText}>{activeOrder.orderId || 'N/A'}</Text>
                </View>

                {/* RESTAURANT BLOCK */}
                <View style={styles.block}>
                  <Text style={styles.restaurantNameText}>
                    {activeOrder.restaurantName?.toUpperCase() || 'N/A'}
                  </Text>
                  <TouchableOpacity
                    style={styles.mapButton}
                    activeOpacity={0.8}
                    onPress={handleOpenMap}
                  >
                    <Ionicons name="location" size={14} color="#FFFFFF" />
                    <Text style={styles.mapButtonText}>VIEW IN MAP</Text>
                  </TouchableOpacity>
                </View>

                {/* PREPARATION TIME BLOCK */}
                <View style={styles.block}>
                  <Text style={styles.blockLabel}>PREPARATION TIME</Text>
                  <View style={styles.timerRow}>
                    <Ionicons name="time-outline" size={24} color={isTimerOverdue ? "#CE3A31" : "#D97706"} />
                    <Text style={[styles.timerValueText, isTimerOverdue && styles.timerOverdueText]}>
                      {remainingTimeText || (getPrepTimeVal(activeOrder) ? `${getPrepTimeVal(activeOrder)} mins` : 'N/A')}
                    </Text>
                  </View>
                  {getPrepTimeVal(activeOrder) ? (
                    <Text style={styles.prepSubtext}>
                      {isTimerOverdue ? 'Order ready / time completed' : `Estimated Prep: ${getPrepTimeVal(activeOrder)} mins`}
                    </Text>
                  ) : null}
                </View>

                {/* DELIVERY FEE BLOCK */}
                <View style={styles.block}>
                  <Text style={styles.blockLabel}>DELIVERY FEE</Text>
                  <Text style={styles.feeText}>₹{activeOrder.deliveryFee ?? activeOrder.deliveryCharge ?? 0}</Text>
                </View>

                {/* ITEMS TO PICKUP BLOCK */}
                <View style={[styles.block, styles.itemsBlock]}>
                  <Text style={styles.itemsLabel}>ITEMS TO PICKUP</Text>
                  <View style={styles.divider} />
                  {activeOrder.items && activeOrder.items.map((item, idx) => (
                    <View key={item._id || idx} style={styles.itemRow}>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.itemQty}>
                        x{item.quantity || 1}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* ACTION BUTTON */}
                <TouchableOpacity
                  style={[
                    styles.pickupButton,
                    updating && styles.disabledPickupButton
                  ]}
                  activeOpacity={0.9}
                  onPress={handlePickupOrder}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.pickupButtonText}>PICKUP ORDER</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        ) : (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="cart-outline" size={48} color="#B58A55" />
            </View>
            <Text style={styles.emptyTitle}>No Active Orders</Text>
            <Text style={styles.emptySubtitle}>
              You don&apos;t have any active deliveries accepted at the moment.
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              activeOpacity={0.9}
              onPress={() => router.replace('/orders')}
            >
              <Text style={styles.emptyButtonText}>View Available Orders</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>

      {/* PICKUP CONFIRMATION CUSTOM MODAL */}
      <Modal
        visible={pickupModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPickupModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPickupModalVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.pickupModalContainer}
            onPress={(e) => e.stopPropagation?.()}
          >
            <View style={styles.pickupModalIconCircle}>
              <Ionicons name="restaurant" size={32} color="#FFFFFF" />
            </View>
            <Text style={styles.pickupModalTitleText}>
              Are you at the restaurant?
            </Text>
            <Text style={styles.pickupModalMessageText}>
              Please confirm that you are at the restaurant to pick up this order.
            </Text>

            {(activeOrder?.restaurantName || activeOrder?.vendorName || activeOrder?.restaurant_name) && (
              <View style={styles.pickupModalBadge}>
                <Ionicons name="location-sharp" size={16} color="#2E7D32" />
                <Text style={styles.pickupModalBadgeText} numberOfLines={1}>
                  {activeOrder?.restaurantName || activeOrder?.vendorName || activeOrder?.restaurant_name}
                </Text>
              </View>
            )}

            <View style={styles.pickupModalButtonRow}>
              <TouchableOpacity
                style={styles.pickupModalCancelButton}
                activeOpacity={0.8}
                onPress={() => setPickupModalVisible(false)}
              >
                <Text style={styles.pickupModalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.pickupModalConfirmButton}
                activeOpacity={0.8}
                onPress={confirmPickupOrder}
              >
                <Text style={styles.pickupModalConfirmButtonText}>Yes, Confirm</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* CUSTOM POPUP MODAL (Success/Error states) */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleModalClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={[
              styles.modalIconCircle,
              modalType === 'success' ? styles.modalIconCircleSuccess : styles.modalIconCircleError
            ]}>
              <Ionicons
                name={modalType === 'success' ? "checkmark" : "close"}
                size={36}
                color="#FFFFFF"
              />
            </View>
            <Text style={styles.modalMessageText}>
              {modalMessage}
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              activeOpacity={0.8}
              onPress={handleModalClose}
            >
              <Text style={styles.modalButtonText}>
                {modalType === 'success' ? 'OK' : 'Try Again'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Loading Overlay placed at the bottom so it renders on top of all sibling components */}
      <LoadingOverlay visible={updating} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  safeArea: {
    flex: 1,
  },

  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 110,
  },
  mainCard: {
    backgroundColor: '#EAE5D9', // Matching the warm sand/beige card frame tone
    borderRadius: 24,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#DCD5C7',
  },
  block: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  blockLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8E8882',
    letterSpacing: 1,
    marginBottom: 4,
    textAlign: 'center',
  },
  orderIdText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#2A3037',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  restaurantNameText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2A3037',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  mapButton: {
    backgroundColor: '#2E7D32', // Emerald green
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  mapButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 4,
  },
  timerValueText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#D97706',
    letterSpacing: 1.5,
  },
  timerOverdueText: {
    color: '#CE3A31',
  },
  prepSubtext: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8882',
    marginTop: 2,
    textAlign: 'center',
  },
  feeText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#2E7D32', // Rich green color
    textAlign: 'center',
  },
  itemsBlock: {
    alignItems: 'stretch', // Fill width for divider and list
    paddingBottom: 16,
  },
  itemsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2A3037',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 8,
  },
  divider: {
    height: 1.5,
    backgroundColor: '#8E8882',
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2A3037',
    flex: 1,
    marginRight: 10,
  },
  itemQty: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  pickupButton: {
    backgroundColor: '#2E7D32', // Darker forest/emerald green
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 3,
  },
  disabledPickupButton: {
    backgroundColor: '#81C784', // Lighter disabled green
    opacity: 0.9,
  },
  pickupButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  emptyIconContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#EAE5D9',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2A3037',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#8E8882',
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyButton: {
    backgroundColor: '#2A3037', // Black
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  // Phase 2 styles
  detailsBlock: {
    alignItems: 'stretch',
    paddingBottom: 16,
  },
  detailTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailTextLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8E8882',
    width: 95,
  },
  detailTextVal: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2A3037',
    flex: 1,
  },
  phonePillButton: {
    backgroundColor: '#2E7D32', // Matches location button green color
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    gap: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  phoneIcon: {
    transform: [{ rotate: '90deg' }], // rotate phone icon for calling feel
  },
  phonePillText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  locationPillButton: {
    backgroundColor: '#2E7D32', // Green map button color
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    gap: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  locationPillText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  otpSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2A3037',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 14,
    width: '100%',
  },
  otpInput: {
    width: 44,
    height: 48,
    borderBottomWidth: 2.5,
    borderBottomColor: '#B58A55',
    backgroundColor: 'transparent',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    color: '#2A3037',
    padding: 0,
  },
  otpInputFocused: {
    borderBottomColor: '#2E7D32',
    borderBottomWidth: 3,
  },
  completeButton: {
    backgroundColor: '#2E7D32', // Emerald green
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    width: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  disabledCompleteButton: {
    backgroundColor: '#81C784',
    opacity: 0.9,
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // Modal styles
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
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIconCircleSuccess: {
    backgroundColor: '#2E7D32', // Emerald green background
  },
  modalIconCircleError: {
    backgroundColor: '#EF4444', // Red background
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
    backgroundColor: '#000000', // Black button matching screenshot
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

  // Pickup modal custom styles
  pickupModalContainer: {
    width: '88%',
    maxWidth: 340,
    backgroundColor: '#FAF9F6',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  pickupModalIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  pickupModalTitleText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2A3037',
    textAlign: 'center',
    marginBottom: 8,
  },
  pickupModalMessageText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8882',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
    paddingHorizontal: 6,
  },
  pickupModalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 20,
    gap: 6,
    maxWidth: '90%',
  },
  pickupModalBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2E7D32',
  },
  pickupModalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  pickupModalCancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EAE5D9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickupModalCancelButtonText: {
    color: '#2A3037',
    fontSize: 15,
    fontWeight: '700',
  },
  pickupModalConfirmButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  pickupModalConfirmButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
