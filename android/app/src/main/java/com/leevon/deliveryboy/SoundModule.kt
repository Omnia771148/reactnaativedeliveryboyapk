package com.leevon.deliveryboy

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SoundModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var mediaPlayer: MediaPlayer? = null

    override fun getName(): String {
        return "SoundModule"
    }

    @ReactMethod
    fun playSound(promise: Promise? = null) {
        try {
            if (mediaPlayer != null && mediaPlayer!!.isPlaying) {
                promise?.resolve(true)
                return
            }

            stopSoundInternal()

            val resId = reactContext.resources.getIdentifier("ordernotification", "raw", reactContext.packageName)
            if (resId != 0) {
                mediaPlayer = MediaPlayer.create(reactContext, resId)?.apply {
                    setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
                    )
                    isLooping = true
                    start()
                }
                promise?.resolve(true)
            } else {
                promise?.reject("SOUND_ERROR", "Resource ordernotification.raw not found")
            }
        } catch (e: Exception) {
            e.printStackTrace()
            promise?.reject("SOUND_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopSound(promise: Promise? = null) {
        try {
            stopSoundInternal()
            promise?.resolve(true)
        } catch (e: Exception) {
            e.printStackTrace()
            promise?.reject("SOUND_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun isPlaying(promise: Promise) {
        val playing = mediaPlayer?.isPlaying == true
        promise.resolve(playing)
    }

    private fun stopSoundInternal() {
        try {
            mediaPlayer?.let {
                if (it.isPlaying) {
                    it.stop()
                }
                it.reset()
                it.release()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            mediaPlayer = null
        }
    }
}
