package com.leevon.deliveryboy

import android.content.Context
import android.os.Build
import android.os.PowerManager
import android.content.Intent
import android.content.ComponentName
import android.provider.Settings
import android.net.Uri
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class BatteryOptimizationModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "BatteryOptimizationModule"
    }

    @ReactMethod
    fun isBatteryOptimizationEnabled(promise: Promise) {
        val powerManager = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as PowerManager
        val packageName = reactApplicationContext.packageName
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val isIgnoring = powerManager.isIgnoringBatteryOptimizations(packageName)
            promise.resolve(!isIgnoring)
        } else {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun requestIgnoreBatteryOptimization() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val powerManager = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as PowerManager
            val packageName = reactApplicationContext.packageName
            if (!powerManager.isIgnoringBatteryOptimizations(packageName)) {
                try {
                    // Try direct 1-click system dialog (Works on Stock Android, Pixel, Moto, Samsung, etc.)
                    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                        data = Uri.parse("package:$packageName")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    reactApplicationContext.startActivity(intent)
                } catch (e: Exception) {
                    openAppDetailsSettings()
                }
            }
        }
    }

    @ReactMethod
    fun openAppDetailsSettings() {
        val manufacturer = Build.MANUFACTURER.lowercase()
        var intentOpened = false

        try {
            // Smart OEM shortcuts for iQOO, Vivo, Xiaomi, Oppo, Realme
            if (manufacturer.contains("vivo") || manufacturer.contains("iqoo")) {
                try {
                    val intent = Intent().apply {
                        component = ComponentName(
                            "com.vivo.permissionmanager",
                            "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"
                        )
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    reactApplicationContext.startActivity(intent)
                    intentOpened = true
                } catch (e: Exception) {
                    try {
                        val intent = Intent().apply {
                            component = ComponentName(
                                "com.iqoo.secure",
                                "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"
                            )
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                        reactApplicationContext.startActivity(intent)
                        intentOpened = true
                    } catch (ex: Exception) {
                        try {
                            val intent = Intent().apply {
                                component = ComponentName(
                                    "com.iqoo.secure",
                                    "com.iqoo.secure.ui.phoneoptimize.BgStartUpManagerActivity"
                                )
                                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            }
                            reactApplicationContext.startActivity(intent)
                            intentOpened = true
                        } catch (e3: Exception) {
                            try {
                                val intent = Intent().apply {
                                    component = ComponentName(
                                        "com.vivo.permissionmanager",
                                        "com.vivo.permissionmanager.activity.PurviewTabActivity"
                                    )
                                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                }
                                reactApplicationContext.startActivity(intent)
                                intentOpened = true
                            } catch (e4: Exception) {}
                        }
                    }
                }
            } else if (manufacturer.contains("xiaomi") || manufacturer.contains("redmi")) {
                try {
                    val intent = Intent().apply {
                        component = ComponentName(
                            "com.miui.securitycenter",
                            "com.miui.permcenter.autostart.AutoStartManagementActivity"
                        )
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    reactApplicationContext.startActivity(intent)
                    intentOpened = true
                } catch (e: Exception) {}
            } else if (manufacturer.contains("oppo") || manufacturer.contains("realme")) {
                try {
                    val intent = Intent().apply {
                        component = ComponentName(
                            "com.coloros.safecenter",
                            "com.coloros.safecenter.permission.startup.StartupAppListActivity"
                        )
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    reactApplicationContext.startActivity(intent)
                    intentOpened = true
                } catch (e: Exception) {}
            }

            if (!intentOpened) {
                val packageName = reactApplicationContext.packageName
                val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.parse("package:$packageName")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactApplicationContext.startActivity(intent)
            }
        } catch (ex: Exception) {
            try {
                val fallbackIntent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactApplicationContext.startActivity(fallbackIntent)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
}
