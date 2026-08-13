import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LoadingOverlay } from '@/components/loading-overlay';
import { API_URL } from '@/constants/api';

export default function MyReviewsScreen() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReviews = async () => {
    try {
      const storedId = await AsyncStorage.getItem('userid');
      if (!storedId) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/deliveryboy/${storedId}/reviews`);
      if (response.ok) {
        let data = [];
        try {
          const text = await response.text();
          data = JSON.parse(text);
        } catch (_e) {
          console.error('Failed to parse reviews JSON');
        }
        setReviews(Array.isArray(data) ? data : []);
      } else {
        console.error('Failed to fetch reviews:', response.status);
      }
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchReviews();
  };

  const formatReviewDate = (dateStr) => {
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
      hours = hours ? hours : 12;

      return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
    } catch (_error) {
      return 'N/A';
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    const maxStars = 5;
    const activeRating = Math.max(0, Math.min(5, Math.round(rating || 0)));

    for (let i = 1; i <= maxStars; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= activeRating ? 'star' : 'star-outline'}
          size={16}
          color="#B58A55"
          style={{ marginRight: 2 }}
        />
      );
    }
    return <View style={styles.starRow}>{stars}</View>;
  };

  const calculateAverageRating = () => {
    if (!reviews || reviews.length === 0) return '0.0';
    let total = 0;
    let count = 0;
    reviews.forEach(item => {
      const r = Number(item.deliveryBoyRating || 0);
      if (r > 0) {
        total += r;
        count++;
      }
    });
    return count > 0 ? (total / count).toFixed(1) : '0.0';
  };

  const renderReviewItem = ({ item }) => {
    const rating = Number(item.deliveryBoyRating || 0);
    const reviewText = item.deliveryBoyReview ? String(item.deliveryBoyReview).trim() : '';
    const hasReviewText = reviewText.length > 0;
    const orderId = item.orderId || 'ORD-N/A';
    const dateStr = item.createdAt;

    return (
      <View style={styles.reviewCard}>
        {/* Card Header: Order ID and Rating */}
        <View style={styles.cardHeader}>
          <View style={styles.orderIdContainer}>
            <Ionicons name="receipt-outline" size={16} color="#2A3037" />
            <Text style={styles.orderIdText}>{orderId}</Text>
          </View>
          {renderStars(rating)}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Card Body: Review Text */}
        <View style={styles.cardBody}>
          <Text style={hasReviewText ? styles.reviewText : styles.noReviewText}>
            {hasReviewText ? reviewText : 'no review given by customer'}
          </Text>
        </View>

        {/* Card Footer: Date and Time */}
        <View style={styles.cardFooter}>
          <Ionicons name="calendar-outline" size={13} color="#5A5550" />
          <Text style={styles.dateText}>{formatReviewDate(dateStr)}</Text>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="star-outline" size={64} color="#C4BEB3" />
        <Text style={styles.emptyTitle}>No Reviews Yet</Text>
        <Text style={styles.emptySubtitle}>Customer reviews for completed deliveries will appear here.</Text>
      </View>
    );
  };

  const avgRating = calculateAverageRating();

  const renderHeader = () => {
    return (
      <View style={styles.headerContainer}>
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.backButton}
            activeOpacity={0.8}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color="#000000" />
          </TouchableOpacity>

          <View style={styles.headerTitleBadge}>
            <Ionicons name="star" size={18} color="#2A3037" />
            <Text style={styles.headerTitleText}>My Reviews</Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        {reviews.length > 0 && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryLeft}>
              <Text style={styles.averageScoreText}>{avgRating}</Text>
              <View style={styles.summaryStarsRow}>
                {renderStars(Math.round(Number(avgRating)))}
              </View>
            </View>
            <View style={styles.summaryRight}>
              <Text style={styles.totalReviewsCount}>{reviews.length}</Text>
              <Text style={styles.totalReviewsLabel}>Customer Reviews</Text>
            </View>
          </View>
        )}
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
          data={reviews}
          renderItem={renderReviewItem}
          keyExtractor={(item, index) => item._id || item.id || `review-${index}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderHeader}
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
      </SafeAreaView>
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
  headerContainer: {
    marginBottom: 16,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 20,
    marginBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DCD5C7',
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
    backgroundColor: '#DCD5C7',
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
    width: 44,
  },
  summaryCard: {
    backgroundColor: '#EAE5D9',
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#DCD5C7',
    marginBottom: 8,
  },
  summaryLeft: {
    alignItems: 'flex-start',
  },
  averageScoreText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#2A3037',
    lineHeight: 36,
  },
  summaryStarsRow: {
    marginTop: 4,
  },
  summaryRight: {
    alignItems: 'flex-end',
  },
  totalReviewsCount: {
    fontSize: 26,
    fontWeight: '700',
    color: '#B58A55',
  },
  totalReviewsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5A5550',
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  reviewCard: {
    backgroundColor: '#DCD5C7',
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
    gap: 6,
  },
  orderIdText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2A3037',
  },
  starRow: {
    flexDirection: 'row',
  },
  divider: {
    height: 1,
    backgroundColor: '#FAF9F6',
    marginVertical: 12,
  },
  cardBody: {
    marginBottom: 12,
  },
  reviewText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2A3037',
    lineHeight: 20,
  },
  noReviewText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#5A5550',
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 12,
    color: '#5A5550',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
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
