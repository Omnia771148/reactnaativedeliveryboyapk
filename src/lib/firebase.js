import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getStorage } from "firebase/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyCt1Vcc11l07gBKpSwdmqz_1d3Kj_hs3VU",
  authDomain: "leevon-delivery-llp-signin-otp.firebaseapp.com",
  projectId: "leevon-delivery-llp-signin-otp",
  storageBucket: "leevon-delivery-llp-signin-otp.firebasestorage.app",
  messagingSenderId: "549037342596",
  appId: "1:549037342596:android:381be50c0304e5368167d1",
};

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize or retrieve Auth instance to prevent "auth/already-initialized" on hot reloads
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (_error) {
  auth = getAuth(app);
}

// Initialize Firebase Storage
const storage = getStorage(app);

export { app, auth, storage };
