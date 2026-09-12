package com.hubsphere.android.device

import android.content.Context
import android.os.Build
import com.hubsphere.android.api.ApiService
import com.hubsphere.android.api.Device
import com.hubsphere.android.auth.AuthManager
import com.hubsphere.android.telecom.SimChecker
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class DeviceManager(private val context: Context) {
    private val apiService by lazy { ApiService.getInstance(context) }

    suspend fun registerDevice(): Device? {
        val simChecker = SimChecker(context)
        val deviceName = Build.MODEL
        val deviceModel = "${Build.MANUFACTURER} ${Build.MODEL}"
        val osVersion = "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})"

        val device = withContext(Dispatchers.IO) {
            apiService.registerDevice(deviceName, deviceModel, osVersion)
        }

        if (device != null) {
            AuthManager.saveDeviceId(device.id)
        }
        return device
    }

    suspend fun pairDevice(pairingToken: String): Device? {
        val deviceId = AuthManager.getDeviceId() ?: return null
        val device = withContext(Dispatchers.IO) {
            apiService.pairDevice(deviceId, pairingToken)
        }
        if (device?.deviceToken != null) {
            AuthManager.saveDeviceToken(device.deviceToken!!)
        }
        return device
    }

    suspend fun sendHeartbeat(): Boolean {
        val deviceId = AuthManager.getDeviceId() ?: return false
        return withContext(Dispatchers.IO) {
            apiService.sendHeartbeat(deviceId, "3.1.0")
        }
    }

    fun getDeviceStatus(): String {
        val deviceToken = AuthManager.getDeviceToken()
        return when {
            deviceToken == null && AuthManager.getDeviceId() == null -> "UNREGISTERED"
            deviceToken == null -> "PAIRING"
            else -> "ACTIVE" // Simplified; actual status comes from API
        }
    }
}