package com.hubsphere.android.telecom

import android.content.Context
import android.telephony.TelephonyManager

class SimChecker(private val context: Context) {
    private val telephonyManager by lazy {
        context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
    }

    fun hasSim(): Boolean {
        return telephonyManager.simState == TelephonyManager.SIM_STATE_READY
    }

    fun getOperatorName(): String {
        return telephonyManager.simOperatorName ?: "Unknown"
    }

    fun getCountryCode(): String {
        return telephonyManager.simCountryIso?.uppercase() ?: ""
    }

    fun getPhoneNumber(): String? {
        return try { telephonyManager.line1Number } catch (e: SecurityException) { null }
    }

    fun getSimState(): String {
        return when (telephonyManager.simState) {
            TelephonyManager.SIM_STATE_ABSENT -> "ABSENT"
            TelephonyManager.SIM_STATE_READY -> "READY"
            TelephonyManager.SIM_STATE_PIN_REQUIRED -> "PIN_REQUIRED"
            TelephonyManager.SIM_STATE_PUK_REQUIRED -> "PUK_REQUIRED"
            TelephonyManager.SIM_STATE_NETWORK_LOCKED -> "NETWORK_LOCKED"
            else -> "UNKNOWN"
        }
    }

    fun getPhoneAccountHandle(): android.telecom.PhoneAccountHandle? {
        if (!hasSim()) return null
        return try {
            val telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as android.telecom.TelecomManager
            telecomManager.phoneAccounts.firstOrNull()
        } catch (e: Exception) { null }
    }
}