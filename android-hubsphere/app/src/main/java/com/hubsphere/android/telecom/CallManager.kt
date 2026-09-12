package com.hubsphere.android.telecom

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.telecom.TelecomManager
import android.telecom.PhoneAccountHandle

class CallManager(private val context: Context) {
    private val telecomManager by lazy {
        context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
    }

    var currentCallId: String? = null
        private set
    var isCallActive: Boolean = false
        private set

    fun placeCall(phoneNumber: String): Boolean {
        val simChecker = SimChecker(context)
        if (!simChecker.hasSim()) return false

        try {
            val uri = Uri.fromParts("tel", phoneNumber, null)
            val phoneAccountHandle = simChecker.getPhoneAccountHandle()

            if (phoneAccountHandle != null) {
                // Use TelecomManager.placeCall for SIM-based calling
                val extras = android.os.Bundle()
                extras.putParcelable(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, phoneAccountHandle)
                telecomManager.placeCall(uri, extras)
            } else {
                // Fallback to ACTION_CALL intent
                val callIntent = Intent(Intent.ACTION_CALL, uri)
                callIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(callIntent)
            }

            currentCallId = System.currentTimeMillis().toString()
            isCallActive = true
            return true
        } catch (e: SecurityException) {
            return false
        } catch (e: Exception) {
            return false
        }
    }

    fun endCall(): Boolean {
        return try {
            telecomManager.endCall()
        } catch (e: Exception) {
            false
        }.also { isCallActive = false; currentCallId = null }
    }

    fun onCallEnded() {
        isCallActive = false
        currentCallId = null
    }
}