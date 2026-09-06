import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Linking,
  Animated,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SUPPORT_PHONE = '+917207610235';
const SUPPORT_PHONE_DISPLAY = '+91 7207610235';
const SUPPORT_EMAIL = 'support@leevondelivery.in';

export function FloatingHelpButton() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const segments = useSegments();

  const [isOpen, setIsOpen] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Animation for opening and closing card
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Track keyboard to prevent floating button from covering input fields
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Animate card when visibility changes
  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.85,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen, opacityAnim, scaleAnim]);

  // Check if current route is the "Connect with us" / contact screen
  const isContactScreen =
    (pathname && (pathname.includes('contact') || pathname.includes('connect'))) ||
    (Array.isArray(segments) && (segments.includes('contact') || segments.includes('connect')));

  // If on the Connect With Us / Contact page or keyboard is open, do not display
  if (isContactScreen || keyboardVisible) {
    return null;
  }

  // Determine if on a tab-based page vs auth/landing pages
  const isAuthScreen =
    pathname === '/' ||
    pathname === '/signup' ||
    pathname === '/forgot-password' ||
    (Array.isArray(segments) && (segments.includes('signup') || segments.includes('forgot-password')));

  // Tab routes have the custom floating tab bar (~68px + bottom inset), so position above it
  const bottomPosition = isAuthScreen
    ? Math.max(insets.bottom, 16) + 16
    : insets.bottom + 86;

  const handleOpenCall = async () => {
    try {
      await Linking.openURL(`tel:${SUPPORT_PHONE}`);
    } catch (err) {
      console.error('Failed to open phone dialer:', err);
    }
  };

  const handleOpenMail = async () => {
    try {
      await Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
    } catch (err) {
      console.error('Failed to open mail client:', err);
    }
  };

  const closeCard = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Floating Help Button at the bottom-right */}
      <View
        pointerEvents="box-none"
        style={[styles.floatingWrapper, { bottom: bottomPosition }]}
      >
        <TouchableOpacity
          style={styles.helpButton}
          activeOpacity={0.85}
          onPress={() => setIsOpen(true)}
          accessibilityLabel="Open help and support"
          accessibilityRole="button"
        >
          <View style={styles.iconCircle}>
            <Ionicons name="headset" size={17} color="#FFFFFF" />
          </View>
          <Text style={styles.helpText}>Help</Text>
        </TouchableOpacity>
      </View>

      {/* Support Card Modal */}
      <Modal
        visible={isOpen}
        transparent
        animationType="none"
        onRequestClose={closeCard}
      >
        <TouchableWithoutFeedback onPress={closeCard}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <Animated.View
                style={[
                  styles.cardContainer,
                  {
                    transform: [{ scale: scaleAnim }],
                    opacity: opacityAnim,
                  },
                ]}
              >
                {/* Card Header with X Close Button */}
                <View style={styles.cardHeader}>
                  <View style={styles.headerTitleRow}>
                    <View style={styles.supportBadgeIcon}>
                      <Ionicons name="help-buoy" size={16} color="#000000" />
                    </View>
                    <View>
                      <Text style={styles.cardTitle}>Need Help?</Text>
                      <Text style={styles.cardSubtitle}>We are here to assist you 24/7</Text>
                    </View>
                  </View>

                  {/* X Button to close the card */}
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={closeCard}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityLabel="Close support card"
                    accessibilityRole="button"
                  >
                    <Ionicons name="close" size={18} color="#4B5563" />
                  </TouchableOpacity>
                </View>

                {/* Divider */}
                <View style={styles.divider} />

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                  {/* Call Button */}
                  <TouchableOpacity
                    style={[styles.actionCard, styles.callCard]}
                    activeOpacity={0.8}
                    onPress={handleOpenCall}
                  >
                    <View style={styles.actionCardLeft}>
                      <View style={[styles.actionIconCircle, styles.callIconCircle]}>
                        <Ionicons name="call" size={18} color="#16A34A" />
                      </View>
                      <View style={styles.actionTextCol}>
                        <Text style={styles.actionTitle}>Call Support</Text>
                        <Text style={styles.actionSubtitle}>{SUPPORT_PHONE_DISPLAY}</Text>
                      </View>
                    </View>
                    <View style={[styles.actionArrowBadge, styles.callArrowBadge]}>
                      <Ionicons name="chevron-forward" size={16} color="#16A34A" />
                    </View>
                  </TouchableOpacity>

                  {/* Mail Button */}
                  <TouchableOpacity
                    style={[styles.actionCard, styles.mailCard]}
                    activeOpacity={0.8}
                    onPress={handleOpenMail}
                  >
                    <View style={styles.actionCardLeft}>
                      <View style={[styles.actionIconCircle, styles.mailIconCircle]}>
                        <Ionicons name="mail" size={18} color="#2563EB" />
                      </View>
                      <View style={styles.actionTextCol}>
                        <Text style={styles.actionTitle}>Email Support</Text>
                        <Text style={styles.actionSubtitle}>{SUPPORT_EMAIL}</Text>
                      </View>
                    </View>
                    <View style={[styles.actionArrowBadge, styles.mailArrowBadge]}>
                      <Ionicons name="chevron-forward" size={16} color="#2563EB" />
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Online Status Indicator */}
                <View style={styles.statusRow}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Delivery partner helpline is active</Text>
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const windowWidth = Dimensions.get('window').width;

const styles = StyleSheet.create({
  floatingWrapper: {
    position: 'absolute',
    right: 16,
    zIndex: 9999,
    elevation: 10,
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E232A',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  iconCircle: {
    marginRight: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  helpText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  cardContainer: {
    width: Math.min(windowWidth - 40, 340),
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#E8E3D9',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  supportBadgeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: '#E2D9CC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 14,
  },
  actionButtons: {
    gap: 10,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  callCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  mailCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  actionCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  callIconCircle: {
    backgroundColor: '#DCFCE7',
  },
  mailIconCircle: {
    backgroundColor: '#EFF6FF',
  },
  actionTextCol: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 2,
  },
  actionArrowBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  callArrowBadge: {
    backgroundColor: '#DCFCE7',
  },
  mailArrowBadge: {
    backgroundColor: '#EFF6FF',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#16A34A',
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
});
