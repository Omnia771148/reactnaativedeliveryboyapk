import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Modal,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { auth } from "@/lib/firebase";
import { signInWithPhoneNumber, RecaptchaVerifier } from "firebase/auth";
import { API_URL, fetchWithTimeout } from "@/constants/api";
import { LoadingOverlay } from "@/components/loading-overlay";
import Constants, { ExecutionEnvironment } from "expo-constants";

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export default function ForgotPassword() {
  const [step, setStep] = useState(1); // 1: Phone, 2: OTP, 3: New Password

  // Clear  stale firebase auth session when entering forgot password screen
  useEffect(() => {
    const clearSession = async () => {
      if (Platform.OS !== "web" && !isExpoGo) {
        try {
          const nativeAuth = require("@react-native-firebase/auth").default;
          await nativeAuth().signOut();
        } catch (err) {
          console.error("Error signing out native auth:", err);
        }
      } else {
        try {
          const { signOut } = require("firebase/auth");
          await signOut(auth);
        } catch (err) {
          console.error("Error signing out web auth:", err);
        }
      }
    };
    clearSession();
  }, []);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [error, setError] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const [incorrectAttempts, setIncorrectAttempts] = useState(0);

  // Custom Modal state matching login/signup styling
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalType, setModalType] = useState("success"); // 'success' or 'error'
  const [redirectToLogin, setRedirectToLogin] = useState(false);

  const handleModalClose = () => {
    setModalVisible(false);
    if (redirectToLogin) {
      setRedirectToLogin(false);
      router.replace("/");
    }
  };

  // Handle resend countdown timer (30s)
  useEffect(() => {
    let interval = null;
    if (step === 2 && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    } else if (resendTimer === 0 && interval) {
      clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [step, resendTimer]);

  // Listen for automatic SMS code resolution (auto-verification) on Android devices
  useEffect(() => {
    let unsubscribe;
    if (step === 2) {
      const formattedPhone = "+91" + phone.trim();
      if (Platform.OS !== "web" && !isExpoGo) {
        try {
          const nativeAuth = require("@react-native-firebase/auth").default;
          unsubscribe = nativeAuth().onAuthStateChanged((user) => {
            if (user && user.phoneNumber === formattedPhone) {
              console.log("Firebase native auth auto-verified phone:", user.phoneNumber);
              setStep(3);
            }
          });
        } catch (err) {
          console.error("Native auth listener setup failed:", err);
        }
      } else {
        const { onAuthStateChanged } = require("firebase/auth");
        unsubscribe = onAuthStateChanged(auth, (user) => {
          if (user && user.phoneNumber === formattedPhone) {
            console.log("Firebase Web SDK auto-verified phone:", user.phoneNumber);
            setStep(3);
          }
        });
      }
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [step, phone]);

  // Step 1: Send OTP
  const handleSendOtp = async (forceResend = false) => {
    setError("");

    if (!/^\d{10}$/.test(phone)) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }

    Keyboard.dismiss();
    setIsLoading(true);

    try {
      // 1. Check if phone exists in DB (deliveryboyusers collection)
      const formattedPhone = "+91" + phone;
      const checkRes = await fetchWithTimeout(`${API_URL}/api/deliveryboy/check-phone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formattedPhone }),
      }, 10000);
      
      const contentType = checkRes.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        setError("Server is temporarily unavailable. Please try again in a moment.");
        setIsLoading(false);
        return;
      }
      const checkData = await checkRes.json();
      if (!checkRes.ok || !checkData.success) {
        const msg = checkData.message || "Phone number not found.";
        setError(msg);
        setModalType("error");
        setModalMessage(msg);
        setModalVisible(true);
        setIsLoading(false);
        return;
      }

      // 2. Send OTP via Firebase
      if (Platform.OS === "web") {
        if (window.recaptchaVerifier) {
          window.recaptchaVerifier.clear();
          window.recaptchaVerifier = null;
          const container = document.getElementById("recaptcha-container");
          if (container) container.innerHTML = "";
        }

        window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
          size: "invisible",
        });

        const result = await signInWithPhoneNumber(auth, formattedPhone, window.recaptchaVerifier);
        setConfirmationResult(result);
        setStep(2);
        setResendTimer(30);
        Alert.alert("OTP Sent", "Verification code has been sent to your phone number.");
      } else if (isExpoGo) {
        // Native mobile flow bypass for development/testing
        const mockConfirmationResult = {
          confirm: async (verificationCode) => {
            if (verificationCode === "123456") {
              return {
                user: {
                  uid: "mock-uid-" + Math.random().toString(36).substring(7),
                  phoneNumber: formattedPhone,
                },
              };
            } else {
              throw new Error("auth/invalid-verification-code");
            }
          },
        };
        setConfirmationResult(mockConfirmationResult);
        setStep(2);
        setResendTimer(30);
        Alert.alert("OTP Sent (Development)", "Enter the verification code '123456' to proceed.");
      } else {
        // Real Native SMS OTP using React Native Firebase Auth
        const nativeAuth = require("@react-native-firebase/auth").default;
        const result = await nativeAuth().signInWithPhoneNumber(formattedPhone, forceResend === true);
        setConfirmationResult(result);
        setStep(2);
        setResendTimer(30);
        setRedirectToLogin(false);
        setModalType("success");
        setModalMessage("Verification code has been sent to your phone number.");
        setModalVisible(true);
      }
    } catch (err) {
      console.error("OTP Error:", err);
      let msg = "Failed to send OTP. Please try again.";
      if (err.code === "auth/too-many-requests" || (err.message && err.message.includes("too-many-requests"))) {
        msg = "Too many OTP requests from this device. Requests have been temporarily blocked due to unusual activity. Please try again later.";
      } else if (err.message) {
        msg = "Failed to send OTP: " + err.message;
      }
      setError(msg);
      setModalType("error");
      setModalMessage(msg);
      setModalVisible(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    setOtp("");
    setIncorrectAttempts(0);
    await handleSendOtp(true);
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async () => {
    const trimmedOtp = otp.trim();
    if (!trimmedOtp) {
      setError("Please enter the OTP.");
      return;
    }
    setError("");
    Keyboard.dismiss();
    setIsLoading(true);

    try {
      let currentUser = null;
      if (Platform.OS !== "web" && !isExpoGo) {
        try {
          const nativeAuth = require("@react-native-firebase/auth").default;
          currentUser = nativeAuth().currentUser;
        } catch (e) {}
      } else {
        currentUser = auth ? auth.currentUser : null;
      }

      const isPhoneMatch = (userPhone, formPhone) => {
        if (!userPhone || !formPhone) return false;
        const uDigits = String(userPhone).replace(/\D/g, "");
        const fDigits = String(formPhone).replace(/\D/g, "");
        return uDigits.endsWith(fDigits) || fDigits.endsWith(uDigits);
      };

      if (currentUser && isPhoneMatch(currentUser.phoneNumber, phone)) {
        console.log("Already authenticated via auto-verification.");
        setStep(3);
      } else if (confirmationResult && typeof confirmationResult.confirm === "function") {
        try {
          await confirmationResult.confirm(trimmedOtp);
          setStep(3);
        } catch (confirmError) {
          console.error("Verify Error:", confirmError);
          // Check if auto-verification signed in user during the confirm call
          let recheckUser = null;
          if (Platform.OS !== "web" && !isExpoGo) {
            try {
              const nativeAuth = require("@react-native-firebase/auth").default;
              recheckUser = nativeAuth().currentUser;
            } catch (e) {}
          } else {
            recheckUser = auth ? auth.currentUser : null;
          }

          if (recheckUser) {
            console.log("Using rechecked authenticated user in forgot-password:", recheckUser);
            setStep(3);
          } else {
            const newAttempts = incorrectAttempts + 1;
            setIncorrectAttempts(newAttempts);

            let errMsg = "Invalid OTP";
            if (newAttempts === 1) {
              errMsg = "Incorrect OTP. You have 1 attempt remaining.";
            } else if (newAttempts >= 2) {
              errMsg = "Incorrect OTP. Too many attempts. Please tap 'Resend OTP'.";
            }
            setError(errMsg);
            setModalType("error");
            setModalMessage(errMsg);
            setModalVisible(true);
          }
        }
      } else if (currentUser) {
        setStep(3);
      } else {
        const msg = "OTP session expired. Please tap 'Resend OTP' to receive a new code.";
        setError(msg);
        setModalType("error");
        setModalMessage(msg);
        setModalVisible(true);
      }
    } catch (err) {
      console.error("Verify Error:", err);
      setError("Failed to verify OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Reset Password
  const handleResetPassword = async () => {
    setError("");
    setConfirmPasswordError("");

    if (!newPassword || newPassword.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match.");
      setError("Passwords do not match.");
      return;
    }

    Keyboard.dismiss();
    setIsLoading(true);

    try {
      const formattedPhone = "+91" + phone;
      const res = await fetchWithTimeout(`${API_URL}/api/deliveryboy/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formattedPhone, newPassword }),
      }, 10000);

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        setError("Server is temporarily unavailable. Please try again in a moment.");
        setIsLoading(false);
        return;
      }
      const data = await res.json();
      if (res.ok && data.success) {
        setRedirectToLogin(true);
        setModalType("success");
        setModalMessage("Password Reset Successfully!");
        setModalVisible(true);
      } else {
        setError(data.message || "Failed to reset password.");
      }
    } catch (err) {
      console.error("Reset Error:", err);
      setError("Something went wrong while resetting the password.");
    } finally {
      setIsLoading(false);
    }
  };

  // Real-time password change and mismatch validation
  const handlePasswordChange = (field, val) => {
    if (field === "newPassword") {
      setNewPassword(val);
      if (confirmPassword && val !== confirmPassword) {
        setConfirmPasswordError("Passwords do not match.");
      } else {
        setConfirmPasswordError("");
      }
    } else if (field === "confirmPassword") {
      setConfirmPassword(val);
      if (newPassword && val !== newPassword) {
        setConfirmPasswordError("Passwords do not match.");
      } else {
        setConfirmPasswordError("");
      }
    }
  };
  return (
    <View style={styles.container}>
      {/* Split background matching app theme */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.splitBackground}>
          <View style={styles.leftBackground} />
          <View style={styles.rightBackground} />
        </View>
      </View>

      <SafeAreaView style={styles.safeArea}>
        {/* Top Header Bar */}
        <View style={styles.topHeaderBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/");
              }
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color="#333333" />
          </TouchableOpacity>

          <View style={styles.welcomeHeader}>
            <Text style={styles.welcomeTitle}>Reset Password</Text>
          </View>

          {/* Spacer for symmetry */}
          <View style={{ width: 44 }} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* Error Alert Display */}
            {error ? (
              <View style={styles.errorAlert}>
                <Text style={styles.errorAlertText}>{error}</Text>
              </View>
            ) : null}

            {/* Form Card Layout */}
            <View style={styles.formWrapper}>
              {step === 1 && (
                <View style={styles.stepContainer}>
                  <Text style={styles.stepSubtitle}>Enter your registered mobile number</Text>
                  <View style={styles.customInputGroup}>
                    <Ionicons name="call-outline" size={18} color="#aaa" style={{ marginRight: 12 }} />
                    <TextInput
                      style={styles.customInput}
                      placeholder="Enter 10-digit phone number"
                      placeholderTextColor="#aaa"
                      keyboardType="number-pad"
                      value={phone}
                      onChangeText={(val) => setPhone(val.replace(/[^0-9]/g, ""))}
                      maxLength={10}
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.submitBtn}
                    onPress={() => handleSendOtp(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.submitBtnText}>Get OTP</Text>
                  </TouchableOpacity>
                </View>
              )}

              {step === 2 && (
                <View style={styles.stepContainer}>
                  <View style={styles.otpInfoBadge}>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#2EBD6B" />
                    <Text style={styles.otpInfoText}>OTP sent to +91 {phone}</Text>
                  </View>

                  <Text style={styles.stepSubtitle}>Please enter the OTP received via SMS</Text>

                  <View style={styles.customInputGroup}>
                    <TextInput
                      placeholder="000000"
                      placeholderTextColor="#aaa"
                      keyboardType="numeric"
                      maxLength={6}
                      autoComplete="sms-otp"
                      textContentType="oneTimeCode"
                      value={otp}
                      onChangeText={(val) => setOtp(val.replace(/\D/g, "").slice(0, 6))}
                      style={styles.otpInputField}
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.submitBtn}
                    onPress={handleVerifyOtp}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.submitBtnText}>Verify OTP</Text>
                  </TouchableOpacity>

                  <View style={styles.otpActionsContainer}>
                    <TouchableOpacity
                      onPress={() => setStep(1)}
                      style={styles.changeBtn}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.changeBtnText}>Change Number</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleResendOtp}
                      disabled={resendTimer > 0}
                      activeOpacity={resendTimer > 0 ? 1 : 0.7}
                      style={styles.resendOtpBtn}
                    >
                      <Text style={resendTimer > 0 ? styles.resendOtpTextDisabled : styles.resendOtpText}>
                        {resendTimer > 0 ? `Resend OTP (${resendTimer}s)` : "Resend OTP"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {step === 3 && (
                <View style={styles.stepContainer}>
                  <Text style={styles.stepSubtitle}>Create a new password for your account</Text>
                  {/* New Password Input */}
                  <View style={[styles.customInputGroup, { marginBottom: 16 }]}>
                    <Ionicons name="lock-closed-outline" size={18} color="#aaa" style={{ marginRight: 12 }} />
                    <TextInput
                      placeholder="New Password"
                      placeholderTextColor="#aaa"
                      secureTextEntry={!showNewPassword}
                      value={newPassword}
                      onChangeText={(val) => handlePasswordChange("newPassword", val)}
                      style={styles.customInput}
                    />
                    <TouchableOpacity
                      onPress={() => setShowNewPassword(!showNewPassword)}
                      style={styles.eyeIcon}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={showNewPassword ? "eye-outline" : "eye-off-outline"}
                        size={20}
                        color="#aaa"
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Confirm New Password Input */}
                  <View style={[
                    styles.customInputGroup, 
                    confirmPasswordError ? styles.errorBorder : null,
                    { marginBottom: confirmPasswordError ? 12 : 24 }
                  ]}>
                    <Ionicons name="lock-closed-outline" size={18} color="#aaa" style={{ marginRight: 12 }} />
                    <TextInput
                      placeholder="Confirm New Password"
                      placeholderTextColor="#aaa"
                      secureTextEntry={!showConfirmPassword}
                      value={confirmPassword}
                      onChangeText={(val) => handlePasswordChange("confirmPassword", val)}
                      style={styles.customInput}
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={styles.eyeIcon}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={showConfirmPassword ? "eye-outline" : "eye-off-outline"}
                        size={20}
                        color="#aaa"
                      />
                    </TouchableOpacity>
                  </View>
                  {confirmPasswordError ? (
                    <Text style={styles.errorText}>{confirmPasswordError}</Text>
                  ) : null}

                  <TouchableOpacity
                    style={styles.submitBtn}
                    onPress={handleResetPassword}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.submitBtnText}>Update Password</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <View id="recaptcha-container" />

      {/* Custom Styled Success/Error Modal */}
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
              modalType === "success" ? styles.modalIconCircleSuccess : styles.modalIconCircleError
            ]}>
              <Ionicons
                name={modalType === "success" ? "checkmark" : "close"}
                size={40}
                color="#FFFFFF"
              />
            </View>
            <Text style={styles.modalMessageText}>{modalMessage}</Text>
            <TouchableOpacity
              style={styles.modalButton}
              activeOpacity={0.8}
              onPress={handleModalClose}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Loading Overlay placed at the bottom so it renders on top of all sibling components */}
      <LoadingOverlay visible={isLoading} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  splitBackground: {
    flex: 1,
    flexDirection: "row",
  },
  leftBackground: {
    flex: 1,
    backgroundColor: "#FAF9F6", // Cream
  },
  rightBackground: {
    flex: 1,
    backgroundColor: "#DCD5C7", // Sand
  },
  safeArea: {
    flex: 1,
  },
  topHeaderBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 10 : 16,
    paddingBottom: 12,
    width: "100%",
    zIndex: 10,
  },
  backButton: {
    backgroundColor: "#FFFFFF",
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  welcomeHeader: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 30,
    paddingVertical: 8,
    borderRadius: 35,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  welcomeTitle: {
    fontFamily: "CursiveScript",
    fontSize: 38,
    fontWeight: "normal",
    color: "#333333",
    textAlign: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  errorAlert: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E55B49",
    borderRadius: 35,
    paddingHorizontal: 20,
    paddingVertical: 12,
    width: "100%",
    maxWidth: 340,
    marginBottom: 20,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  errorAlertText: {
    color: "#E55B49",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  formWrapper: {
    width: "100%",
    maxWidth: 340,
  },
  stepContainer: {
    width: "100%",
    alignItems: "center",
  },
  stepSubtitle: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
    marginBottom: 20,
  },
  customInputGroup: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 35,
    paddingHorizontal: 20,
    height: 54,
    width: "100%",
    marginBottom: 20,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  customInput: {
    flex: 1,
    fontSize: 15,
    color: "#333",
  },
  eyeIcon: {
    position: "absolute",
    right: 20,
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
  },
  errorBorder: {
    borderWidth: 1.5,
    borderColor: "#E55B49",
  },
  errorText: {
    color: "#E55B49",
    fontSize: 12,
    marginTop: -14,
    marginBottom: 16,
    alignSelf: "flex-start",
    paddingLeft: 10,
  },
  otpInfoBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 35,
    marginBottom: 16,
    gap: 8,
    width: "100%",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  otpInfoText: {
    color: "#2EBD6B",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  otpInputField: {
    flex: 1,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 8,
    textAlign: "center",
    color: "#333",
  },
  submitBtn: {
    backgroundColor: "#333333",
    width: "100%",
    height: 54,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  otpActionsContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginTop: 18,
    gap: 10,
  },
  changeBtn: {
    paddingVertical: 6,
  },
  changeBtnText: {
    color: "#555",
    fontSize: 14,
    textDecorationLine: "underline",
  },
  resendOtpBtn: {
    paddingVertical: 6,
  },
  resendOtpText: {
    color: "#E55B49",
    fontSize: 14,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  resendOtpTextDisabled: {
    color: "#444444",
    fontSize: 14,
    fontWeight: "700",
    textDecorationLine: "none",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    zIndex: 1000,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "85%",
    maxWidth: 320,
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  modalIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  modalIconCircleError: {
    backgroundColor: "#E55B49",
  },
  modalIconCircleSuccess: {
    backgroundColor: "#2EBD6B",
  },
  modalMessageText: {
    fontSize: 20,
    color: "#000000",
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 28,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  modalButton: {
    backgroundColor: "#000000",
    width: "90%",
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
});
