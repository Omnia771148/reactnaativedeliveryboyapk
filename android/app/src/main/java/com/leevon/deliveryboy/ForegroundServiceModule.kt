package com.leevon.deliveryboy

import android.content.Context
import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class ForegroundServiceModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "ForegroundServiceModule"
    }

    @ReactMethod
    fun startService(title: String, body: String, promise: Promise) {
        try {
            // Android 13+ (API 33+) requires POST_NOTIFICATIONS permission to start foreground service.
            // If not granted yet, gracefully return false to prevent ForegroundServiceDidNotStartInTimeException crash.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                val hasNotificationPermission = androidx.core.content.ContextCompat.checkSelfPermission(
                    reactApplicationContext,
                    android.Manifest.permission.POST_NOTIFICATIONS
                ) == android.content.pm.PackageManager.PERMISSION_GRANTED

                if (!hasNotificationPermission) {
                    android.util.Log.w("ForegroundService", "Cannot start foreground service: POST_NOTIFICATIONS permission not granted yet.")
                    promise.resolve(false)
                    return
                }
            }

            val intent = Intent(reactApplicationContext, DeliveryBoyForegroundService::class.java).apply {
                action = DeliveryBoyForegroundService.ACTION_START
                putExtra(DeliveryBoyForegroundService.EXTRA_TITLE, title)
                putExtra(DeliveryBoyForegroundService.EXTRA_BODY, body)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactApplicationContext.startForegroundService(intent)
            } else {
                reactApplicationContext.startService(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            e.printStackTrace()
            promise.reject("ERR_FOREGROUND_SERVICE", e.message)
        }
    }

    @ReactMethod
    fun stopService(promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, DeliveryBoyForegroundService::class.java).apply {
                action = DeliveryBoyForegroundService.ACTION_STOP
            }
            reactApplicationContext.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERR_STOP_SERVICE", e.message)
        }
    }
}
