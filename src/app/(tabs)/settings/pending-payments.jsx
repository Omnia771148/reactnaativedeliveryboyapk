import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';
import { LoadingOverlay } from '@/components/loading-overlay';

export default function PendingPaymentsScreen() {
  const [pendingData, setPendingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPendingPayments = useCallback(async () => {
    try {
      const storedId = await AsyncStorage.getItem('userid');
      if (!storedId) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/deliveryboy/${storedId}/pendingpayments`);
      if (response.ok) {
        const text = await response.text();
        let data = null;
        try {
          data = JSON.parse(text);
        } catch (_e) {
          console.error('Failed to parse pending payments JSON');
        }
        if (data) {
          setPendingData(data);
        }
      } else {
        console.error('Failed to fetch pending payments:', response.status);
      }
    } catch (error) {
      console.error('Error fetching pending payments:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingPayments();
  }, [fetchPendingPayments]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPendingPayments();
  };

  const formatAmount = (val) => {
    const num = Number(val || 0);
    return num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (item) => {
    if (item.date) return item.date;
    const rawDate = item.createdAt || item.timestamp;
    const d = rawDate ? new Date(rawDate) : new Date();
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatTime = (item) => {
    if (item.time) return item.time;
    const rawDate = item.createdAt || item.timestamp;
    const d = rawDate ? new Date(rawDate) : new Date();
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
  };

  const deliveryChargesVal = pendingData?.deliverycharges ?? pendingData?.deliveryCharge ?? 0;
  const transactionsList = (pendingData?.transactions && Array.isArray(pendingData.transactions)) ? pendingData.transactions : [];
  const hasTransactions = transactionsList.length > 0;
  const transactionCount = transactionsList.length;

  if (loading) {
    return <LoadingOverlay visible={true} />;
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        
        {/* Header Bar */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            activeOpacity={0.8}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={22} color="#000000" />
          </TouchableOpacity>

          <View style={styles.headerBadge}>
            <Ionicons name="card-outline" size={20} color="#2A3037" />
            <Text style={styles.headerBadgeText}>Payments History</Text>
          </View>

          {/* Placeholder for header symmetry */}
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#B58A55']}
              tintColor="#B58A55"
            />
          }
        >
          {/* Main Dark Pending Payment Card */}
          <View style={styles.mainCard}>
            {/* Card Header Row */}
            <View style={styles.cardHeaderRow}>
              <View style={styles.clockIconCircle}>
                <Ionicons name="time" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.cardTitle}>Pending Payment</Text>
            </View>

            {/* Inner Dark Box for Grand Total */}
            <View style={styles.innerTotalBox}>
              <Text style={styles.grandTotalLabel}>GRAND TOTAL</Text>
              <Text style={styles.grandTotalValue}>₹{formatAmount(deliveryChargesVal)}</Text>
            </View>

            {/* Card Footer Row */}
            <View style={styles.cardFooterRow}>
              <View style={styles.clearanceBadge}>
                <Text style={styles.clearanceBadgeText}>• Pending Clearance</Text>
              </View>
              <Text style={styles.transactionCountText}>
                {transactionCount} {transactionCount === 1 ? 'Transaction' : 'Transactions'}
              </Text>
            </View>
          </View>

          {/* Transactions Section - Displayed if and only if transactions array exists and has items */}
          {hasTransactions && (
            <View style={styles.transactionsSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Transactions</Text>
                <Text style={styles.itemCountText}>
                  {transactionCount} {transactionCount === 1 ? 'item' : 'items'}
                </Text>
              </View>

              {transactionsList.map((item, index) => (
                <View key={item.transactionId || item.id || item._id || index} style={styles.transactionCard}>
                  {/* Top Content Row */}
                  <View style={styles.txTopRow}>
                    <View style={styles.txIconCircle}>
                      <Ionicons name="swap-horizontal" size={18} color="#FFFFFF" />
                    </View>

                    <View style={styles.txDetailsGroup}>
                      <Text style={styles.txLabel}>TRANSACTION ID</Text>
                      <Text style={styles.txIdText}>{item.transactionId || item.id || item._id || 'N/A'}</Text>
                    </View>

                    <Text style={styles.txAmountText}>₹{formatAmount(item.amount)}</Text>
                  </View>

                  <View style={styles.txDivider} />

                  {/* Bottom Pills Row */}
                  <View style={styles.txBottomRow}>
                    <View style={styles.pillContainer}>
                      <Ionicons name="calendar-outline" size={13} color="#666666" />
                      <Text style={styles.pillText}>{formatDate(item)}</Text>
                    </View>

                    <View style={styles.pillContainer}>
                      <Ionicons name="time-outline" size={13} color="#666666" />
                      <Text style={styles.pillText}>{formatTime(item)}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6', // Off-white cream page background matching screenshot
  },
  safeArea: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 12,
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAE5D9', // Sand/beige pill background matching screenshot header
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 26,
    gap: 8,
  },
  headerBadgeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2A3037',
    letterSpacing: 0.3,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },

  /* Main Card Styles */
  mainCard: {
    backgroundColor: '#1E1E1E', // Dark charcoal/black card container
    borderRadius: 26,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  clockIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#CE3A31', // Red clock icon circle matching screenshot
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  innerTotalBox: {
    backgroundColor: '#2D2D2D', // Inner darker card container for grand total
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  grandTotalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8E8882',
    letterSpacing: 1,
    marginBottom: 6,
  },
  grandTotalValue: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clearanceBadge: {
    backgroundColor: 'rgba(206, 58, 49, 0.25)', // Subtle translucent red pill badge
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  clearanceBadgeText: {
    color: '#FF8A80',
    fontSize: 13,
    fontWeight: '700',
  },
  transactionCountText: {
    color: '#B3B3B3',
    fontSize: 14,
    fontWeight: '600',
  },

  /* Transactions Section Styles */
  transactionsSection: {
    marginTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2A3037',
  },
  itemCountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8882',
  },

  /* Individual Transaction Card */
  transactionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  txTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E1E1E', // Dark circle avatar icon
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  txDetailsGroup: {
    flex: 1,
  },
  txLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8882',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  txIdText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2A3037',
  },
  txAmountText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#CE3A31', // Reddish price color matching screenshot
  },
  txDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 12,
  },
  txBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
  },
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F4F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 6,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A4A4A',
  },
});
