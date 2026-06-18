import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Linking, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useNavigation } from 'expo-router';
import { LoadingOverlay } from '@/components/loading-overlay';
import { API_URL } from '@/constants/api';

export default function LiveOrdersScreen() {
  const navigation = useNavigation();
  const [userid, setUserid] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  
  // OTP entry state (5 separate boxes)
  const [otp, setOtp] = useState(['', '', '', '', '']);
  const inputRefs = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)];

  // Custom alert modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState('success'); // 'success' or 'error'
  const [modalMessage, setModalMessage] = useState('');

  const fetchActiveOrder = useCallback(async (userIdToUse) => {
    const id = userIdToUse || userid;
    if (!id) {
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${API_URL}/api/deliveryboy/${id}/activeorder`);
      if (response.ok) {
        const data = await response.json();
        setActiveOrder(data);
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

  const handleOpenMap = async () => {
    if (!activeOrder) return;
    
    let lat = activeOrder.restaurantLocation?.lat;
    let lng = activeOrder.restaurantLocation?.lng;
    let url = activeOrder.rest;

    if (lat && lng) {
      url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    }

    if (!url) {
      Alert.alert('Error', 'Google Map link or coordinates are not available');
      return;
    }

    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Error', 'Cannot open the Google Map link');
      console.error('Failed to open map URL:', error);
    }
  };

  const handlePickupOrder = async () => {
    if (!activeOrder || updating) return;

    setUpdating(true);
    try {
      const response = await fetch(`${API_URL}/api/acceptedbydeliveries/${activeOrder.orderId}/pickup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'Order status updated to Out for Delivery.');
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

  const handleOtpChange = (text, index) => {
    // Alphanumeric filters for OTP inputs
    const cleanText = text.replace(/[^a-zA-Z0-9]/g, '');
    const newOtp = [...otp];
    newOtp[index] = cleanText.slice(-1); // Only store the last character typed
    setOtp(newOtp);

    // Auto-focus shifting logic
    if (cleanText && index < 4) {
      inputRefs[index + 1].current.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    // Backward focus shifting on backspace
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs[index - 1].current.focus();
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

      const data = await response.json();
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
        <View style={styles.headerBar}>
          <View style={styles.headerCircle}>
            <Image
              source={require('@/assets/images/logo-L.png')}
              style={styles.headerLogo}
              contentFit="contain"
            />
          </View>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>LEEVON</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

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
                      <Ionicons name="call" size={14} color="#E55B49" style={styles.phoneIcon} />
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
                </View>

                {/* CUSTOMER OTP BLOCK */}
                <View style={styles.block}>
                  <Text style={styles.otpSectionTitle}>Customer OTP</Text>
                  
                  <View style={styles.otpRow}>
                    {otp.map((digit, index) => (
                      <TextInput
                        key={index}
                        ref={inputRefs[index]}
                        style={styles.otpInput}
                        maxLength={1}
                        value={digit}
                        onChangeText={(text) => handleOtpChange(text, index)}
                        onKeyPress={(e) => handleKeyPress(e, index)}
                        placeholder="-"
                        placeholderTextColor="#C4BEB3"
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

                {/* DELIVERY FEE BLOCK */}
                <View style={styles.block}>
                  <Text style={styles.blockLabel}>DELIVERY FEE</Text>
                  <Text style={styles.feeText}>₹{activeOrder.deliveryCharge || 0}</Text>
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCD5C7', // Sand/Beige header bar background
    height: 54,
    borderRadius: 27,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
    paddingHorizontal: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  headerCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLogo: {
    width: 24,
    height: 24,
  },
  headerTitleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 36,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    fontStyle: 'italic',
    color: '#2A3037',
    letterSpacing: 2,
  },
  headerSpacer: {},
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
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
    width: 70,
  },
  detailTextVal: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2A3037',
    flex: 1,
  },
  phonePillButton: {
    backgroundColor: '#2EBD6B', // Soft green background
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
    height: 44,
    borderWidth: 1.5,
    borderColor: '#DCD5C7',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    color: '#000000',
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
});
