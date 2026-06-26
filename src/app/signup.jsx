import { LoadingOverlay } from "@/components/loading-overlay";
import { API_URL, fetchWithTimeout } from "@/constants/api";
import { auth, storage } from "@/lib/firebase";
import { FontAwesome, FontAwesome5, Ionicons, MaterialIcons } from "@expo/vector-icons";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useState } from "react";
import {
  Alert,
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
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

  const handleModalClose = () => {
    setModalVisible(false);
    if (successRedirect) {
      setSuccessRedirect(false);
      router.replace("/");
    }
  };

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
      if (updatedForm.confirmPassword && updatedForm.password !== updatedForm.confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match.";
      } else {
        delete newErrors.confirmPassword;
      }
    }

    // Real-time mismatch validation for account number
    if (name === "confirmAccountNumber" || name === "accountNumber") {
      if (updatedForm.confirmAccountNumber && updatedForm.accountNumber !== updatedForm.confirmAccountNumber) {
        newErrors.confirmAccountNumber = "Account numbers do not match.";
      } else {
        delete newErrors.confirmAccountNumber;
      }
    }

    setValidationErrors(newErrors);
  };

  const sendOtp = async () => {
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

    setIsSendingOtp(true);
    try {
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
        setModalMessage("OTP has been sent to your phone number via SMS.");
        setModalType("success");
        setModalVisible(true);
      } else if (isExpoGo) {
        // Native mobile flow - bypass recaptcha issues in Expo Go
        // Since real recaptcha is not supported natively in Expo Go without native builds,
        // we simulate the OTP verification for testing purposes.
        const mockConfirmationResult = {
          confirm: async (verificationCode) => {
            if (verificationCode === "123456" || verificationCode === otp) {
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
        setModalMessage("Enter the verification code '123456' to proceed.");
        setModalType("success");
        setModalVisible(true);
      } else {
        // Native APK flow - Real SMS OTP using React Native Firebase Auth
        const nativeAuth = require("@react-native-firebase/auth").default;
        const result = await nativeAuth().signInWithPhoneNumber(formattedPhone);
        setConfirmationResult(result);
        setIsOtpSent(true);
        setModalMessage("OTP has been sent to your phone number via SMS.");
        setModalType("success");
        setModalVisible(true);
      }
    } catch (error) {
      console.error("OTP Error:", error);
      let msg = "Failed to send OTP: " + (error.message || "Unknown error");
      setErrorMessage(msg);
      setModalMessage(msg);
      setModalType("error");
      setModalVisible(true);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleSubmit = async () => {
    const trimmedOtp = otp.trim();
    if (!trimmedOtp) {
      setModalMessage("Please enter the OTP received.");
      setModalType("error");
      setModalVisible(true);
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      // 1. Confirm OTP (check if already auto-verified)
      let firebaseUser = null;
      let currentUser = null;
      if (Platform.OS !== "web" && !isExpoGo) {
        const nativeAuth = require("@react-native-firebase/auth").default;
        currentUser = nativeAuth().currentUser;
      } else {
        currentUser = auth.currentUser;
      }

      if (currentUser) {
        console.log("Already authenticated via auto-verification during signup.");
        firebaseUser = currentUser;
      } else {
        const result = await confirmationResult.confirm(trimmedOtp);
        firebaseUser = result.user;
      }

      const uploadResults = {};
      const fileKeys = ["aadharUrl", "rcUrl", "licenseUrl"];

      // 2. Upload documents to Firebase Storage using native-backed Blobs
      for (const key of fileKeys) {
        const fileObj = selectedFiles[key];
        const blob = await uriToBlob(fileObj.uri);
        const storageRef = ref(storage, `delivery_docs/${form.phone.trim()}/${key}`);
        await uploadBytes(storageRef, blob);

        // Release the native blob resource once uploaded
        if (typeof blob.close === "function") {
          blob.close();
        }

        const url = await getDownloadURL(storageRef);
        uploadResults[key] = url;
      }

      // 3. Register user with Express backend
      const finalFormData = {
        ...form,
        ...uploadResults,
        firebaseUid: firebaseUser.uid,
        phone: "+91" + form.phone,
      };

      const res = await fetchWithTimeout(`${API_URL}/api/deliveryboy/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalFormData),
      }, 15000);

      const data = await res.json();
      if (res.ok) {
        setModalMessage(data.message || "Signup Request Submitted!");
        setModalType("success");
        setSuccessRedirect(true);
        setModalVisible(true);
      } else {
        setModalMessage(data.message || "Signup failed");
        setModalType("error");
        setModalVisible(true);
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error("Verification/Signup error:", error);
      const msg = "Signup Failed: " + (error.message || "Unknown error");
      setModalMessage(msg);
      setModalType("error");
      setModalVisible(true);
      setIsSubmitting(false);
    }
  };

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
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace("/")}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#333" />
        </TouchableOpacity>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={Keyboard.dismiss}
        >
          {/* Welcome Header */}
          <View style={styles.welcomeHeaderContainer}>
            <View style={styles.welcomeHeader}>
              <Text style={styles.welcomeTitle}> Welcome </Text>
            </View>
          </View>

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
                  maxLength={11}
                  style={styles.customInput}
                  value={form.ifscCode}
                  onChangeText={(val) => {
                    const cleaned = val.toUpperCase().replace(/[^A-Z0-9]/g, "");
                    handleChange("ifscCode", cleaned);
                  }}
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

              {/* Submit Button */}
              <TouchableOpacity
                style={styles.signupBtn}
                onPress={sendOtp}
                activeOpacity={0.8}
              >
                <Text style={styles.signupBtnText}>Sign up</Text>
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
                style={styles.otpInput}
                value={otp}
                onChangeText={setOtp}
              />
              <TouchableOpacity
                style={styles.signupBtn}
                onPress={handleSubmit}
                activeOpacity={0.8}
              >
                <Text style={styles.signupBtnText}>Verify & Register</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsOtpSent(false)}
                activeOpacity={0.7}
                style={styles.changePhoneBtn}
              >
                <Text style={styles.changePhoneText}>Change Phone Number</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
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
    paddingTop: 80,
    paddingBottom: 40,
  },
  welcomeHeaderContainer: {
    marginBottom: 30,
  },
  welcomeHeader: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 50,
    paddingVertical: 12,
    borderRadius: 35,
  },
  welcomeTitle: {
    fontFamily: "CursiveScript",
    fontSize: 50,
    fontWeight: "normal",
    fontStyle: "normal",
    paddingHorizontal: 20,
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
    backgroundColor: "#FDEDEC",
    borderWidth: 1,
    borderColor: "#E55B49",
    borderRadius: 10,
    padding: 12,
    width: "100%",
    maxWidth: 340,
    marginBottom: 20,
  },
  errorAlertText: {
    color: "#E55B49",
    fontSize: 14,
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
  changePhoneBtn: {
    marginTop: 16,
    paddingVertical: 8,
  },
  changePhoneText: {
    color: "#666",
    fontSize: 14,
    textDecorationLine: "underline",
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
});
