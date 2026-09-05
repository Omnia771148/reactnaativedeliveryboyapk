package com.leevon.deliveryboy

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class DeliveryBoyForegroundService : Service() {

    companion object {
        const val CHANNEL_ID = "delivery_boy_foreground_channel_v3"
        const val NOTIFICATION_ID = 1001
        const val ACTION_START = "ACTION_START"
        const val ACTION_STOP = "ACTION_STOP"
        const val EXTRA_TITLE = "EXTRA_TITLE"
        const val EXTRA_BODY = "EXTRA_BODY"
    }

    override fun onCreate() {
        super.onCreate()
        // Guarantee startForeground is called immediately upon service creation to beat the 5-second deadline
        startForegroundInternal("🟢 Delivery Boy — ON", "Searching for nearby orders...")
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        try {
            val restartServiceIntent = Intent(applicationContext, this.javaClass).apply {
                action = ACTION_START
                putExtra(EXTRA_TITLE, "🟢 Delivery Boy — ON")
                putExtra(EXTRA_BODY, "Searching for nearby orders...")
            }
            val pendingFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_ONE_SHOT
            }
            val restartPendingIntent = PendingIntent.getService(
                applicationContext, 1, restartServiceIntent, pendingFlags
            )
            val alarmManager = getSystemService(Context.ALARM_SERVICE) as? android.app.AlarmManager
            alarmManager?.set(android.app.AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + 1000, restartPendingIntent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action

        if (action == ACTION_STOP) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    stopForeground(STOP_FOREGROUND_REMOVE)
                } else {
                    @Suppress("DEPRECATION")
                    stopForeground(true)
                }
                stopSelf()
            } catch (e: Exception) {
                e.printStackTrace()
            }
            return START_NOT_STICKY
        }

        val title = intent?.getStringExtra(EXTRA_TITLE) ?: "🟢 Delivery Boy — ON"
        val body = intent?.getStringExtra(EXTRA_BODY) ?: "Searching for nearby orders..."
        startForegroundInternal(title, body)

        return START_STICKY
    }

    private fun startForegroundInternal(title: String, body: String) {
        try {
            createNotificationChannel()

            val notificationIntent = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }

            val pendingIntentFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }

            val pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent, pendingIntentFlags)

            val smallIconRes = try {
                R.drawable.ic_notification
            } catch (_: Exception) {
                R.mipmap.ic_launcher
            }

            val builder = NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(body)
                .setSmallIcon(smallIconRes)
                .setOngoing(true)
                .setAutoCancel(false)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setContentIntent(pendingIntent)

            val notification: Notification = builder.build().apply {
                flags = flags or Notification.FLAG_ONGOING_EVENT or Notification.FLAG_NO_CLEAR or Notification.FLAG_FOREGROUND_SERVICE
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) { // Android 14+ (API level 34+)
                try {
                    startForeground(
                        NOTIFICATION_ID,
                        notification,
                        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC or
                        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING
                    )
                } catch (e1: Exception) {
                    try {
                        startForeground(
                            NOTIFICATION_ID,
                            notification,
                            android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                        )
                    } catch (e2: Exception) {
                        try {
                            startForeground(
                                NOTIFICATION_ID,
                                notification,
                                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING
                            )
                        } catch (e3: Exception) {
                            try {
                                startForeground(NOTIFICATION_ID, notification)
                            } catch (e4: Exception) {
                                e4.printStackTrace()
                            }
                        }
                    }
                }
            } else {
                try {
                    startForeground(NOTIFICATION_ID, notification)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    "Delivery Active Service",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Keeps delivery app active in background for instant order alerts."
                    setShowBadge(false)
                    lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                }
                val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                manager.createNotificationChannel(channel)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
}
