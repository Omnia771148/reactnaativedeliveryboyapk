import { LoadingOverlay } from '@/components/loading-overlay';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '@/constants/api';

// Custom User Profile Icon built using standard Views to match color guidelines exactly
const UserIcon = ({ color }) => (
  <View style={styles.iconWrapper}>
    <View style={[styles.userHead, { backgroundColor: color }]} />
    <View style={[styles.userBody, { backgroundColor: color }]} />
  </View>
);

// Custom Lock Icon built using standard Views to match color guidelines exactly
const LockIcon = ({ color }) => (
  <View style={styles.iconWrapper}>
    <View style={[styles.lockLoop, { borderColor: color }]} />
    <View style={[styles.lockBody, { backgroundColor: color }]} />
  </View>
);

export default function HomeScreen() {
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState('error'); // 'error' or 'no_account'

  // Auto-login logic: check if user session is active and valid (expires in 30 days of inactivity)
  useEffect(() => {
    const checkSession = async () => {
      try {
        const storedId = await AsyncStorage.getItem('userid');
        const lastLoginStr = await AsyncStorage.getItem('lastLoginDate');

        if (storedId) {
          if (lastLoginStr) {
            const lastLogin = new Date(lastLoginStr);
            const now = new Date();
            const diffTime = Math.abs(now - lastLogin);
            const diffDays = diffTime / (1000 * 60 * 60 * 24);

            if (diffDays > 30) {
              // Expired: Clear everything and show login page
              await AsyncStorage.multiRemove([
                'userid',
                'name',
                'phone',
                'isActive',
                'updatedAt',
                'lastLoginDate',
              ]);
              return;
            }
          }
          // Valid session: Update the date and auto-navigate to homepage
          await AsyncStorage.setItem('lastLoginDate', new Date().toISOString());
          router.replace('/homepage');
        }
      } catch (error) {
        console.error('Session check error:', error);
      }
    };
    checkSession();
  }, []);

  const handleLogin = async () => {
    if (!mobileNumber || !password) {
      setModalType('error');
      setModalMessage('Please enter both Mobile Number and Password.');
      setModalVisible(true);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: mobileNumber,
          password: password,
        }),
      });

      let data = {};
      try {
        const text = await response.text();
        data = JSON.parse(text);
      } catch (_e) {
        data = { message: 'Invalid response from server. Check if backend is running.' };
      }

      if (response.ok) {
        // Save user fields to AsyncStorage (localstorage)
        await AsyncStorage.setItem('userid', data.user._id ? String(data.user._id) : '');
        await AsyncStorage.setItem('name', data.user.name ? String(data.user.name) : '');
        await AsyncStorage.setItem('phone', data.user.phone ? String(data.user.phone) : '');
        await AsyncStorage.setItem('isActive', String(!!data.user.isActive));
        await AsyncStorage.setItem('updatedAt', data.user.updatedAt ? String(data.user.updatedAt) : '');
        await AsyncStorage.setItem('lastLoginDate', new Date().toISOString());

        console.log('Successfully saved user session:', data.user);
        router.replace('/homepage');
      } else {
        if (data.errorType === 'NO_ACCOUNT') {
          setModalType('no_account');
          setModalMessage('no account found');
        } else {
          setModalType('error');
          setModalMessage(data.message || 'incorrect id and password');
        }
        setModalVisible(true);
      }
    } catch (error) {
      console.error('Connection error:', error);
      setModalType('error');
      setModalMessage('Could not connect to the backend server. Please verify the backend is running and your connection is active.');
      setModalVisible(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Loading Overlay */}
      <LoadingOverlay visible={loading} />

      {/* Split Screen Background */}
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.splitBackground}>
          <View style={styles.leftBackground} />
          <View style={styles.rightBackground} />
        </View>
      </View>

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.contentContainer}>
          {/* Header Title: LEEVON */}
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>LEEVON</Text>
          </View>

          {/* Form Inputs Container */}
          <View style={styles.formContainer}>
            {/* Mobile Number Input Wrapper */}
            <View style={styles.inputWrapper}>
              <UserIcon color="#A5A5A5" />
              <TextInput
                style={styles.input}
                placeholder="Mobile number"
                placeholderTextColor="#A5A5A5"
                keyboardType="number-pad"
                value={mobileNumber}
                onChangeText={(text) => setMobileNumber(text.replace(/[^0-9]/g, ''))}
                editable={!loading}
                maxLength={10}
              />
            </View>

            {/* Password Input Wrapper */}
            <View style={styles.inputWrapper}>
              <LockIcon color="#E55B49" />
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Password"
                placeholderTextColor="#E55B49"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                editable={!loading}
              />
            </View>

            {/* Forgot Password Link */}
            <TouchableOpacity
              style={styles.forgotPasswordButton}
              activeOpacity={0.7}
              disabled={loading}
            >
              <Text style={styles.forgotPasswordText}>Forgot password ?</Text>
            </TouchableOpacity>
          </View>

          {/* Login Button Container */}
          <TouchableOpacity
            style={[styles.loginButton, loading && styles.disabledButton]}
            activeOpacity={0.85}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.loginButtonText}>
              {loading ? 'Logging in...' : 'Login'}
            </Text>
          </TouchableOpacity>

          {/* Footer Create Account Link */}
          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>
              Don’t have account?{' '}
              <Text style={styles.createText} onPress={() => { }}>create</Text>
            </Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Custom Error Modal matching the screenshot layout */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalIconCircle}>
              <Ionicons name="close" size={38} color="#FFFFFF" />
            </View>
            <Text style={styles.modalMessageText}>
              {modalMessage}
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              activeOpacity={0.8}
              onPress={() => {
                if (modalType === 'no_account') {
                  // Action will be specified later by user
                  setModalVisible(false);
                } else {
                  setModalVisible(false);
                }
              }}
            >
              <Text style={styles.modalButtonText}>
                {modalType === 'no_account' ? 'Create Account' : 'Try Again'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSecondaryButton}
              activeOpacity={0.7}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
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
  },
  splitBackground: {
    flex: 1,
    flexDirection: 'row',
  },
  leftBackground: {
    flex: 1,
    backgroundColor: '#FAF9F6', // Off-white cream shade
  },
  rightBackground: {
    flex: 1,
    backgroundColor: '#DCD5C7', // Warm sand/beige shade
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 36,
  },
  logoContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 56,
    paddingVertical: 18,
    borderRadius: 35,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#000000',
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 20,
    maxWidth: 320,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    width: '100%',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 35,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    gap: 14,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
    paddingVertical: 0,
    outlineStyle: 'none', // Prevents default browser outline on web
  },
  passwordInput: {
    color: '#E55B49', // Red/Orange color for password text
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginRight: 4,
    marginTop: -4,
  },
  forgotPasswordText: {
    fontSize: 15,
    color: '#000000',
  },
  loginButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 54,
    paddingVertical: 16,
    borderRadius: 35,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  disabledButton: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
  },
  footerContainer: {
    marginTop: 20,
  },
  footerText: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
    textAlign: 'center',
  },
  createText: {
    color: '#7F1F1D', // Dark maroon color
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  // Custom Icon Vector Components using standard Views
  iconWrapper: {
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userHead: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 2,
  },
  userBody: {
    width: 15,
    height: 6,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  lockLoop: {
    width: 10,
    height: 9,
    borderWidth: 2,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    borderBottomWidth: 0,
    position: 'absolute',
    top: 2,
  },
  lockBody: {
    width: 14,
    height: 9,
    borderRadius: 2.5,
    position: 'absolute',
    bottom: 2,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  modalIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E55B49', // Coral red matching password icon color
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalMessageText: {
    fontSize: 22,
    color: '#000000',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  modalButton: {
    backgroundColor: '#000000', // Black button matching screenshot
    width: '90%',
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  modalSecondaryButton: {
    paddingVertical: 8,
  },
  modalSecondaryButtonText: {
    color: '#8E8882',
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
