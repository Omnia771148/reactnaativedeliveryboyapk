import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '@/constants/api';

export default function SettingsScreen() {
  const [user, setUser] = useState({ name: 'sai', phone: '6301366183' });
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  // Load name and phone from AsyncStorage on mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const storedName = await AsyncStorage.getItem('name');
        const storedPhone = await AsyncStorage.getItem('phone');
        
        setUser({
          name: storedName || 'sai',
          phone: storedPhone || '6301366183',
        });
      } catch (error) {
        console.error('Failed to load user data:', error);
      }
    };

    loadUserData();
  }, []);

  // Handle logout trigger
  const handleLogout = () => {
    setLogoutModalVisible(true);
  };

  // Perform actual logout logic
  const confirmPerformLogout = async () => {
    setLogoutModalVisible(false);
    try {
      const storedId = await AsyncStorage.getItem('userid');
      if (storedId) {
        // 1. Mark offline on the backend
        try {
          await fetch(`${API_URL}/api/users/${storedId}/status`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ isActive: false }),
          });
        } catch (err) {
          console.error('Error marking user offline during logout:', err);
        }

        // 2. Clear push token on the backend
        try {
          await fetch(`${API_URL}/api/users/${storedId}/push-token`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ pushToken: '' }),
          });
        } catch (err) {
          console.error('Error clearing push token during logout:', err);
        }
      }

      await AsyncStorage.multiRemove([
        'userid',
        'name',
        'phone',
        'isActive',
        'updatedAt',
        'lastLoginDate',
      ]);
      router.replace('/');
    } catch (error) {
      console.error('Error logging out:', error);
      if (Platform.OS === 'web') {
        alert('Failed to log out. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to log out. Please try again.');
      }
    }
  };

  // Extract first letter for avatar badge
  const avatarLetter = user.name ? user.name.charAt(0).toUpperCase() : 'S';

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        
        {/* Settings Pill Header */}
        <View style={styles.headerContainer}>
          <View style={styles.headerBadge}>
            <Ionicons name="settings" size={20} color="#2A3037" />
            <Text style={styles.headerText}>Settings</Text>
          </View>
        </View>

        {/* Profile Details Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          </View>
          <View style={styles.profileDetails}>
            <Text style={styles.profileName}>{user.name}</Text>
            <View style={styles.phoneContainer}>
              <Ionicons name="call" size={15} color="#B58A55" />
              <Text style={styles.profilePhone}>{user.phone}</Text>
            </View>
          </View>
        </View>

        {/* Buttons List Container (Sand colored card) */}
        <View style={styles.buttonsContainer}>
          {/* My Profile */}
          <TouchableOpacity 
            style={styles.menuButton} 
            activeOpacity={0.8}
            onPress={() => router.push('/settings/profile')}
          >
            <View style={styles.menuButtonLeft}>
              <Ionicons name="person" size={20} color="#000000" />
              <Text style={styles.menuButtonText}>My Profile</Text>
            </View>
            <Ionicons name="play" size={12} color="#000000" />
          </TouchableOpacity>

          {/* My Orders */}
          <TouchableOpacity 
            style={styles.menuButton} 
            activeOpacity={0.8}
            onPress={() => router.push('/settings/orders')}
          >
            <View style={styles.menuButtonLeft}>
              <Ionicons name="bag-check" size={20} color="#000000" />
              <Text style={styles.menuButtonText}>My Orders</Text>
            </View>
            <Ionicons name="play" size={12} color="#000000" />
          </TouchableOpacity>

          {/* My Reviews */}
          <TouchableOpacity 
            style={styles.menuButton} 
            activeOpacity={0.8}
            onPress={() => router.push('/settings/reviews')}
          >
            <View style={styles.menuButtonLeft}>
              <Ionicons name="star" size={20} color="#000000" />
              <Text style={styles.menuButtonText}>My Reviews</Text>
            </View>
            <Ionicons name="play" size={12} color="#000000" />
          </TouchableOpacity>

          {/* Contact Us */}
          <TouchableOpacity 
            style={styles.menuButton} 
            activeOpacity={0.8}
            onPress={() => router.push('/settings/contact')}
          >
            <View style={styles.menuButtonLeft}>
              <Ionicons name="mail" size={20} color="#000000" />
              <Text style={styles.menuButtonText}>Contact Us</Text>
            </View>
            <Ionicons name="play" size={12} color="#000000" />
          </TouchableOpacity>

          {/* Logout (Triggers actual action) */}
          <TouchableOpacity 
            style={[styles.menuButton, styles.logoutButton]} 
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <View style={styles.menuButtonLeft}>
              <Ionicons name="log-out" size={20} color="#FFFFFF" />
              <Text style={[styles.menuButtonText, styles.logoutButtonText]}>Logout</Text>
            </View>
            <Ionicons name="play" size={12} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

      </SafeAreaView>

      {/* Custom Logout Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={logoutModalVisible}
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Red circle with white logout icon */}
            <View style={styles.modalIconContainer}>
              <Ionicons name="log-out" size={44} color="#FFFFFF" />
            </View>

            {/* Title Text */}
            <Text style={styles.modalTitle}>Are you sure you want{"\n"}to logout?</Text>

            {/* Black Logout Button */}
            <TouchableOpacity 
              style={styles.modalLogoutButton} 
              activeOpacity={0.85}
              onPress={confirmPerformLogout}
            >
              <Text style={styles.modalLogoutButtonText}>Logout</Text>
            </TouchableOpacity>

            {/* Not Now Link */}
            <TouchableOpacity 
              style={styles.modalCancelButton}
              activeOpacity={0.7}
              onPress={() => setLogoutModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>Not now</Text>
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
    backgroundColor: '#FAF9F6', // Off-white cream page background
  },
  safeArea: {
    flex: 1,
  },
  headerContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  headerBadge: {
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
  headerText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2A3037',
    letterSpacing: 0.5,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 24,
    gap: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 24,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2A3037', // Dark slate gray/blue avatar color
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  profileDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
    marginLeft: 21, // Align with phone number text (15px icon size + 6px gap)
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profilePhone: {
    fontSize: 15,
    color: '#8E8882',
    fontWeight: '500',
  },
  buttonsContainer: {
    backgroundColor: '#EAE5D9', // Matching the warm sand/beige tone
    marginHorizontal: 20,
    borderRadius: 28,
    padding: 16,
    gap: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 24,
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 2,
  },
  menuButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  menuButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  logoutButton: {
    backgroundColor: '#E55B49', // Red background color
  },
  logoutButtonText: {
    color: '#FFFFFF', // White text color
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Dim background overlay
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '85%',
    maxWidth: 320,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
  },
  modalIconContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#E55B49', // Vibrant red matching the design
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    color: '#000000',
    lineHeight: 30,
    paddingHorizontal: 10,
    marginBottom: 30,
  },
  modalLogoutButton: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    backgroundColor: '#000000', // Black button
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  modalLogoutButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  modalCancelButton: {
    paddingVertical: 8,
  },
  modalCancelText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
