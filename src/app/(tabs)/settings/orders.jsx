import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity, DeviceEventEmitter } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LoadingOverlay } from '@/components/loading-overlay';

// Resolve local server host address for dev environments
const getApiUrl = () => {
  const debuggerHost = Constants.expoConfig?.hostUri;
  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0];
    return `http://${ip}:5000`;
  }
  return 'http://localhost:5000';
};
const API_URL = getApiUrl();

export default function MyOrdersScreen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [prevOffset, setPrevOffset] = useState(0);
  const [tabBarVisible, setTabBarVisible] = useState(true);

  // Restore bottom tab bar visibility when leaving this screen
  useEffect(() => {
    return () => {
      DeviceEventEmitter.emit('showTabBar');
    };
  }, []);

  // Fetch completed orders list for active delivery boy
  const fetchOrders = async () => {
    try {
      const storedId = await AsyncStorage.getItem('userid');
      if (!storedId) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/deliveryboy/${storedId}/orders`);
      if (response.ok) {
        const data = await response.json();
        setOrders(data);
      } else {
        console.error('Failed to fetch orders:', response.status);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const handleScroll = (event) => {
    const currentOffset = event.nativeEvent.contentOffset.y;
    const diff = currentOffset - prevOffset;

    if (currentOffset <= 0) {
      if (!tabBarVisible) {
        DeviceEventEmitter.emit('showTabBar');
        setTabBarVisible(true);
      }
    } else if (diff > 15 && tabBarVisible) {
      DeviceEventEmitter.emit('hideTabBar');
      setTabBarVisible(false);
    } else if (diff < -15 && !tabBarVisible) {
      DeviceEventEmitter.emit('showTabBar');
      setTabBarVisible(true);
    }

    setPrevOffset(currentOffset);
  };

  // Date Formatter: converts ISO string to readable string "DD MMM YYYY, HH:MM AM/PM"
  const formatOrderDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'N/A';
      
      const day = String(date.getDate()).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      
      let hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // convert hour '0' to '12'
      
      return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
    } catch (_error) {
      return 'N/A';
    }
  };

  const renderOrderItem = ({ item }) => {
    return (
      <View style={styles.orderCard}>
        {/* Card Header: Receipt Icon, Order ID, and Status Badge */}
        <View style={styles.cardHeader}>
          <View style={styles.orderIdContainer}>
            <Ionicons name="receipt-outline" size={18} color="#2A3037" />
            <Text style={styles.orderIdText}>{item.orderId || 'ORD-UNKNOWN'}</Text>
          </View>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Completed</Text>
          </View>
        </View>

        {/* Divider line */}
        <View style={styles.divider} />

        {/* Card Body */}
        <View style={styles.cardBody}>
          {/* Order date */}
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={15} color="#8E8882" />
            <Text style={styles.detailText}>{formatOrderDate(item.orderDate || item.completedAt)}</Text>
          </View>

          {/* Restaurant name */}
          {item.restaurantName && (
            <View style={styles.detailRow}>
              <Ionicons name="restaurant-outline" size={15} color="#8E8882" />
              <Text style={styles.detailText}>{item.restaurantName}</Text>
            </View>
          )}

          {/* Delivery Charge Footer (Themed sand block) */}
          <View style={styles.chargeFooter}>
            <Text style={styles.chargeLabel}>DELIVERY CHARGE</Text>
            <Text style={styles.chargeValue}>Rs. {item.deliveryCharge || 0}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="clipboard-outline" size={64} color="#C4BEB3" />
        <Text style={styles.emptyTitle}>No Completed Orders</Text>
        <Text style={styles.emptySubtitle}>When you complete order deliveries, they will list here.</Text>
      </View>
    );
  };

  const renderHeader = () => {
    return (
      <View style={styles.headerBar}>
        <TouchableOpacity 
          style={styles.backButton} 
          activeOpacity={0.8}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color="#000000" />
        </TouchableOpacity>

        <View style={styles.headerTitleBadge}>
          <Ionicons name="bag-check" size={18} color="#2A3037" />
          <Text style={styles.headerTitleText}>My Orders</Text>
        </View>
        
        {/* Spacer to align title center */}
        <View style={styles.headerSpacer} />
      </View>
    );
  };

  if (loading) {
    return <LoadingOverlay visible={true} />;
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        
        <FlatList
          data={orders}
          renderItem={renderOrderItem}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={renderEmptyState}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={['#B58A55']}
                tintColor="#B58A55"
              />
            }
          />

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6', // Off-white cream page background
  },
  safeArea: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 20,
    marginBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
  },
  headerTitleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 30,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
    gap: 8,
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2A3037',
    letterSpacing: 0.5,
  },
  headerSpacer: {
    width: 44, // Align center helper spacer matching backButton width
  },
  loaderContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingSpinnerWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100, // Safe padding above bottom tab bar
  },
  orderCard: {
    backgroundColor: '#EAE5D9', // Matching the normal warm sand/beige tone
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderIdText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2A3037',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9', // Soft green background
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50', // Vibrant green dot
  },
  statusText: {
    fontSize: 11,
    color: '#2E7D32',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#FAF9F6',
    marginVertical: 12,
  },
  cardBody: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailText: {
    fontSize: 14,
    color: '#5A5550', // Darker gray for readability on sand background
    fontWeight: '500',
  },
  chargeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF9F6',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#EAE5D9',
  },
  chargeLabel: {
    fontSize: 11,
    color: '#8E8882',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  chargeValue: {
    fontSize: 15,
    color: '#B58A55', // Themed gold/sand color for pricing
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2A3037',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E8882',
    textAlign: 'center',
    lineHeight: 20,
  },
});
