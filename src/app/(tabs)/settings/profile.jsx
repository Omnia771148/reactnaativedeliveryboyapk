import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, DeviceEventEmitter } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LoadingOverlay } from '@/components/loading-overlay';
import { API_URL } from '@/constants/api';

export default function ProfileScreen() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [prevOffset, setPrevOffset] = useState(0);
  const [tabBarVisible, setTabBarVisible] = useState(true);

  // Ensure tab bar resets to visible when leaving this screen
  useEffect(() => {
    return () => {
      DeviceEventEmitter.emit('showTabBar');
    };
  }, []);

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

  // Fetch full user data from MongoDB deliveryboyusers collection
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const storedId = await AsyncStorage.getItem('userid');
        if (!storedId) {
          setLoading(false);
          return;
        }

        const response = await fetch(`${API_URL}/api/users/${storedId}`);
        if (response.ok) {
          const data = await response.json();
          setUser(data);
        } else {
          console.error('Failed to fetch user profile:', response.status);
        }
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  // Format date helper: returns "DD/MM/YYYY" format
  const formatDate = (isoString) => {
    if (!isoString) return 'N/A';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return 'N/A';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (_error) {
      return 'N/A';
    }
  };

  if (loading) {
    return <LoadingOverlay visible={true} />;
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {/* Header Navigation Bar */}
          <View style={styles.headerBar}>
            <TouchableOpacity 
              style={styles.backButton} 
              activeOpacity={0.8}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={20} color="#000000" />
            </TouchableOpacity>

            <View style={styles.headerTitleBadge}>
              <Ionicons name="person" size={18} color="#2A3037" />
              <Text style={styles.headerTitleText}>My Profile</Text>
            </View>
            
            {/* Spacer to align title center */}
            <View style={styles.headerSpacer} />
          </View>

          {/* Main Card (Sand/Beige Colored Container) */}
          <View style={styles.detailsCard}>
            
            {/* SECTION 1: PERSONAL DETAILS */}
            <Text style={styles.sectionHeader}>PERSONAL DETAILS</Text>
            
            {/* Full Name */}
            <View style={styles.detailItem}>
              <View style={styles.iconContainer}>
                <Ionicons name="person-outline" size={20} color="#000000" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.label}>FULL NAME</Text>
                <Text style={styles.value}>{user?.name || 'N/A'}</Text>
              </View>
            </View>

            {/* Phone */}
            <View style={styles.detailItem}>
              <View style={styles.iconContainer}>
                <Ionicons name="call-outline" size={20} color="#000000" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.label}>PHONE</Text>
                <Text style={styles.value}>{user?.phone || 'N/A'}</Text>
              </View>
            </View>

            {/* Email */}
            <View style={styles.detailItem}>
              <View style={styles.iconContainer}>
                <Ionicons name="mail-outline" size={20} color="#000000" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.label}>EMAIL</Text>
                <Text style={styles.value}>{user?.email || 'N/A'}</Text>
              </View>
            </View>

            {/* Partner ID */}
            <View style={styles.detailItem}>
              <View style={styles.iconContainer}>
                <Text style={styles.hashIconText}>#</Text>
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.label}>PARTNER ID</Text>
                <Text style={styles.value}>{user?._id || 'N/A'}</Text>
              </View>
            </View>

            {/* SECTION 2: BANK DETAILS */}
            <Text style={[styles.sectionHeader, styles.sectionHeaderGap]}>BANK DETAILS</Text>

            {/* A/C Number */}
            <View style={styles.detailItem}>
              <View style={styles.iconContainer}>
                <Ionicons name="business-outline" size={20} color="#000000" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.label}>A/C NUMBER</Text>
                <Text style={styles.value}>{user?.accountNumber || 'N/A'}</Text>
              </View>
            </View>

            {/* IFSC Code */}
            <View style={styles.detailItem}>
              <View style={styles.iconContainer}>
                <Ionicons name="grid-outline" size={20} color="#000000" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.label}>IFSC CODE</Text>
                <Text style={styles.value}>{user?.ifscCode || 'N/A'}</Text>
              </View>
            </View>

            {/* SECTION 3: DOCUMENTS */}
            <Text style={[styles.sectionHeader, styles.sectionHeaderGap]}>DOCUMENTS</Text>

            {/* Aadhar */}
            <View style={styles.detailItem}>
              <View style={styles.iconContainer}>
                <Ionicons name="id-card-outline" size={20} color="#000000" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.label}>AADHAR</Text>
                <Text style={styles.value}>{user?.aadharNumber || 'N/A'}</Text>
              </View>
            </View>

            {/* RC Book */}
            <View style={styles.detailItem}>
              <View style={styles.iconContainer}>
                <Ionicons name="car-outline" size={20} color="#000000" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.label}>RC BOOK</Text>
                <Text style={styles.value}>{user?.rcNumber || 'N/A'}</Text>
              </View>
            </View>

            {/* License */}
            <View style={styles.detailItem}>
              <View style={styles.iconContainer}>
                <Ionicons name="card-outline" size={20} color="#000000" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.label}>LICENSE</Text>
                <Text style={styles.value}>{user?.licenseNumber || 'N/A'}</Text>
              </View>
            </View>

            {/* Joined */}
            <View style={styles.detailItem}>
              <View style={styles.iconContainer}>
                <Ionicons name="calendar-outline" size={20} color="#000000" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.label}>JOINED</Text>
                <Text style={styles.value}>{formatDate(user?.createdAt)}</Text>
              </View>
            </View>

          </View>
        </ScrollView>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6', // Off-white cream background
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 16,
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
    width: 44, // Matches backButton width to center the title pill
  },
  scrollContent: {
    paddingBottom: 100, // Safe padding above bottom navigation bar
  },
  detailsCard: {
    backgroundColor: '#EAE5D9', // Sand/Beige colored background card
    marginHorizontal: 20,
    borderRadius: 28,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8882',
    letterSpacing: 1.2,
    marginBottom: 12,
    marginLeft: 4,
  },
  sectionHeaderGap: {
    marginTop: 24,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    marginBottom: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 2,
    gap: 16,
  },
  iconContainer: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hashIconText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginTop: -2,
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    color: '#8E8882',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  value: {
    fontSize: 15,
    color: '#000000',
    fontWeight: '600',
  },
});
