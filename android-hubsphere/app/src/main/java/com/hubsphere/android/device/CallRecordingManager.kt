package com.hubsphere.android.device

import android.content.Context
import android.media.MediaRecorder
import android.os.Build

class CallRecordingManager(private val context: Context) {
    enum class RecordingCapability {
        AVAILABLE, NOT_AVAILABLE, NOT_SUPPORTED
    }

    fun checkRecordingCapability(): RecordingCapability {
        // Honest test — try to create a MediaRecorder and check if it works
        return try {
            val recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(context)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }
            recorder.setAudioSource(MediaRecorder.AudioSource.VOICE_CALL)
            recorder.setOutputFormat(MediaRecorder.OutputFormat.AMR_NB)
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AMR_NB)
            recorder.setOutputFile(context.cacheDir.resolve("test_recording.amr").absolutePath)
            recorder.prepare()
            recorder.release()
            // Clean up test file
            context.cacheDir.resolve("test_recording.amr").delete()
            RecordingCapability.AVAILABLE
        } catch (e: Exception) {
            // Recording NOT available on this device/carrier
            RecordingCapability.NOT_AVAILABLE
        }
    }

    // NEVER fake recording data
    fun getRecordingStatus(): String {
        return when (checkRecordingCapability()) {
            RecordingCapability.AVAILABLE -> "AVAILABLE"
            RecordingCapability.NOT_AVAILABLE -> "NOT_AVAILABLE"
            RecordingCapability.NOT_SUPPORTED -> "NOT_SUPPORTED"
        }
    }
}