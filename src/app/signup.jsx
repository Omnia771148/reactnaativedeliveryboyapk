import { LoadingOverlay } from "@/components/loading-overlay";
import { API_URL, fetchWithTimeout } from "@/constants/api";
import { auth, storage } from "@/lib/firebase";
import { FontAwesome, FontAwesome5, Ionicons, MaterialIcons } from "@expo/vector-icons";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useState, useEffect, useRef } from "react";
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const { height: SCREEN_HEIGHT } = Dimensions.get("screen");

// Icon components mapped to Expo Vector Icons
const UserIcon = ({ color = "#aaa" }) => (
  <FontAwesome name="user" size={18} color={color} style={styles.inputIcon} />
);
const PhoneIcon = ({ color = "#aaa" }) => (
  <FontAwesome name="phone" size={18} color={color} style={styles.inputIcon} />
);
const MailIcon = ({ color = "#aaa" }) => (
  <MaterialIcons name="mail-outline" size={18} color={color} style={styles.inputIcon} />
);
const LockIcon = ({ color = "#aaa" }) => (
  <FontAwesome name="lock" size={18} color={color} style={styles.inputIcon} />
);
const BankIcon = ({ color = "#333" }) => (
  <MaterialIcons name="account-balance" size={20} color={color} />
);
const ProofIcon = ({ color = "#333" }) => (
  <FontAwesome5 name="file-alt" size={18} color={color} />
);

// Helper to convert local file URI to a native-backed Blob via XMLHttpRequest
const uriToBlob = (uri) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
      resolve(xhr.response);
    };
    xhr.onerror = function (e) {
      console.error("XHR Blob conversion failed:", e);
      reject(new TypeError("Network request failed"));
    };
    xhr.responseType = "blob";
    xhr.open("GET", uri, true);
    xhr.send(null);
  });
};

export default function DeliveryBoySignup() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    aadharNumber: "",
    rcNumber: "",
    licenseNumber: "",
    accountNumber: "",
    confirmAccountNumber: "",
    ifscCode: "",
  });

  const [selectedFiles, setSelectedFiles] = useState({
    profilePicUrl: null,
    aadharUrl: null,
    rcUrl: null,
    licenseUrl: null,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalType, setModalType] = useState("error"); // 'success' or 'error'
  const [successRedirect, setSuccessRedirect] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [incorrectAttempts, setIncorrectAttempts] = useState(0);
  const [isAccepted, setIsAccepted] = useState(false);

  const handleOpenURL = async (url) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Error", "Cannot open URL: " + url);
      }
    } catch (error) {
      console.error("An error occurred opening the URL: ", error);
      Alert.alert("Error", "Unable to open link");
    }
  };

  const handleModalClose = () => {
    setModalVisible(false);
    if (successRedirect) {
      setSuccessRedirect(false);
      router.replace("/");
    }
  };

  // Handle resend countdown timer (30s)
  useEffect(() => {
    let interval = null;
    if (isOtpSent && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    } else if (resendTimer === 0 && interval) {
      clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOtpSent, resendTimer]);

  // Clear any stale firebase auth session when entering signup screen
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

  const handleFileChange = async (fieldName) => {
    // Request permission to access system photo library
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Sorry, we need camera roll permissions to upload documents.");
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.6, // Natively compress the selected image
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileUri = asset.uri;

        // Extract fileName or generate a default one
        let fileName = fileUri.substring(fileUri.lastIndexOf("/") + 1);
        if (!fileName) {
          fileName = `${fieldName}.jpg`;
        }

        setSelectedFiles((prev) => ({
          ...prev,
          [fieldName]: {
            uri: fileUri,
            name: fileName,
            type: "image/jpeg",
          },
        }));

        // Clear validation error when user selects a file
        if (validationErrors[fieldName]) {
          setValidationErrors((prev) => ({ ...prev, [fieldName]: "" }));
        }
      }
    } catch (err) {
      console.error("Error picking document: ", err);
      Alert.alert("Error", "Could not pick the selected photo.");
    }
  };

  const handleChange = (name, value) => {
    const updatedForm = { ...form, [name]: value };
    setForm(updatedForm);

    // Create copy of errors and remove the current field's error
    let newErrors = { ...validationErrors };
    delete newErrors[name];

    // Real-time mismatch validation for password
    if (name === "confirmPassword" || name === "password") {
      const p = updatedForm.password || "";
      const cp = updatedForm.confirmPassword || "";
      if (cp) {
        if (cp.length >= p.length ? cp !== p : !p.startsWith(cp)) {
          newErrors.confirmPassword = "Passwords do not match.";
        } else {
          delete newErrors.confirmPassword;
        }
      } else {
        delete newErrors.confirmPassword;
      }
    }

    // Real-time mismatch validation for account number
    if (name === "confirmAccountNumber" || name === "accountNumber") {
      const acc = updatedForm.accountNumber || "";
      const cacc = updatedForm.confirmAccountNumber || "";
      if (cacc) {
        if (cacc.length >= acc.length ? cacc !== acc : !acc.startsWith(cacc)) {
          newErrors.confirmAccountNumber = "Account numbers do not match.";
        } else {
          delete newErrors.confirmAccountNumber;
        }
      } else {
        delete newErrors.confirmAccountNumber;
      }
    }

    setValidationErrors(newErrors);
  };

  const sendOtp = async (forceResend = false) => {
    if (!isAccepted && !forceResend) {
      setModalMessage("Please accept the Terms & Conditions and Privacy Policy");
      setModalType("error");
      setModalVisible(true);
      return;
    }

    setErrorMessage("");
    setValidationErrors({});

    const errors = {};

    // Name validation
    if (!form.name.trim()) {
      errors.name = "Delivery partner name is required.";
    }

    // Phone validation
    if (!/^\d{10}$/.test(form.phone)) {
      errors.phone = "Please enter a valid 10-digit phone number.";
    }

    // Email validation
    if (!form.email || !form.email.trim()) {
      errors.email = "Please enter your email.";
    } else if (!form.email.trim().toLowerCase().endsWith("@gmail.com")) {
      errors.email = "Email format should be @gmail.com";
    }

    // Password validation
    if (!form.password) {
      errors.password = "Password is required.";
    } else if (form.password.length < 4) {
      errors.password = "Password must be at least 4 characters.";
    }

    if (!form.confirmPassword) {
      errors.confirmPassword = "Please confirm your password.";
    } else if (form.password !== form.confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }

    // Bank Details Validation
    if (!form.accountNumber) {
      errors.accountNumber = "Account number is required.";
    } else if (!/^\d+$/.test(form.accountNumber)) {
      errors.accountNumber = "Account number must contain only numbers.";
    }

    if (!form.confirmAccountNumber) {
      errors.confirmAccountNumber = "Please confirm your account number.";
    } else if (form.accountNumber !== form.confirmAccountNumber) {
      errors.confirmAccountNumber = "Account numbers do not match.";
    }

    if (!form.ifscCode || !form.ifscCode.trim()) {
      errors.ifscCode = "IFSC code is required.";
    }

    // Document Number validation
    if (!form.aadharNumber) {
      errors.aadharNumber = "Aadhar card number is required.";
    } else if (!/^\d{12}$/.test(form.aadharNumber)) {
      errors.aadharNumber = "Aadhar number must be exactly 12 digits.";
    }
    if (!form.licenseNumber) {
      errors.licenseNumber = "Driving license number is required.";
    }
    if (!form.rcNumber) {
      errors.rcNumber = "RC number is required.";
    }

    // File Upload validation
    if (!selectedFiles.profilePicUrl) {
      errors.profilePicUrl = "Please upload Delivery Boy photo.";
    }
    if (!selectedFiles.aadharUrl) {
      errors.aadharUrl = "Please upload Aadhar card photo.";
    }
    if (!selectedFiles.licenseUrl) {
      errors.licenseUrl = "Please upload Driving license photo.";
    }
    if (!selectedFiles.rcUrl) {
      errors.rcUrl = "Please upload RC photo.";
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setModalMessage("Please enter all the details");
      setModalType("error");
      setModalVisible(true);
      return;
    }

    const formattedPhone = "+91" + form.phone;

    Keyboard.dismiss();
    setIsSendingOtp(true);
    try {
      // Check if phone or email already exists in DB IMMEDIATELY upon clicking Sign up button
      try {
        const checkRes = await fetchWithTimeout(`${API_URL}/api/deliveryboy/check-phone`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: form.phone.trim(),
            formattedPhone: "+91" + form.phone.trim(),
            email: form.email ? form.email.trim().toLowerCase() : ''
          }),
        }, 10000);

        let checkData = null;
        try {
          const text = await checkRes.text();
          checkData = JSON.parse(text);
        } catch (_e) {}

        if (!checkRes.ok || (checkData && (checkData.exists || checkData.alreadyExists || checkData.success === false))) {
          setIsSendingOtp(false);
          setModalMessage(
            (checkData && checkData.message)
              ? checkData.message
              : "User already exists with this phone number or email. Please log in."
          );
          setModalType("error");
          setModalVisible(true);
          return;
        }
      } catch (checkErr) {
        console.error("Check existing user error:", checkErr);
        setIsSendingOtp(false);
        setModalMessage("Unable to verify user account. Please check your network connection and try again.");
        setModalType("error");
        setModalVisible(true);
        return;
      }

      if (Platform.OS === "web") {
        if (window.recaptchaVerifier) {
          window.recaptchaVerifier.clear();
          window.recaptchaVerifier = null;
          const container = document.getElementById("recaptcha-container");
          if (container) container.innerHTML = "";
        }

        window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
          size: "invisible",
          callback: (response) => {
            console.log("Recaptcha solved:", response);
          },
          "expired-callback": () => {
            if (window.recaptchaVerifier) window.recaptchaVerifier.clear();
            window.recaptchaVerifier = null;
          },
        });

        const result = await signInWithPhoneNumber(auth, formattedPhone, window.recaptchaVerifier);
        setConfirmationResult(result);
        setIsOtpSent(true);
        setResendTimer(30);
        setModalMessage("OTP has been sent to your phone number via SMS.");
        setModalType("success");
        setModalVisible(true);
      } else if (isExpoGo) {
        // Native mobile flow - bypass recaptcha issues in Expo Go
        // Since real recaptcha is not supported natively in Expo Go without native builds,
        // we simulate the OTP verification for testing purposes.
        const mockConfirmationResult = {
          confirm: async (verificationCode) => {
            if (verificationCode === "123456") {
              return {
                user: {
                  uid: "mock-uid-" + Math.random().toString(36).substring(7),
                  phoneNumber: formattedPhone
                }
              };
            } else {
              throw new Error("auth/invalid-verification-code");
            }
          }
        };
        setConfirmationResult(mockConfirmationResult);
        setIsOtpSent(true);
        setResendTimer(30);
        setModalMessage("Enter the verification code '123456' to proceed.");
        setModalType("success");
        setModalVisible(true);
      } else {
        // Native APK flow - Real SMS OTP using React Native Firebase Auth
        const nativeAuth = require("@react-native-firebase/auth").default;
        const result = await nativeAuth().signInWithPhoneNumber(formattedPhone, forceResend === true);
        setConfirmationResult(result);
        setIsOtpSent(true);
        setResendTimer(30);
        setModalMessage("OTP has been sent to your phone number via SMS.");
        setModalType("success");
        setModalVisible(true);
      }
    } catch (error) {
      console.error("OTP Error:", error);
      let msg = "Failed to send OTP. Please try again.";
      if (error.code === "auth/too-many-requests" || (error.message && error.message.includes("too-many-requests"))) {
        msg = "Too many OTP requests from this device. Requests have been temporarily blocked due to unusual activity. Please try again later.";
      } else if (error.message) {
        msg = "Failed to send OTP: " + error.message;
      }
      setErrorMessage(msg);
      setModalMessage(msg);
      setModalType("error");
      setModalVisible(true);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    setOtp("");
    setIncorrectAttempts(0);
    await sendOtp(true);
  };

  const submittingRef = useRef(false);
  const hasSubmittedSuccessfullyRef = useRef(false);

  const handleSubmit = async () => {
    if (submittingRef.current || hasSubmittedSuccessfullyRef.current) {
      console.log("Signup submission already in progress or already completed.");
      return;
    }
    submittingRef.current = true;
    const trimmedOtp = otp.trim().replace(/\D/g, "");

    setErrorMessage("");
    Keyboard.dismiss();
    setIsSubmitting(true);

    try {
      // 1. Confirm OTP (check if already auto-verified)
      let firebaseUser = null;
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
        return uDigits.length >= 10 && fDigits.length >= 10 && (uDigits.endsWith(fDigits) || fDigits.endsWith(uDigits));
      };

      if (currentUser && isPhoneMatch(currentUser.phoneNumber, form.phone)) {
        console.log("Already authenticated via auto-verification during signup.");
        firebaseUser = currentUser;
      } else if (confirmationResult && typeof confirmationResult.confirm === "function") {
        if (!trimmedOtp) {
          setModalMessage("Please enter the OTP received.");
          setModalType("error");
          setModalVisible(true);
          setIsSubmitting(false);
          return;
        }
        try {
          const result = await confirmationResult.confirm(trimmedOtp);
          firebaseUser = result ? (result.user || result) : null;
        } catch (confirmError) {
          console.error("OTP Confirmation error:", confirmError);

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

          if (recheckUser && isPhoneMatch(recheckUser.phoneNumber, form.phone)) {
            console.log("Using rechecked authenticated user during signup:", recheckUser);
            firebaseUser = recheckUser;
          } else {
            const newAttempts = incorrectAttempts + 1;
            setIncorrectAttempts(newAttempts);

            let msg = "Incorrect OTP. Please check the code and try again.";
            if (confirmError.code === "auth/session-expired" || (confirmError.message && confirmError.message.includes("session-expired"))) {
              msg = "OTP session expired. Please tap 'Resend OTP' to receive a new code.";
            } else if (newAttempts === 1) {
              msg = "Incorrect OTP. You have only 1 attempt remaining.";
            } else if (newAttempts >= 2) {
              msg = "Incorrect OTP. Too many attempts. Please tap 'Resend OTP'.";
            }
            setModalMessage(msg);
            setModalType("error");
            setModalVisible(true);
            setIsSubmitting(false);
            return;
          }
        }
      }

      if (!firebaseUser || !firebaseUser.uid) {
        setModalMessage("OTP verification failed. Please enter the correct OTP code or tap 'Resend OTP'.");
        setModalType("error");
        setModalVisible(true);
        setIsSubmitting(false);
        return;
      }

      const finalFirebaseUid = firebaseUser.uid;

      // Re-verify that phone or email does not exist in DB before document upload & backend registration
      try {
        const checkRes = await fetchWithTimeout(`${API_URL}/api/deliveryboy/check-phone`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: form.phone.trim(),
            formattedPhone: "+91" + form.phone.trim(),
            email: form.email ? form.email.trim().toLowerCase() : ''
          }),
        }, 10000);
        const checkData = await checkRes.json().catch(() => null);
        if (checkData && (checkData.exists || checkData.alreadyExists || checkRes.status === 400 || checkRes.status === 409)) {
          setModalMessage(checkData.message || "This phone number or email is already registered. Please log in.");
          setModalType("error");
          setModalVisible(true);
          return;
        }
      } catch (checkErr) {
        console.warn("Pre-submission duplicate check warning:", checkErr);
      }

      // 2. Upload documents to Firebase Storage in PARALLEL for maximum speed
      const fileKeys = ["profilePicUrl", "aadharUrl", "rcUrl", "licenseUrl"];
      const uploadPromises = fileKeys.map(async (key) => {
        const fileObj = selectedFiles[key];
        if (!fileObj || !fileObj.uri) {
          return { key, url: "" };
        }

        try {
          const blob = await uriToBlob(fileObj.uri);
          const storageRef = ref(storage, `delivery_docs/${form.phone.trim()}/${key}`);
          await uploadBytes(storageRef, blob);

          if (blob && typeof blob.close === "function") {
            blob.close();
          }

          const url = await getDownloadURL(storageRef);
          return { key, url };
        } catch (uploadErr) {
          console.warn(`Firebase Storage upload failed for ${key}:`, uploadErr);
          return { key, url: fileObj.uri || "" };
        }
      });

      const uploadedFiles = await Promise.all(uploadPromises);
      const uploadResults = {};
      uploadedFiles.forEach(({ key, url }) => {
        uploadResults[key] = url;
      });

      // 3. Register user with Express backend
      const finalFormData = {
        ...form,
        email: form.email ? form.email.trim().toLowerCase() : '',
        ...uploadResults,
        profilePicUrl: uploadResults.profilePicUrl || "",
        photoUrl: uploadResults.profilePicUrl || "",
        deliveryBoyPhotoUrl: uploadResults.profilePicUrl || "",
        photo: uploadResults.profilePicUrl || "",
        firebaseUid: finalFirebaseUid,
        phone: "+91" + form.phone.trim(),
      };

      const res = await fetchWithTimeout(`${API_URL}/api/deliveryboy/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalFormData),
      }, 30000);

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        setModalMessage("Server is temporarily unavailable. Please try again in a moment.");
        setModalType("error");
        setModalVisible(true);
        return;
      }
      const data = await res.json();
      if (res.ok) {
        hasSubmittedSuccessfullyRef.current = true;
        setModalMessage("Signup Request Submitted Successfully!\n\nYour account will be activated within 24 hours after our team review.");
        setModalType("success");
        setSuccessRedirect(true);
        setModalVisible(true);
      } else {
        if (hasSubmittedSuccessfullyRef.current) {
          console.log("Signup already succeeded, ignoring subsequent failure message.");
          return;
        }
        setModalMessage(data.message || "Signup failed");
        setModalType("error");
        setModalVisible(true);
      }
    } catch (error) {
      if (hasSubmittedSuccessfullyRef.current) {
        console.log("Signup already succeeded, ignoring catch error.");
        return;
      }
      console.error("Verification/Signup error:", error);
      let msg = "Signup Failed: " + (error.message || "Unknown error");
      setModalMessage(msg);
      setModalType("error");
      setModalVisible(true);
    } finally {
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  };

  // Listen for automatic SMS code resolution (auto-verification) on Android devices
  useEffect(() => {
    let unsubscribe;
    if (isOtpSent) {
      const formattedPhone = "+91" + form.phone.trim();
      if (Platform.OS !== "web" && !isExpoGo) {
        try {
          const nativeAuth = require("@react-native-firebase/auth").default;
          unsubscribe = nativeAuth().onAuthStateChanged((user) => {
            if (user && user.phoneNumber === formattedPhone) {
              console.log("Firebase native auth auto-verified phone for signup:", user.phoneNumber);
              handleSubmit();
            }
          });
        } catch (err) {
          console.error("Native auth listener setup failed in signup:", err);
        }
      } else {
        const { onAuthStateChanged } = require("firebase/auth");
        unsubscribe = onAuthStateChanged(auth, (user) => {
          if (user && user.phoneNumber === formattedPhone) {
            console.log("Firebase Web SDK auto-verified phone for signup:", user.phoneNumber);
            handleSubmit();
          }
        });
      }
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isOtpSent, form.phone, handleSubmit]);

  return (
    <View style={styles.container}>
      {/* Split background matching CSS rules - fixed height to prevent resize glitches */}
      <View style={[StyleSheet.absoluteFill, { height: SCREEN_HEIGHT }]} pointerEvents="none" collapsable={false}>
        <View style={styles.splitBackground} pointerEvents="none">
          <View style={styles.leftBackground} pointerEvents="none" />
          <View style={styles.rightBackground} pointerEvents="none" />
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
            <Text style={styles.welcomeTitle}>Welcome</Text>
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

          {errorMessage ? (
            <View style={styles.errorAlert}>
              <Text style={styles.errorAlertText}>{errorMessage}</Text>
            </View>
          ) : null}

          {!isOtpSent ? (
            <View style={styles.formWrapper}>
              {/* Delivery Partner Name */}
              <View
                style={[
                  styles.customInputGroup,
                  validationErrors.name && styles.errorBorder,
                ]}
              >
                <UserIcon />
                <TextInput
                  placeholder="Delivery partner name"
                  placeholderTextColor="#aaa"
                  style={styles.customInput}
                  value={form.name}
                  onChangeText={(val) => handleChange("name", val)}
                />
              </View>
              {validationErrors.name && (
                <Text style={styles.errorText}>{validationErrors.name}</Text>
              )}

              {/* Delivery Partner Phone */}
              <View
                style={[
                  styles.customInputGroup,
                  validationErrors.phone && styles.errorBorder,
                ]}
              >
                <PhoneIcon />
                <TextInput
                  placeholder="Delivery partner phone number"
                  placeholderTextColor="#aaa"
                  keyboardType="phone-pad"
                  maxLength={10}
                  style={styles.customInput}
                  value={form.phone}
                  onChangeText={(val) => {
                    const cleaned = val.replace(/\D/g, "").slice(0, 10);
                    handleChange("phone", cleaned);
                  }}
                />
              </View>
              {validationErrors.phone && (
                <Text style={styles.errorText}>{validationErrors.phone}</Text>
              )}

              {/* Delivery Partner Email */}
              <View
                style={[
                  styles.customInputGroup,
                  validationErrors.email && styles.errorBorder,
                ]}
              >
                <MailIcon />
                <TextInput
                  placeholder="Delivery partner Mail"
                  placeholderTextColor="#aaa"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.customInput}
                  value={form.email}
                  onChangeText={(val) => handleChange("email", val)}
                />
              </View>
              {validationErrors.email && (
                <Text style={styles.errorText}>{validationErrors.email}</Text>
              )}

              {/* Password */}
              <View
                style={[
                  styles.customInputGroup,
                  validationErrors.password && styles.errorBorder,
                ]}
              >
                <LockIcon />
                <TextInput
                  placeholder="Password"
                  placeholderTextColor="#aaa"
                  secureTextEntry={!showPassword}
                  style={styles.customInput}
                  value={form.password}
                  onChangeText={(val) => handleChange("password", val)}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showPassword ? "eye-outline" : "eye-off-outline"}
                    size={20}
                    color="#aaa"
                  />
                </TouchableOpacity>
              </View>
              {validationErrors.password && (
                <Text style={styles.errorText}>{validationErrors.password}</Text>
              )}

              {/* Confirm Password */}
              <View
                style={[
                  styles.customInputGroup,
                  validationErrors.confirmPassword && styles.errorBorder,
                ]}
              >
                <LockIcon />
                <TextInput
                  placeholder="Confirm Password"
                  placeholderTextColor="#aaa"
                  secureTextEntry={!showConfirmPassword}
                  style={styles.customInput}
                  value={form.confirmPassword}
                  onChangeText={(val) => handleChange("confirmPassword", val)}
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
              {validationErrors.confirmPassword && (
                <Text style={styles.errorText}>{validationErrors.confirmPassword}</Text>
              )}

              {/* Bank Details Divider */}
              <View style={styles.sectionDivider}>
                <View style={styles.sectionLabel}>
                  <BankIcon />
                  <Text style={styles.sectionLabelText}>Bank details</Text>
                </View>
              </View>

              {/* Account Number */}
              <View
                style={[
                  styles.customInputGroup,
                  validationErrors.accountNumber && styles.errorBorder,
                ]}
              >
                <TextInput
                  placeholder="Enter your account number"
                  placeholderTextColor="#aaa"
                  keyboardType="numeric"
                  style={styles.customInput}
                  value={form.accountNumber}
                  onChangeText={(val) => {
                    const cleaned = val.replace(/\D/g, "");
                    handleChange("accountNumber", cleaned);
                  }}
                />
              </View>
              {validationErrors.accountNumber && (
                <Text style={styles.errorText}>{validationErrors.accountNumber}</Text>
              )}

              {/* Confirm Account Number */}
              <View
                style={[
                  styles.customInputGroup,
                  validationErrors.confirmAccountNumber && styles.errorBorder,
                ]}
              >
                <TextInput
                  placeholder="Confirm your account number"
                  placeholderTextColor="#aaa"
                  keyboardType="numeric"
                  style={styles.customInput}
                  value={form.confirmAccountNumber}
                  onChangeText={(val) => {
                    const cleaned = val.replace(/\D/g, "");
                    handleChange("confirmAccountNumber", cleaned);
                  }}
                />
              </View>
              {validationErrors.confirmAccountNumber && (
                <Text style={styles.errorText}>{validationErrors.confirmAccountNumber}</Text>
              )}

              {/* IFSC Code */}
              <View
                style={[
                  styles.customInputGroup,
                  validationErrors.ifscCode && styles.errorBorder,
                ]}
              >
                <TextInput
                  placeholder="IFSC Code"
                  placeholderTextColor="#aaa"
                  autoCapitalize="characters"
                  style={styles.customInput}
                  value={form.ifscCode}
                  onChangeText={(val) => handleChange("ifscCode", val)}
                />
              </View>
              {validationErrors.ifscCode && (
                <Text style={styles.errorText}>{validationErrors.ifscCode}</Text>
              )}

              {/* Proofs Divider */}
              <View style={styles.sectionDivider}>
                <View style={styles.sectionLabel}>
                  <ProofIcon />
                  <Text style={styles.sectionLabelText}>Proofs</Text>
                </View>
              </View>

              {/* Delivery Boy Photo Upload */}
              <View style={styles.uploadContainer}>
                <Text style={styles.uploadLabel}>Delivery boy photo :</Text>
                <View style={styles.uploadCard}>
                  <TouchableOpacity
                    style={[
                      styles.uploadFileBtn,
                      validationErrors.profilePicUrl && styles.errorBorder,
                    ]}
                    onPress={() => handleFileChange("profilePicUrl")}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.uploadFileBtnText,
                        selectedFiles.profilePicUrl ? styles.fileSelectedText : null,
                      ]}
                    >
                      {selectedFiles.profilePicUrl
                        ? selectedFiles.profilePicUrl.name
                        : "Choose file or photo"}
                    </Text>
                  </TouchableOpacity>
                  {validationErrors.profilePicUrl && (
                    <Text style={styles.uploadErrorText}>{validationErrors.profilePicUrl}</Text>
                  )}
                </View>
              </View>

              {/* Aadhar Upload */}
              <View style={styles.uploadContainer}>
                <Text style={styles.uploadLabel}>Aadhar card :</Text>
                <View style={styles.uploadCard}>
                  <TextInput
                    placeholder="Enter your Aadhar card number"
                    placeholderTextColor="#aaa"
                    keyboardType="numeric"
                    maxLength={12}
                    style={[
                      styles.uploadInputField,
                      validationErrors.aadharNumber && styles.errorBorder,
                    ]}
                    value={form.aadharNumber}
                    onChangeText={(val) => {
                      const cleaned = val.replace(/\D/g, "").slice(0, 12);
                      handleChange("aadharNumber", cleaned);
                    }}
                  />
                  <TouchableOpacity
                    style={[
                      styles.uploadFileBtn,
                      validationErrors.aadharUrl && styles.errorBorder,
                    ]}
                    onPress={() => handleFileChange("aadharUrl")}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.uploadFileBtnText,
                        selectedFiles.aadharUrl ? styles.fileSelectedText : null,
                      ]}
                    >
                      {selectedFiles.aadharUrl
                        ? selectedFiles.aadharUrl.name
                        : "Choose file or photo"}
                    </Text>
                  </TouchableOpacity>
                  {validationErrors.aadharNumber && (
                    <Text style={styles.uploadErrorText}>{validationErrors.aadharNumber}</Text>
                  )}
                  {validationErrors.aadharUrl && (
                    <Text style={styles.uploadErrorText}>{validationErrors.aadharUrl}</Text>
                  )}
                </View>
              </View>

              {/* Driving License Upload */}
              <View style={styles.uploadContainer}>
                <Text style={styles.uploadLabel}>Driving license :</Text>
                <View style={styles.uploadCard}>
                  <TextInput
                    placeholder="Enter your Driving license number"
                    placeholderTextColor="#aaa"
                    style={[
                      styles.uploadInputField,
                      validationErrors.licenseNumber && styles.errorBorder,
                    ]}
                    value={form.licenseNumber}
                    onChangeText={(val) => handleChange("licenseNumber", val)}
                  />
                  <TouchableOpacity
                    style={[
                      styles.uploadFileBtn,
                      validationErrors.licenseUrl && styles.errorBorder,
                    ]}
                    onPress={() => handleFileChange("licenseUrl")}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.uploadFileBtnText,
                        selectedFiles.licenseUrl ? styles.fileSelectedText : null,
                      ]}
                    >
                      {selectedFiles.licenseUrl
                        ? selectedFiles.licenseUrl.name
                        : "Choose file or photo"}
                    </Text>
                  </TouchableOpacity>
                  {validationErrors.licenseNumber && (
                    <Text style={styles.uploadErrorText}>{validationErrors.licenseNumber}</Text>
                  )}
                  {validationErrors.licenseUrl && (
                    <Text style={styles.uploadErrorText}>{validationErrors.licenseUrl}</Text>
                  )}
                </View>
              </View>

              {/* RC Upload */}
              <View style={styles.uploadContainer}>
                <Text style={styles.uploadLabel}>RC number :</Text>
                <View style={styles.uploadCard}>
                  <TextInput
                    placeholder="Enter your RC number"
                    placeholderTextColor="#aaa"
                    style={[
                      styles.uploadInputField,
                      validationErrors.rcNumber && styles.errorBorder,
                    ]}
                    value={form.rcNumber}
                    onChangeText={(val) => handleChange("rcNumber", val)}
                  />
                  <TouchableOpacity
                    style={[
                      styles.uploadFileBtn,
                      validationErrors.rcUrl && styles.errorBorder,
                    ]}
                    onPress={() => handleFileChange("rcUrl")}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.uploadFileBtnText,
                        selectedFiles.rcUrl ? styles.fileSelectedText : null,
                      ]}
                    >
                      {selectedFiles.rcUrl
                        ? selectedFiles.rcUrl.name
                        : "Choose file or photo"}
                    </Text>
                  </TouchableOpacity>
                  {validationErrors.rcNumber && (
                    <Text style={styles.uploadErrorText}>{validationErrors.rcNumber}</Text>
                  )}
                  {validationErrors.rcUrl && (
                    <Text style={styles.uploadErrorText}>{validationErrors.rcUrl}</Text>
                  )}
                </View>
              </View>

              {/* Terms and Conditions & Privacy Policy Acceptance */}
              <View style={styles.checkboxContainer}>
                <TouchableOpacity
                  style={styles.checkboxTouch}
                  onPress={() => setIsAccepted(!isAccepted)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isAccepted ? "checkbox" : "square-outline"}
                    size={22}
                    color={isAccepted ? "#2E7D32" : "#aaa"}
                  />
                </TouchableOpacity>
                <Text style={styles.checkboxText}>
                  I agree to the{" "}
                  <Text
                    style={styles.linkText}
                    onPress={() => handleOpenURL("https://terms-and-conditions-of-delivery-bo.vercel.app/")}
                  >
                    Terms & Conditions
                  </Text>{" "}
                  and{" "}
                  <Text
                    style={styles.linkText}
                    onPress={() => handleOpenURL("https://delivery-partner-privacy-policy.vercel.app/")}
                  >
                    Privacy Policy
                  </Text>
                </Text>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.signupBtn, !isAccepted && styles.signupBtnDisabled]}
                onPress={() => sendOtp(false)}
                disabled={!isAccepted}
                activeOpacity={0.8}
              >
                <Text style={[styles.signupBtnText, !isAccepted && styles.signupBtnTextDisabled]}>Sign up</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* OTP Verification Form */
            <View style={styles.otpCard}>
              <Text style={styles.otpTitle}>Enter OTP</Text>
              <Text style={styles.otpSubtitle}>Sent to +91 {form.phone}</Text>
              <TextInput
                placeholder="000000"
                placeholderTextColor="#aaa"
                keyboardType="numeric"
                maxLength={6}
                autoComplete="sms-otp"
                textContentType="oneTimeCode"
                style={styles.otpInput}
                value={otp}
                onChangeText={(val) => setOtp(val.replace(/\D/g, "").slice(0, 6))}
              />
              <TouchableOpacity
                style={[styles.verifyOtpBtn, isSubmitting && styles.signupBtnDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                <Text style={styles.verifyOtpBtnText}>
                  {isSubmitting ? "Submitting..." : "Verify & Register"}
                </Text>
              </TouchableOpacity>
              <View style={styles.otpActionsContainer}>
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

                <TouchableOpacity
                  onPress={() => setIsOtpSent(false)}
                  activeOpacity={0.7}
                  style={styles.changePhoneBtn}
                >
                  <Text style={styles.changePhoneText}>Change Phone Number</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
      <View id="recaptcha-container" />

      {/* Custom Alert Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={handleModalClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={[
              styles.modalIconCircle,
              modalType === "success" ? styles.modalIconCircleSuccess : styles.modalIconCircleError
            ]}>
              <Ionicons
                name={modalType === "success" ? "checkmark-outline" : "close-outline"}
                size={48}
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
      <LoadingOverlay visible={isSubmitting || isSendingOtp} />
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
    paddingTop: 2,
    paddingBottom: 4,
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
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 40,
  },
  welcomeHeaderContainer: {
    marginBottom: 20,
  },
  welcomeHeader: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 36,
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
    fontSize: 44,
    fontWeight: "normal",
    fontStyle: "normal",
    paddingHorizontal: 12,
    overflow: "visible",
    color: "#333",
    textAlign: "center",
  },
  formWrapper: {
    width: "100%",
    maxWidth: 340,
  },
  customInputGroup: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 35,
    paddingHorizontal: 20,
    height: 54,
    marginBottom: 16,
  },
  inputIcon: {
    marginRight: 14,
  },
  customInput: {
    flex: 1,
    fontSize: 14,
    color: "#333",
  },
  centerInput: {
    textAlign: "center",
    paddingLeft: 0,
  },
  errorBorder: {
    borderWidth: 1.5,
    borderColor: "#E55B49",
  },
  errorText: {
    color: "#E55B49",
    fontSize: 12,
    marginTop: -10,
    marginBottom: 14,
    paddingLeft: 10,
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
  sectionDivider: {
    alignItems: "center",
    marginVertical: 24,
    width: "100%",
  },
  sectionLabel: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 26,
    paddingVertical: 10,
    borderRadius: 35,
    gap: 8,
  },
  sectionLabelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  uploadContainer: {
    width: "100%",
    marginBottom: 18,
  },
  uploadLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 8,
  },
  uploadCard: {
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    borderRadius: 20,
    padding: 16,
  },
  uploadInputField: {
    backgroundColor: "#FFFFFF",
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    marginBottom: 12,
    fontSize: 13,
    color: "#333",
  },
  uploadFileBtn: {
    backgroundColor: "#FFFFFF",
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  uploadFileBtnText: {
    color: "#999",
    fontSize: 13,
  },
  fileSelectedText: {
    color: "#2E7D32", // Green color indicating successful pick
    fontWeight: "500",
  },
  uploadErrorText: {
    color: "#E55B49",
    fontSize: 11,
    marginTop: 4,
  },
  signupBtn: {
    backgroundColor: "#FFFFFF",
    height: 54,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  signupBtnText: {
    color: "#000",
    fontSize: 17,
    fontWeight: "bold",
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
  otpCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 25,
    padding: 30,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
  },
  verifyOtpBtn: {
    backgroundColor: "#000000",
    width: "100%",
    height: 54,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  verifyOtpBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "bold",
  },
  otpTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  otpSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 24,
  },
  otpInput: {
    backgroundColor: "#FAF9F6",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderRadius: 35,
    width: "100%",
    height: 54,
    textAlign: "center",
    fontSize: 22,
    letterSpacing: 8,
    color: "#333",
    marginBottom: 20,
  },
  otpActionsContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginTop: 18,
    gap: 10,
  },
  changePhoneBtn: {
    paddingVertical: 8,
  },
  changePhoneText: {
    color: "#666",
    fontSize: 14,
    textDecorationLine: "underline",
  },
  resendOtpBtn: {
    paddingVertical: 8,
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
  eyeIcon: {
    position: "absolute",
    right: 20,
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
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
    backgroundColor: "#E55B49", // Coral red
  },
  modalIconCircleSuccess: {
    backgroundColor: "#2EBD6B", // Vibrant green
  },
  modalMessageText: {
    fontSize: 22,
    color: "#000000",
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 30,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  modalButton: {
    backgroundColor: "#000000", // Black button
    width: "90%",
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
    paddingHorizontal: 8,
    width: "100%",
  },
  checkboxTouch: {
    marginRight: 10,
  },
  checkboxText: {
    flex: 1,
    fontSize: 13,
    color: "#333",
    lineHeight: 18,
  },
  linkText: {
    color: "#2E7D32",
    fontWeight: "bold",
    textDecorationLine: "underline",
  },
  signupBtnDisabled: {
    backgroundColor: "#E0E0E0",
    opacity: 0.6,
  },
  signupBtnTextDisabled: {
    color: "#888",
  },
});
