import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, DeviceEventEmitter, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, FontAwesome6 } from '@expo/vector-icons';

export default function ContactScreen() {
  const [prevOffset, setPrevOffset] = useState(0);
  const [tabBarVisible, setTabBarVisible] = useState(true);

  // Restore bottom tab bar visibility when leaving this screen
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

  // Handler to safely open URLs
  const openLink = async (url) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        console.warn('Cannot open URL:', url);
      }
    } catch (error) {
      console.error('Error opening link:', error);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        
        <ScrollView
          style={styles.scrollView}
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
              <Ionicons name="mail" size={18} color="#000000" />
              <Text style={styles.headerTitleText}>Contact Us</Text>
            </View>
            
            {/* Spacer to align title center */}
            <View style={styles.headerSpacer} />
          </View>

          {/* Main Card (Sand/Beige Colored Container) */}
          <View style={styles.detailsCard}>
            
            {/* Phone */}
            <TouchableOpacity 
              style={styles.detailItem} 
              activeOpacity={0.85}
              onPress={() => openLink('tel:707610235')}
            >
              <View style={styles.iconContainer}>
                <Ionicons name="call" size={22} color="#000000" />
              </View>
              <Text style={styles.valueText}>7207610235</Text>
            </TouchableOpacity>

            {/* Email */}
            <TouchableOpacity 
              style={styles.detailItem} 
              activeOpacity={0.85}
              onPress={() => openLink('mailto:support@leevondelivery.in')}
            >
              <View style={styles.iconContainer}>
                <Ionicons name="mail" size={22} color="#000000" />
              </View>
              <Text style={styles.valueText}>support@leevondelivery.in</Text>
            </TouchableOpacity>

            {/* Instagram */}
            <TouchableOpacity 
              style={styles.detailItem} 
              activeOpacity={0.85}
              onPress={() => openLink('https://instagram.com')}
            >
              <View style={styles.iconContainer}>
                <Ionicons name="logo-instagram" size={22} color="#000000" />
              </View>
              <Text style={styles.valueText}>Instagram</Text>
            </TouchableOpacity>

            {/* Facebook */}
            <TouchableOpacity 
              style={styles.detailItem} 
              activeOpacity={0.85}
              onPress={() => openLink('https://facebook.com')}
            >
              <View style={styles.iconContainer}>
                <Ionicons name="logo-facebook" size={22} color="#000000" />
              </View>
              <Text style={styles.valueText}>Facebook</Text>
            </TouchableOpacity>

            {/* Twitter / X */}
            <TouchableOpacity 
              style={styles.detailItem} 
              activeOpacity={0.85}
              onPress={() => openLink('https://x.com')}
            >
              <View style={styles.iconContainer}>
                <FontAwesome6 name="x-twitter" size={20} color="#000000" />
              </View>
              <Text style={styles.valueText}>Twitter</Text>
            </TouchableOpacity>

          </View>
        </ScrollView>

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
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 24,
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
    color: '#000000',
    letterSpacing: 0.5,
  },
  headerSpacer: {
    width: 44, // Align center helper spacer matching backButton width
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100, // Safe padding above bottom navigation bar
  },
  detailsCard: {
    backgroundColor: '#EAE5D9', // Sand/Beige colored background container card
    marginHorizontal: 20,
    borderRadius: 28,
    padding: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 24,
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
  valueText: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '600',
  },
});
