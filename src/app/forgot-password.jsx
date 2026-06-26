import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
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

  // Listen for automatic SMS code resolution (auto-verification) on Android devices
  useEffect(() => {
    let unsubscribe;
    if (step === 2) {
      if (Platform.OS !== "web" && !isExpoGo) {
        try {
          const nativeAuth = require("@react-native-firebase/auth").default;
          unsubscribe = nativeAuth().onAuthStateChanged((user) => {
            if (user) {
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
          if (user) {
            console.log("Firebase Web SDK auto-verified phone:", user.phoneNumber);
            setStep(3);
          }
        });
      }
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [step]);

  // Step 1: Send OTP
  const handleSendOtp = async () => {
    setError("");

    if (!/^\d{10}$/.test(phone)) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }

    setIsLoading(true);

    try {
      // 1. Check if phone exists in DB (deliveryboyusers collection)
      const formattedPhone = "+91" + phone;
      const checkRes = await fetchWithTimeout(`${API_URL}/api/deliveryboy/check-phone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formattedPhone }),
      }, 10000);
      
      const checkData = await checkRes.json();
      if (!checkRes.ok || !checkData.success) {
        setError(checkData.message || "Phone number not found.");
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
        Alert.alert("OTP Sent", "Verification code has been sent to your phone number.");
      } else if (isExpoGo) {
        // Native mobile flow bypass for development/testing
        const mockConfirmationResult = {
          confirm: async (verificationCode) => {
            if (verificationCode === "123456" || verificationCode === otp) {
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
        Alert.alert("OTP Sent (Development)", "Enter the verification code '123456' to proceed.");
      } else {
        // Real Native SMS OTP using React Native Firebase Auth
        const nativeAuth = require("@react-native-firebase/auth").default;
        const result = await nativeAuth().signInWithPhoneNumber(formattedPhone);
        setConfirmationResult(result);
        setStep(2);
        Alert.alert("OTP Sent", "Verification code has been sent to your phone number.");
      }
    } catch (err) {
      console.error("OTP Error:", err);
      const msg = "Failed to send OTP: " + (err.message || "Unknown error");
      setError(msg);
      Alert.alert("Error", msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async () => {
    const trimmedOtp = otp.trim();
    if (!trimmedOtp) {
      setError("Please enter the OTP.");
      return;
    }
    setError("");
    setIsLoading(true);

    try {
      // Check if user is already authenticated (auto-verified by Android Google Play Services)
      let currentUser = null;
      if (Platform.OS !== "web" && !isExpoGo) {
        const nativeAuth = require("@react-native-firebase/auth").default;
        currentUser = nativeAuth().currentUser;
      } else {
        currentUser = auth.currentUser;
      }

      if (currentUser) {
        console.log("Already authenticated via auto-verification.");
        setStep(3);
      } else {
        await confirmationResult.confirm(trimmedOtp);
        // OTP Valid, proceed to Step 3
        setStep(3);
      }
    } catch (err) {
      console.error("Verify Error:", err);
      setError("Invalid OTP");
      Alert.alert("Error", "Invalid OTP");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Reset Password
  const handleResetPassword = async () => {
    setError("");

    if (newPassword.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const formattedPhone = "+91" + phone;
      const res = await fetchWithTimeout(`${API_URL}/api/deliveryboy/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formattedPhone, newPassword }),
      }, 10000);

      const data = await res.json();
      if (res.ok && data.success) {
        Alert.alert("Success", "Password reset successfully! Please login.", [
          { text: "OK", onPress: () => router.replace("/") }
        ]);
      } else {
        setError(data.message || "Failed to reset password.");
      }
    } catch (err) {
      console.error("Reset Error:", err);
      setError("Something went wrong");
      Alert.alert("Error", "Something went wrong while resetting the password.");
    } finally {
      setIsLoading(false);
    }
  };

  // Real-time password change and mismatch validation
  const handlePasswordChange = (name, val) => {
    if (name === "newPassword") {
      setNewPassword(val);
      if (confirmPassword && val !== confirmPassword) {
        setConfirmPasswordError("Passwords do not match.");
      } else {
        setConfirmPasswordError("");
      }
    } else if (name === "confirmPassword") {
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
      <SafeAreaView style={styles.safeArea}>
        {/* Back Button */}
        <TouchableOpacity
          onClick={() => router.replace("/")}
          onPress={() => router.replace("/")}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#333" />
        </TouchableOpacity>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Title Section */}
          <View style={styles.titleSection}>
            <Text style={styles.titleText}>Forgot Password?</Text>
            <Text style={styles.subtitleText}>Recover your account</Text>
          </View>

          {/* Error Alert Display */}
          {error ? (
            <View style={styles.errorAlert}>
              <Text style={styles.errorAlertText}>{error}</Text>
            </View>
          ) : null}

          {/* Form Card Layout */}
          <View style={styles.formCard}>
            {step === 1 && (
              <View style={styles.stepContainer}>
                <TextInput
                  type="tel"
                  placeholder="Phone number"
                  placeholderTextColor="#aaa"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={(val) => setPhone(val.replace(/\D/g, "").slice(0, 10))}
                  style={styles.inputField}
                />

                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={handleSendOtp}
                  activeOpacity={0.8}
                >
                  <Text style={styles.submitBtnText}>Send OTP</Text>
                </TouchableOpacity>
              </View>
            )}

            {step === 2 && (
              <View style={styles.stepContainer}>
                <Text style={styles.infoText}>OTP sent to +91 {phone}</Text>
                <TextInput
                  placeholder="Enter 6-digit OTP"
                  placeholderTextColor="#aaa"
                  keyboardType="numeric"
                  maxLength={6}
                  value={otp}
                  onChangeText={setOtp}
                  style={styles.inputField}
                />

                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={handleVerifyOtp}
                  activeOpacity={0.8}
                >
                  <Text style={styles.submitBtnText}>Verify OTP</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setStep(1)}
                  style={styles.changeBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.changeBtnText}>Change Number</Text>
                </TouchableOpacity>
              </View>
            )}

            {step === 3 && (
              <View style={styles.stepContainer}>
                {/* New Password Input */}
                <View style={[styles.inputWrapper, { marginBottom: 16 }]}>
                  <TextInput
                    placeholder="New Password"
                    placeholderTextColor="#aaa"
                    secureTextEntry={!showNewPassword}
                    value={newPassword}
                    onChangeText={(val) => handlePasswordChange("newPassword", val)}
                    style={styles.inputFieldInside}
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
                  styles.inputWrapper, 
                  confirmPasswordError ? styles.errorBorder : null,
                  { marginBottom: confirmPasswordError ? 12 : 35 }
                ]}>
                  <TextInput
                    placeholder="Confirm New Password"
                    placeholderTextColor="#aaa"
                    secureTextEntry={!showConfirmPassword}
                    value={confirmPassword}
                    onChangeText={(val) => handlePasswordChange("confirmPassword", val)}
                    style={styles.inputFieldInside}
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
      </SafeAreaView>
      <View id="recaptcha-container" />

      {/* Loading Overlay placed at the bottom so it renders on top of all sibling components */}
      <LoadingOverlay visible={isLoading} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F7F1", // Outer page background color
  },
  safeArea: {
    flex: 1,
  },
  backButton: {
    position: "absolute",
    left: 20,
    top: Platform.OS === "ios" ? 50 : 20,
    backgroundColor: "#FFFFFF",
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 100,
    paddingBottom: 40,
  },
  titleSection: {
    alignItems: "center",
    marginBottom: 40,
  },
  titleText: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif", // Cursive fallback matching Great Vibes feel
    fontSize: 42,
    fontWeight: "600",
    color: "#111",
    textAlign: "center",
  },
  subtitleText: {
    fontSize: 16,
    color: "#555",
    marginTop: 5,
  },
  errorAlert: {
    backgroundColor: "#FDEDEC",
    borderWidth: 1,
    borderColor: "#E55B49",
    borderRadius: 12,
    padding: 12,
    width: "100%",
    maxWidth: 340,
    marginBottom: 24,
  },
  errorAlertText: {
    color: "#E55B49",
    fontSize: 14,
    textAlign: "center",
  },
  formCard: {
    backgroundColor: "#E2D3C1", // Form card background color
    borderRadius: 30,
    paddingVertical: 36,
    paddingHorizontal: 24,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
  },
  stepContainer: {
    width: "100%",
    alignItems: "center",
  },
  inputField: {
    backgroundColor: "#FFFFFF",
    width: "100%",
    height: 54,
    borderRadius: 30,
    paddingHorizontal: 24,
    fontSize: 16,
    color: "#333",
    marginBottom: 35,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    width: "100%",
    height: 54,
    borderRadius: 30,
    paddingHorizontal: 24,
  },
  inputFieldInside: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    height: "100%",
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
    marginTop: -25,
    marginBottom: 20,
    alignSelf: "flex-start",
    paddingLeft: 10,
  },
  infoText: {
    color: "#555",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
  },
  submitBtn: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnText: {
    color: "#000000",
    fontSize: 18,
    fontWeight: "500",
  },
  changeBtn: {
    marginTop: 20,
    paddingVertical: 6,
  },
  changeBtnText: {
    color: "#555",
    fontSize: 14,
    textDecorationLine: "underline",
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
});
