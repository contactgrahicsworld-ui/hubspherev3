#!/usr/bin/env python3
"""Generate all HubSphere Android Kotlin source files."""
import os

PKG = "/home/z/my-project/android-hubsphere/app/src/main/java/com/hubsphere/android"

def write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        f.write(content)
    print(f"  ✅ {os.path.relpath(path, '/home/z/my-project/android-hubsphere')}")

# ============================================================
# 1. HubSphereApp.kt
# ============================================================
write(f"{PKG}/HubSphereApp.kt", '''package com.hubsphere.android

import android.app.Application
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.hubsphere.android.auth.AuthManager
import com.hubsphere.android.sync.SyncWorker
import java.util.concurrent.TimeUnit

class HubSphereApp : Application() {
    override fun onCreate() {
        super.onCreate()
        AuthManager.init(this)
        schedulePeriodicSync()
    }

    private fun schedulePeriodicSync() {
        val syncRequest = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(androidx.work.Constraints.Builder()
                .setRequiredNetworkType(androidx.work.NetworkType.CONNECTED)
                .build())
            .build()
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "hubsphere_sync",
            androidx.work.ExistingPeriodicWorkPolicy.KEEP,
            syncRequest
        )
    }
}''')

# ============================================================
# 2. AuthManager.kt
# ============================================================
write(f"{PKG}/auth/AuthManager.kt", '''package com.hubsphere.android.auth

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.hubsphere.android.api.ApiService

object AuthManager {
    private const val PREFS_NAME = "hubsphere_auth"
    private const val KEY_ACCESS_TOKEN = "access_token"
    private const val KEY_REFRESH_TOKEN = "refresh_token"
    private const val KEY_USER_ID = "user_id"
    private const val KEY_USER_NAME = "user_name"
    private const val KEY_USER_EMAIL = "user_email"
    private const val KEY_TENANT_ID = "tenant_id"
    private const val KEY_TENANT_NAME = "tenant_name"
    private const val KEY_DEVICE_TOKEN = "device_token"
    private const val KEY_DEVICE_ID = "device_id"

    const val DEVICE_TYPE = "ANDROID"

    private lateinit var prefs: SharedPreferences
    private lateinit var apiService: ApiService

    fun init(context: Context) {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        prefs = EncryptedSharedPreferences.create(
            context, PREFS_NAME, masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
        apiService = ApiService.getInstance(context)
    }

    fun saveTokens(accessToken: String, refreshToken: String) {
        prefs.edit()
            .putString(KEY_ACCESS_TOKEN, accessToken)
            .putString(KEY_REFRESH_TOKEN, refreshToken)
            .apply()
    }

    fun getAccessToken(): String? = prefs.getString(KEY_ACCESS_TOKEN, null)
    fun getRefreshToken(): String? = prefs.getString(KEY_REFRESH_TOKEN, null)

    fun saveUser(id: String, name: String, email: String, tenantId: String, tenantName: String) {
        prefs.edit()
            .putString(KEY_USER_ID, id)
            .putString(KEY_USER_NAME, name)
            .putString(KEY_USER_EMAIL, email)
            .putString(KEY_TENANT_ID, tenantId)
            .putString(KEY_TENANT_NAME, tenantName)
            .apply()
    }

    fun getUserId(): String? = prefs.getString(KEY_USER_ID, null)
    fun getUserName(): String? = prefs.getString(KEY_USER_NAME, null)
    fun getUserEmail(): String? = prefs.getString(KEY_USER_EMAIL, null)
    fun getTenantId(): String? = prefs.getString(KEY_TENANT_ID, null)
    fun getTenantName(): String? = prefs.getString(KEY_TENANT_NAME, null)

    fun saveDeviceToken(token: String) { prefs.edit().putString(KEY_DEVICE_TOKEN, token).apply() }
    fun getDeviceToken(): String? = prefs.getString(KEY_DEVICE_TOKEN, null)
    fun saveDeviceId(id: String) { prefs.edit().putString(KEY_DEVICE_ID, id).apply() }
    fun getDeviceId(): String? = prefs.getString(KEY_DEVICE_ID, null)

    fun isLoggedIn(): Boolean = getAccessToken() != null && getUserId() != null

    suspend fun refreshAccessToken(): String? {
        val refreshToken = getRefreshToken() ?: return null
        return try {
            val result = apiService.refreshToken(refreshToken)
            if (result != null) {
                saveTokens(result.accessToken, result.refreshToken)
                result.accessToken
            } else null
        } catch (e: Exception) { null }
    }

    fun logout() {
        prefs.edit().clear().apply()
    }
}''')

# ============================================================
# 3. LoginActivity.kt
# ============================================================
write(f"{PKG}/auth/LoginActivity.kt", '''package com.hubsphere.android.auth

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText
import com.hubsphere.android.R
import com.hubsphere.android.api.ApiService
import com.hubsphere.android.telecom.SimChecker
import com.hubsphere.android.ui.MainActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class LoginActivity : AppCompatActivity() {
    private lateinit var etEmail: TextInputEditText
    private lateinit var etPassword: TextInputEditText
    private lateinit var btnLogin: MaterialButton
    private lateinit var progressBar: ProgressBar
    private lateinit var tvSimStatus: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        etEmail = findViewById(R.id.etEmail)
        etPassword = findViewById(R.id.etPassword)
        btnLogin = findViewById(R.id.btnLogin)
        progressBar = findViewById(R.id.progressBar)
        tvSimStatus = findViewById(R.id.tvSimStatus)

        // Show SIM status
        val simChecker = SimChecker(this)
        if (simChecker.hasSim()) {
            tvSimStatus.text = "SIM: ${simChecker.getOperatorName()} (${simChecker.getCountryCode()})"
        } else {
            tvSimStatus.text = getString(R.string.no_sim_detected)
            tvSimStatus.setTextColor(getColor(R.color.status_revoked))
        }

        // Auto-login if already authenticated
        if (AuthManager.isLoggedIn()) {
            navigateToMain()
            return
        }

        btnLogin.setOnClickListener { performLogin() }
    }

    private fun performLogin() {
        val email = etEmail.text?.toString()?.trim() ?: ""
        val password = etPassword.text?.toString() ?: ""
        if (email.isEmpty() || password.isEmpty()) return

        btnLogin.isEnabled = false
        progressBar.visibility = View.VISIBLE

        CoroutineScope(Dispatchers.Main).launch {
            try {
                val apiService = ApiService.getInstance(this@LoginActivity)
                val result = withContext(Dispatchers.IO) {
                    apiService.login(email, password, AuthManager.DEVICE_TYPE)
                }
                if (result != null) {
                    AuthManager.saveTokens(result.accessToken, result.refreshToken)
                    AuthManager.saveUser(
                        result.user.id,
                        result.user.name ?: "",
                        result.user.email,
                        result.tenant?.id ?: "",
                        result.tenant?.name ?: ""
                    )
                    navigateToMain()
                } else {
                    showError("Invalid credentials")
                }
            } catch (e: Exception) {
                showError(e.message ?: "Login failed")
            } finally {
                btnLogin.isEnabled = true
                progressBar.visibility = View.GONE
            }
        }
    }

    private fun showError(msg: String) {
        etPassword.error = msg
    }

    private fun navigateToMain() {
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}''')

# ============================================================
# 4. ApiService.kt
# ============================================================
write(f"{PKG}/api/ApiService.kt", '''package com.hubsphere.android.api

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.hubsphere.android.auth.AuthManager
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

class ApiService private constructor(private val context: Context) {
    companion object {
        private const val BASE_URL = "https://hubspherev3.vercel.app"
        private const val API_PREFIX = "/api/v1"
        private val JSON_MEDIA_TYPE = "application/json".toMediaType()
        private var instance: ApiService? = null

        fun getInstance(context: Context): ApiService {
            return instance ?: ApiService(context.applicationContext).also { instance = it }
        }
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val gson = Gson()

    private fun authRequestBuilder(): Request.Builder {
        val builder = Request.Builder()
        AuthManager.getAccessToken()?.let { builder.header("Authorization", "Bearer $it") }
        return builder
    }

    private fun deviceAuthRequestBuilder(): Request.Builder {
        val builder = Request.Builder()
        AuthManager.getDeviceToken()?.let { builder.header("X-Device-Token", it) }
        return builder
    }

    private suspend fun executeRequest(request: Request): String? {
        return kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            try {
                val response = client.newCall(request).execute()
                if (response.code == 401) {
                    // Try refresh
                    val newToken = AuthManager.refreshAccessToken()
                    if (newToken != null) {
                        val newRequest = request.newBuilder()
                            .header("Authorization", "Bearer $newToken")
                            .build()
                        val retryResponse = client.newCall(newRequest).execute()
                        if (retryResponse.isSuccessful) retryResponse.body?.string() else null
                    } else null
                } else if (response.isSuccessful) {
                    response.body?.string()
                } else null
            } catch (e: IOException) { null }
        }
    }

    // AUTH
    suspend fun login(email: String, password: String, deviceType: String): LoginResponse? {
        val body = gson.toJson(mapOf("email" to email, "password" to password, "deviceType" to deviceType, "deviceInfo" to "HubSphere-Android/3.1.0"))
        val request = Request.Builder()
            .url("$BASE_URL$API_PREFIX/auth/login")
            .post(body.toRequestBody(JSON_MEDIA_TYPE))
            .build()
        val response = executeRequest(request) ?: return null
        val apiResp = gson.fromJson(response, ApiResponse::class.java)
        return if (apiResp.success) gson.fromJson(gson.toJson(apiResp.data), LoginResponse::class.java) else null
    }

    suspend fun refreshToken(token: String): LoginResponse? {
        val body = gson.toJson(mapOf("refreshToken" to token))
        val request = Request.Builder()
            .url("$BASE_URL$API_PREFIX/auth/refresh")
            .post(body.toRequestBody(JSON_MEDIA_TYPE))
            .build()
        val response = executeRequest(request) ?: return null
        val apiResp = gson.fromJson(response, ApiResponse::class.java)
        return if (apiResp.success) gson.fromJson(gson.toJson(apiResp.data), LoginResponse::class.java) else null
    }

    // CRM
    suspend fun getContacts(page: Int = 1, limit: Int = 20, search: String? = null): List<Contact>? {
        var url = "$BASE_URL$API_PREFIX/crm/contacts?page=$page&limit=$limit"
        search?.let { url += "&search=$it" }
        val request = authRequestBuilder().url(url).get().build()
        val response = executeRequest(request) ?: return null
        val type = object : TypeToken<ApiResponse<List<Contact>>>() {}.type
        val apiResp: ApiResponse<List<Contact>> = gson.fromJson(response, type)
        return if (apiResp.success) apiResp.data else null
    }

    suspend fun getLeads(page: Int = 1, limit: Int = 20, search: String? = null): List<Lead>? {
        var url = "$BASE_URL$API_PREFIX/crm/leads?page=$page&limit=$limit"
        search?.let { url += "&search=$it" }
        val request = authRequestBuilder().url(url).get().build()
        val response = executeRequest(request) ?: return null
        val type = object : TypeToken<ApiResponse<List<Lead>>>() {}.type
        val apiResp: ApiResponse<List<Lead>> = gson.fromJson(response, type)
        return if (apiResp.success) apiResp.data else null
    }

    suspend fun getCalls(page: Int = 1, limit: Int = 20): List<CallRecord>? {
        val url = "$BASE_URL$API_PREFIX/crm/calls?page=$page&limit=$limit"
        val request = authRequestBuilder().url(url).get().build()
        val response = executeRequest(request) ?: return null
        val type = object : TypeToken<ApiResponse<List<CallRecord>>>() {}.type
        val apiResp: ApiResponse<List<CallRecord>> = gson.fromJson(response, type)
        return if (apiResp.success) apiResp.data else null
    }

    // DEVICES
    suspend fun registerDevice(deviceName: String, deviceModel: String, osVersion: String): Device? {
        val body = gson.toJson(mapOf("deviceName" to deviceName, "deviceModel" to deviceModel, "osVersion" to osVersion))
        val request = authRequestBuilder()
            .url("$BASE_URL$API_PREFIX/devices")
            .post(body.toRequestBody(JSON_MEDIA_TYPE))
            .build()
        val response = executeRequest(request) ?: return null
        val apiResp = gson.fromJson(response, ApiResponse::class.java)
        return if (apiResp.success) gson.fromJson(gson.toJson(apiResp.data), Device::class.java) else null
    }

    suspend fun pairDevice(deviceId: String, pairingToken: String): Device? {
        val body = gson.toJson(mapOf("pairingToken" to pairingToken))
        val request = authRequestBuilder()
            .url("$BASE_URL$API_PREFIX/devices/$deviceId/pair")
            .post(body.toRequestBody(JSON_MEDIA_TYPE))
            .build()
        val response = executeRequest(request) ?: return null
        val apiResp = gson.fromJson(response, ApiResponse::class.java)
        return if (apiResp.success) gson.fromJson(gson.toJson(apiResp.data), Device::class.java) else null
    }

    suspend fun sendHeartbeat(deviceId: String, appVersion: String): Boolean {
        val body = gson.toJson(mapOf("appVersion" to appVersion))
        val request = deviceAuthRequestBuilder()
            .url("$BASE_URL$API_PREFIX/devices/$deviceId/heartbeat")
            .post(body.toRequestBody(JSON_MEDIA_TYPE))
            .build()
        val response = executeRequest(request) ?: return false
        val apiResp = gson.fromJson(response, ApiResponse::class.java)
        return apiResp.success
    }

    // CALL EVENTS (with device auth)
    suspend fun createCallEvent(callRequestId: String, eventType: String, eventData: Map<String, Any> = emptyMap(), eventId: String): CallEvent? {
        val body = gson.toJson(mapOf("callRequestId" to callRequestId, "eventType" to eventType, "eventData" to eventData, "eventId" to eventId))
        val request = deviceAuthRequestBuilder()
            .url("$BASE_URL$API_PREFIX/call-events")
            .post(body.toRequestBody(JSON_MEDIA_TYPE))
            .build()
        val response = executeRequest(request) ?: return null
        val apiResp = gson.fromJson(response, ApiResponse::class.java)
        return if (apiResp.success) gson.fromJson(gson.toJson(apiResp.data), CallEvent::class.java) else null
    }

    // CALL REQUESTS
    suspend fun getCallRequests(status: String? = null): List<CallRequest>? {
        var url = "$BASE_URL$API_PREFIX/call-requests?limit=50"
        status?.let { url += "&status=$it" }
        val request = authRequestBuilder().url(url).get().build()
        val response = executeRequest(request) ?: return null
        val type = object : TypeToken<ApiResponse<List<CallRequest>>>() {}.type
        val apiResp: ApiResponse<List<CallRequest>> = gson.fromJson(response, type)
        return if (apiResp.success) apiResp.data else null
    }

    // APP UPDATE (SEPARATE from data sync)
    suspend fun checkForUpdate(currentVersion: String): AppUpdateInfo? {
        val url = "$BASE_URL$API_PREFIX/app-update?platform=android&currentVersion=$currentVersion"
        val request = Request.Builder().url(url).get().build()
        val response = executeRequest(request) ?: return null
        val apiResp = gson.fromJson(response, ApiResponse::class.java)
        return if (apiResp.success) gson.fromJson(gson.toJson(apiResp.data), AppUpdateInfo::class.java) else null
    }
}''')

# ============================================================
# 5. ApiModels.kt
# ============================================================
write(f"{PKG}/api/ApiModels.kt", '''package com.hubsphere.android.api

data class ApiResponse(
    val success: Boolean = false,
    val message: String? = null,
    val data: Any? = null
)

data class LoginResponse(
    val accessToken: String,
    val refreshToken: String,
    val user: UserBrief,
    val tenant: TenantBrief?,
    val role: String?
)

data class UserBrief(
    val id: String,
    val email: String,
    val name: String?,
    val isSuperAdmin: Boolean = false,
    val status: String = "ACTIVE",
    val avatarUrl: String? = null
)

data class TenantBrief(
    val id: String,
    val name: String,
    val status: String = "ACTIVE"
)

data class Contact(
    val id: String,
    val firstName: String? = null,
    val lastName: String? = null,
    val email: String? = null,
    val phone: String? = null,
    val company: String? = null,
    val companyId: String? = null,
    val status: String? = null,
    val createdAt: String? = null
) {
    val displayName: String get() = "${firstName ?: ""} ${lastName ?: ""}".trim().ifEmpty { "Unknown" }
}

data class Lead(
    val id: String,
    val firstName: String? = null,
    val lastName: String? = null,
    val email: String? = null,
    val phone: String? = null,
    val company: String? = null,
    val status: String = "NEW",
    val value: Double? = null,
    val createdAt: String? = null
) {
    val displayName: String get() = "${firstName ?: ""} ${lastName ?: ""}".trim().ifEmpty { "Unknown" }
}

data class CallRecord(
    val id: String,
    val direction: String? = null,
    val callType: String? = null,
    val callStatus: String? = null,
    val callStartTime: String? = null,
    val callEndTime: String? = null,
    val duration: Int? = null,
    val recordingStatus: String? = null,
    val recordingUrl: String? = null,
    val failureReason: String? = null,
    val createdAt: String? = null
)

data class Device(
    val id: String,
    val deviceName: String? = null,
    val deviceModel: String? = null,
    val osVersion: String? = null,
    val appVersion: String? = null,
    val simOperator: String? = null,
    val simCountry: String? = null,
    val phoneNumber: String? = null,
    val status: String = "UNREGISTERED",
    val pairingToken: String? = null,
    val deviceToken: String? = null,
    val lastHeartbeatAt: String? = null,
    val createdAt: String? = null
)

data class CallRequest(
    val id: String,
    val deviceId: String,
    val requestedBy: String,
    val phoneNumber: String,
    val contactName: String? = null,
    val status: String = "PENDING",
    val callId: String? = null,
    val expiresAt: String? = null,
    val createdAt: String? = null
)

data class CallEvent(
    val id: String,
    val callRequestId: String,
    val deviceId: String,
    val eventType: String,
    val eventData: Map<String, Any>? = null,
    val eventId: String,
    val duration: Int? = null,
    val failureReason: String? = null,
    val recordingAvailable: Boolean? = null,
    val recordingUrl: String? = null,
    val createdAt: String? = null
)

data class AppUpdateInfo(
    val updateAvailable: Boolean = false,
    val isMandatory: Boolean = false,
    val isCompatible: Boolean = true,
    val currentVersion: String = "",
    val latestVersion: String = "",
    val latestRelease: VersionRelease? = null,
    val action: String = "NO_UPDATE",
    val deprecationWarning: String? = null
)

data class VersionRelease(
    val version: String,
    val releaseDate: String,
    val changelog: List<String> = emptyList(),
    val mandatory: Boolean = false,
    val securityUpdate: Boolean = false
)''')

# ============================================================
# 6. SimChecker.kt
# ============================================================
write(f"{PKG}/telecom/SimChecker.kt", '''package com.hubsphere.android.telecom

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
}''')

# ============================================================
# 7. CallManager.kt
# ============================================================
write(f"{PKG}/telecom/CallManager.kt", '''package com.hubsphere.android.telecom

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
}''')

# ============================================================
# 8. HubSphereInCallService.kt
# ============================================================
write(f"{PKG}/telecom/HubSphereInCallService.kt", '''package com.hubsphere.android.telecom

import android.telecom.Call
import android.telecom.InCallService
import com.hubsphere.android.sync.OfflineQueue
import java.util.UUID

class HubSphereInCallService : InCallService() {
    private val offlineQueue by lazy { OfflineQueue(this) }

    override fun onCallAdded(call: Call) {
        super.onCallAdded(call)
        call.registerCallback(object : Call.Callback() {
            override fun onStateChanged(call: Call, state: Int) {
                handleCallState(call, state)
            }
        })
        // Initial state check
        handleCallState(call, call.state)
    }

    override fun onCallRemoved(call: Call) {
        super.onCallRemoved(call)
    }

    private fun handleCallState(call: Call, state: Int) {
        val eventType = when (state) {
            Call.STATE_DIALING -> "CALL_STARTED"
            Call.STATE_RINGING -> "RINGING"
            Call.STATE_ACTIVE -> "CONNECTED"
            Call.STATE_DISCONNECTED -> {
                val disconnectCause = call.details?.disconnectCause
                when (disconnectCause?.code) {
                    android.telecom.DisconnectCause.LOCAL -> "ENDED"
                    android.telecom.DisconnectCause.REMOTE -> "ENDED"
                    android.telecom.DisconnectCause.MISSED -> "MISSED"
                    android.telecom.DisconnectCause.REJECTED -> "MISSED"
                    android.telecom.DisconnectCause.ERROR -> "FAILED"
                    android.telecom.DisconnectCause.CANCELED -> "ENDED"
                    else -> "ENDED"
                }
            }
            Call.STATE_HOLDING -> "ON_HOLD"
            else -> return
        }

        // Enqueue the event for offline sync
        val callRequestId = call.details?.extras?.getString("callRequestId") ?: ""
        if (callRequestId.isNotEmpty()) {
            offlineQueue.enqueue(
                type = "call_event",
                payload = mapOf(
                    "callRequestId" to callRequestId,
                    "eventType" to eventType,
                    "eventId" to UUID.randomUUID().toString(),
                    "eventData" to mapOf(
                        "callState" to state,
                        "timestamp" to System.currentTimeMillis()
                    )
                )
            )
        }
    }
}''')

# ============================================================
# 9. OfflineQueue.kt
# ============================================================
write(f"{PKG}/sync/OfflineQueue.kt", '''package com.hubsphere.android.sync

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.io.File
import java.security.MessageDigest
import java.util.UUID

data class QueueItem(
    val id: String = UUID.randomUUID().toString(),
    val type: String,
    val payload: Map<String, Any>,
    val state: String = "PENDING", // PENDING, UPLOADING, SYNCED, FAILED, RETRYING
    val retryCount: Int = 0,
    val maxRetries: Int = 10,
    val createdAt: Long = System.currentTimeMillis(),
    val lastAttemptAt: Long? = null,
    val integrityHash: String
) {
    fun nextBackoffMs(): Long {
        val baseDelay = 1000L
        val maxDelay = 300000L // 5 minutes
        val delay = baseDelay * (1L shl min(retryCount, 10))
        return minOf(delay, maxDelay)
    }
}

class OfflineQueue(private val context: Context) {
    private val gson = Gson()
    private val queueDir = File(context.filesDir, "offline_queue")
    private val queueFile = File(queueDir, "queue.json")

    init {
        queueDir.mkdirs()
        if (!queueFile.exists()) queueFile.writeText("[]")
    }

    private fun computeHash(payload: Map<String, Any>): String {
        val json = gson.toJson(payload)
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(json.toByteArray()).joinToString("") { "%02x".format(it) }
    }

    @Synchronized
    private fun readQueue(): MutableList<QueueItem> {
        return try {
            val json = queueFile.readText()
            val type = object : TypeToken<List<QueueItem>>() {}.type
            gson.fromJson(json, type) ?: mutableListOf()
        } catch (e: Exception) { mutableListOf() }
    }

    @Synchronized
    private fun writeQueue(items: List<QueueItem>) {
        queueFile.writeText(gson.toJson(items))
    }

    fun enqueue(type: String, payload: Map<String, Any>): QueueItem {
        val item = QueueItem(
            type = type,
            payload = payload,
            integrityHash = computeHash(payload)
        )
        val queue = readQueue()
        queue.add(item)
        writeQueue(queue)
        return item
    }

    fun dequeue(): QueueItem? {
        val queue = readQueue()
        val item = queue.firstOrNull { it.state == "PENDING" || it.state == "RETRYING" }
        if (item != null) {
            val updated = item.copy(state = "UPLOADING", lastAttemptAt = System.currentTimeMillis())
            val index = queue.indexOf(item)
            queue[index] = updated
            writeQueue(queue)
            return updated
        }
        return null
    }

    fun markSynced(id: String) {
        val queue = readQueue()
        val index = queue.indexOfFirst { it.id == id }
        if (index >= 0) {
            queue[index] = queue[index].copy(state = "SYNCED")
            writeQueue(queue)
        }
    }

    fun markFailed(id: String) {
        val queue = readQueue()
        val index = queue.indexOfFirst { it.id == id }
        if (index >= 0) {
            val item = queue[index]
            if (item.retryCount >= item.maxRetries) {
                queue[index] = item.copy(state = "FAILED")
            } else {
                queue[index] = item.copy(state = "RETRYING", retryCount = item.retryCount + 1)
            }
            writeQueue(queue)
        }
    }

    fun getPendingCount(): Int = readQueue().count { it.state == "PENDING" || it.state == "RETRYING" }
    fun getFailedCount(): Int = readQueue().count { it.state == "FAILED" }

    // Verify integrity of all items on startup (crash recovery)
    fun verifyIntegrity(): Boolean {
        val queue = readQueue()
        return queue.all { computeHash(it.payload) == it.integrityHash }
    }
}''')

# ============================================================
# 10. CallEventSync.kt
# ============================================================
write(f"{PKG}/sync/CallEventSync.kt", '''package com.hubsphere.android.sync

import android.content.Context
import com.hubsphere.android.api.ApiService
import com.hubsphere.android.auth.AuthManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class CallEventSync(private val context: Context) {
    private val queue by lazy { OfflineQueue(context) }

    suspend fun syncAll(): Int {
        var synced = 0
        while (true) {
            val item = queue.dequeue() ?: break
            val success = withContext(Dispatchers.IO) {
                try {
                    val apiService = ApiService.getInstance(context)
                    when (item.type) {
                        "call_event" -> {
                            val callRequestId = item.payload["callRequestId"] as? String ?: return@withContext false
                            val eventType = item.payload["eventType"] as? String ?: return@withContext false
                            val eventId = item.payload["eventId"] as? String ?: return@withContext false
                            val eventData = (item.payload["eventData"] as? Map<String, Any>) ?: emptyMap()
                            val result = apiService.createCallEvent(callRequestId, eventType, eventData, eventId)
                            result != null
                        }
                        else -> false
                    }
                } catch (e: Exception) { false }
            }
            if (success) {
                queue.markSynced(item.id)
                synced++
            } else {
                queue.markFailed(item.id)
                break // Stop on failure, will retry later
            }
        }
        return synced
    }

    fun hasPendingItems(): Boolean = queue.getPendingCount() > 0
}''')

# ============================================================
# 11. SyncWorker.kt
# ============================================================
write(f"{PKG}/sync/SyncWorker.kt", '''package com.hubsphere.android.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.hubsphere.android.auth.AuthManager
import com.hubsphere.android.device.DeviceManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        if (!AuthManager.isLoggedIn()) return Result.success()

        // Send heartbeat if device is registered
        val deviceId = AuthManager.getDeviceId()
        if (deviceId != null) {
            withContext(Dispatchers.IO) {
                DeviceManager(applicationContext).sendHeartbeat()
            }
        }

        // Sync pending call events
        val sync = CallEventSync(applicationContext)
        val synced = withContext(Dispatchers.IO) { sync.syncAll() }

        return if (synced >= 0) Result.success() else Result.retry()
    }
}''')

# ============================================================
# 12. SyncService.kt
# ============================================================
write(f"{PKG}/sync/SyncService.kt", '''package com.hubsphere.android.sync

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.hubsphere.android.R
import com.hubsphere.android.auth.AuthManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class SyncService : Service() {
    private val CHANNEL_ID = "hubsphere_sync"

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        createNotificationChannel()
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("HubSphere")
            .setContentText("Syncing data...")
            .setSmallIcon(android.R.drawable.ic_popup_sync)
            .build()
        startForeground(1, notification)

        CoroutineScope(Dispatchers.Main).launch {
            val sync = CallEventSync(applicationContext)
            withContext(Dispatchers.IO) { sync.syncAll() }
            stopSelf()
        }

        return START_NOT_STICKY
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(CHANNEL_ID, "HubSphere Sync", NotificationManager.IMPORTANCE_LOW)
        channel.description = "Background data sync"
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(channel)
    }
}''')

# ============================================================
# 13. DeviceManager.kt
# ============================================================
write(f"{PKG}/device/DeviceManager.kt", '''package com.hubsphere.android.device

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
}''')

# ============================================================
# 14. CallRecordingManager.kt
# ============================================================
write(f"{PKG}/device/CallRecordingManager.kt", '''package com.hubsphere.android.device

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
}''')

# ============================================================
# 15. AppUpdateManager.kt
# ============================================================
write(f"{PKG}/update/AppUpdateManager.kt", '''package com.hubsphere.android.update

import android.content.Context
import com.hubsphere.android.api.ApiService
import com.hubsphere.android.api.AppUpdateInfo
import com.hubsphere.android.auth.AuthManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class AppUpdateManager(private val context: Context) {
    private val apiService by lazy { ApiService.getInstance(context) }

    // NOTE: In-app update is SEPARATE from data sync
    // Data sync = CRM data, call events, device status (handled by OfflineQueue + SyncWorker)
    // App update = APK version checking, mandatory security updates (handled here)

    suspend fun checkForUpdate(): AppUpdateInfo? {
        val currentVersion = getCurrentVersion()
        return withContext(Dispatchers.IO) {
            apiService.checkForUpdate(currentVersion)
        }
    }

    fun getCurrentVersion(): String {
        return try {
            val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            packageInfo.versionName ?: "0.0.0"
        } catch (e: Exception) { "0.0.0" }
    }

    fun isMandatoryUpdate(info: AppUpdateInfo?): Boolean {
        return info?.isMandatory == true && info.updateAvailable
    }

    fun isSecurityUpdate(info: AppUpdateInfo?): Boolean {
        return info?.latestRelease?.securityUpdate == true && info.updateAvailable
    }

    fun shouldBlockApp(info: AppUpdateInfo?): Boolean {
        // Block the app if update is mandatory (security) or if version is incompatible
        return (info?.isMandatory == true && info.updateAvailable) ||
               (info?.isCompatible == false)
    }

    fun getUpdateMessage(info: AppUpdateInfo?): String {
        if (info == null || !info.updateAvailable) return "App is up to date"
        val security = if (info.latestRelease?.securityUpdate == true) " (Security Update)" else ""
        val mandatory = if (info.isMandatory) " [MANDATORY]" else " [Optional]"
        return "Update available: v${info.latestVersion}${security}${mandatory}"
    }
}''')

# ============================================================
# 16. BootCompletedReceiver.kt
# ============================================================
write(f"{PKG}/receiver/BootCompletedReceiver.kt", '''package com.hubsphere.android.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.hubsphere.android.auth.AuthManager
import com.hubsphere.android.sync.SyncWorker
import java.util.concurrent.TimeUnit

class BootCompletedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        if (!AuthManager.isLoggedIn()) return

        // Re-schedule periodic sync after reboot
        val syncRequest = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(androidx.work.Constraints.Builder()
                .setRequiredNetworkType(androidx.work.NetworkType.CONNECTED)
                .build())
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "hubsphere_sync",
            androidx.work.ExistingPeriodicWorkPolicy.KEEP,
            syncRequest
        )
    }
}''')

# ============================================================
# 17. NetworkConnectivityReceiver.kt
# ============================================================
write(f"{PKG}/receiver/NetworkConnectivityReceiver.kt", '''package com.hubsphere.android.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.hubsphere.android.auth.AuthManager
import com.hubsphere.android.sync.SyncService

class NetworkConnectivityReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != "android.net.conn.CONNECTIVITY_CHANGE") return
        if (!AuthManager.isLoggedIn()) return

        // Start sync service when network becomes available
        val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as android.net.ConnectivityManager
        val networkInfo = connectivityManager.activeNetworkInfo
        if (networkInfo?.isConnected == true) {
            context.startService(Intent(context, SyncService::class.java))
        }
    }
}''')

# ============================================================
# 18-25. UI Fragments
# ============================================================
write(f"{PKG}/ui/MainActivity.kt", '''package com.hubsphere.android.ui

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.navigation.fragment.findNavController
import androidx.navigation.ui.setupWithNavController
import com.google.android.material.bottomnavigation.BottomNavigationView
import com.hubsphere.android.R
import com.hubsphere.android.auth.AuthManager

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!AuthManager.isLoggedIn()) {
            finish()
            return
        }
        setContentView(R.layout.activity_main)

        val bottomNav = findViewById<BottomNavigationView>(R.id.bottomNav)
        val navHostFragment = supportFragmentManager.findFragmentById(R.id.navHostFragment)
        if (navHostFragment != null) {
            val navController = navHostFragment.findNavController()
            bottomNav.setupWithNavController(navController)
        }
    }
}''')

write(f"{PKG}/ui/dashboard/DashboardFragment.kt", '''package com.hubsphere.android.ui.dashboard

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.hubsphere.android.R
import com.hubsphere.android.api.ApiService
import com.hubsphere.android.api.CallRecord
import com.hubsphere.android.auth.AuthManager
import com.hubsphere.android.device.DeviceManager
import com.hubsphere.android.telecom.SimChecker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class DashboardFragment : Fragment() {
    private lateinit var tvGreeting: TextView
    private lateinit var tvDeviceStatus: TextView
    private lateinit var rvRecentCalls: RecyclerView

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        return inflater.inflate(R.layout.fragment_dashboard, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        tvGreeting = view.findViewById(R.id.tvGreeting)
        tvDeviceStatus = view.findViewById(R.id.tvDeviceStatus)
        rvRecentCalls = view.findViewById(R.id.rvRecentCalls)
        rvRecentCalls.layoutManager = LinearLayoutManager(context)

        val userName = AuthManager.getUserName() ?: "User"
        tvGreeting.text = "Hello, $userName"

        // Show device/SIM status
        val simChecker = context?.let { SimChecker(it) }
        val simStatus = if (simChecker?.hasSim() == true) "SIM: ${simChecker.getOperatorName()}" else "No SIM"
        val deviceStatus = DeviceManager(requireContext()).getDeviceStatus()
        tvDeviceStatus.text = "Device: $deviceStatus | $simStatus"

        loadRecentCalls()
    }

    private fun loadRecentCalls() {
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val calls = withContext(Dispatchers.IO) {
                    ApiService.getInstance(requireContext()).getCalls(limit = 5)
                }
                // Display calls in RecyclerView (simplified adapter)
                calls?.let {
                    rvRecentCalls.adapter = SimpleCallAdapter(it)
                }
            } catch (e: Exception) { }
        }
    }

    inner class SimpleCallAdapter(private val calls: List<CallRecord>) :
        RecyclerView.Adapter<SimpleCallAdapter.ViewHolder>() {
        inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
            val tvContact: TextView = view.findViewById(R.id.tvContact)
            val tvDirection: TextView = view.findViewById(R.id.tvDirection)
            val tvDuration: TextView = view.findViewById(R.id.tvDuration)
            val tvTime: TextView = view.findViewById(R.id.tvTime)
        }
        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
            ViewHolder(LayoutInflater.from(parent.context).inflate(R.layout.item_call, parent, false))
        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val call = calls[position]
            holder.tvContact.text = call.callType ?: "Unknown"
            holder.tvDirection.text = call.direction ?: "-"
            holder.tvDuration.text = "${call.duration ?: 0}s"
            holder.tvTime.text = call.createdAt?.take(10) ?: "-"
        }
        override fun getItemCount() = calls.size
    }
}''')

write(f"{PKG}/ui/contacts/ContactsFragment.kt", '''package com.hubsphere.android.ui.contacts

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.android.material.textfield.TextInputEditText
import com.hubsphere.android.R
import com.hubsphere.android.api.ApiService
import com.hubsphere.android.api.Contact
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class ContactsFragment : Fragment() {
    private lateinit var rvContacts: RecyclerView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var etSearch: TextInputEditText

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        return inflater.inflate(R.layout.fragment_contacts, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        rvContacts = view.findViewById(R.id.rvContacts)
        swipeRefresh = view.findViewById(R.id.swipeRefresh)
        etSearch = view.findViewById(R.id.etSearch)
        rvContacts.layoutManager = LinearLayoutManager(context)

        swipeRefresh.setOnRefreshListener { loadContacts() }
        loadContacts()

        etSearch.addTextChangedListener(object : android.text.TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) { loadContacts(s?.toString()) }
            override fun afterTextChanged(s: android.text.Editable?) {}
        })
    }

    private fun loadContacts(search: String? = null) {
        swipeRefresh.isRefreshing = true
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val contacts = withContext(Dispatchers.IO) {
                    context?.let { ApiService.getInstance(it).getContacts(search = search) }
                }
                contacts?.let { rvContacts.adapter = ContactAdapter(it) { c -> onContactClick(c) } }
            } catch (e: Exception) {
                Toast.makeText(context, "Failed to load contacts", Toast.LENGTH_SHORT).show()
            } finally { swipeRefresh.isRefreshing = false }
        }
    }

    private fun onContactClick(contact: Contact) {
        // Navigate to contact detail
        val bundle = Bundle().apply { putString("contactId", contact.id) }
        parentFragmentManager.beginTransaction()
            .replace(R.id.navHostFragment, ContactDetailFragment().apply { arguments = bundle })
            .addToBackStack(null)
            .commit()
    }

    inner class ContactAdapter(private val contacts: List<Contact>, private val onClick: (Contact) -> Unit) :
        RecyclerView.Adapter<ContactAdapter.ViewHolder>() {
        inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
            val tvName: TextView = view.findViewById(R.id.tvName)
            val tvCompany: TextView = view.findViewById(R.id.tvCompany)
            val tvPhone: TextView = view.findViewById(R.id.tvPhone)
        }
        private lateinit var tvName: android.widget.TextView
        private lateinit var tvCompany: android.widget.TextView
        private lateinit var tvPhone: android.widget.TextView
        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
            ViewHolder(LayoutInflater.from(parent.context).inflate(R.layout.item_contact, parent, false))
        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val contact = contacts[position]
            holder.tvName.text = contact.displayName
            holder.tvCompany.text = contact.company ?: ""
            holder.tvPhone.text = contact.phone ?: ""
            holder.itemView.setOnClickListener { onClick(contact) }
        }
        override fun getItemCount() = contacts.size
    }
}''')

write(f"{PKG}/ui/contacts/ContactDetailFragment.kt", '''package com.hubsphere.android.ui.contacts

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import com.google.android.material.button.MaterialButton
import com.hubsphere.android.R
import com.hubsphere.android.api.ApiService
import com.hubsphere.android.api.Contact
import com.hubsphere.android.telecom.CallManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class ContactDetailFragment : Fragment() {
    private lateinit var tvName: TextView
    private lateinit var tvCompany: TextView
    private lateinit var tvPhone: TextView
    private lateinit var tvEmail: TextView
    private lateinit var btnCall: MaterialButton

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        return inflater.inflate(R.layout.fragment_contact_detail, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        tvName = view.findViewById(R.id.tvContactName)
        tvCompany = view.findViewById(R.id.tvCompany)
        tvPhone = view.findViewById(R.id.tvPhone)
        tvEmail = view.findViewById(R.id.tvEmail)
        btnCall = view.findViewById(R.id.btnCall)

        val contactId = arguments?.getString("contactId") ?: return
        loadContact(contactId)

        btnCall.setOnClickListener { makeCall() }
    }

    private var contact: Contact? = null

    private fun loadContact(id: String) {
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val contacts = withContext(Dispatchers.IO) {
                    context?.let { ApiService.getInstance(it).getContacts(search = id) }
                }
                contact = contacts?.firstOrNull()
                contact?.let { c ->
                    tvName.text = c.displayName
                    tvCompany.text = c.company ?: ""
                    tvPhone.text = c.phone ?: "No phone"
                    tvEmail.text = c.email ?: ""
                }
            } catch (e: Exception) { }
        }
    }

    private fun makeCall() {
        val phone = contact?.phone ?: return
        val callManager = context?.let { CallManager(it) } ?: return
        if (callManager.placeCall(phone)) {
            Toast.makeText(context, "Calling $phone", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(context, "Call failed - check SIM", Toast.LENGTH_LONG).show()
        }
    }
}''')

write(f"{PKG}/ui/leads/LeadsFragment.kt", '''package com.hubsphere.android.ui.leads

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.android.material.textfield.TextInputEditText
import com.hubsphere.android.R
import com.hubsphere.android.api.ApiService
import com.hubsphere.android.api.Lead
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class LeadsFragment : Fragment() {
    private lateinit var rvLeads: RecyclerView
    private lateinit var swipeRefresh: SwipeRefreshLayout

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        return inflater.inflate(R.layout.fragment_leads, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        rvLeads = view.findViewById(R.id.rvLeads)
        swipeRefresh = view.findViewById(R.id.swipeRefresh)
        rvLeads.layoutManager = LinearLayoutManager(context)
        swipeRefresh.setOnRefreshListener { loadLeads() }
        loadLeads()
    }

    private fun loadLeads() {
        swipeRefresh.isRefreshing = true
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val leads = withContext(Dispatchers.IO) {
                    context?.let { ApiService.getInstance(it).getLeads() }
                }
                leads?.let { rvLeads.adapter = LeadAdapter(it) }
            } catch (e: Exception) { }
            finally { swipeRefresh.isRefreshing = false }
        }
    }

    inner class LeadAdapter(private val leads: List<Lead>) :
        RecyclerView.Adapter<LeadAdapter.ViewHolder>() {
        inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
            val tvName: android.widget.TextView = view.findViewById(R.id.tvName)
            val tvCompany: android.widget.TextView = view.findViewById(R.id.tvCompany)
            val tvStatus: android.widget.TextView = view.findViewById(R.id.tvStatus)
        }
        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
            ViewHolder(LayoutInflater.from(parent.context).inflate(R.layout.item_lead, parent, false))
        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val lead = leads[position]
            holder.tvName.text = lead.displayName
            holder.tvCompany.text = lead.company ?: ""
            holder.tvStatus.text = lead.status
        }
        override fun getItemCount() = leads.size
    }
}''')

write(f"{PKG}/ui/leads/LeadDetailFragment.kt", '''package com.hubsphere.android.ui.leads

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import com.google.android.material.button.MaterialButton
import com.hubsphere.android.R
import com.hubsphere.android.api.Lead
import com.hubsphere.android.telecom.CallManager

class LeadDetailFragment : Fragment() {
    private var lead: Lead? = null

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        return inflater.inflate(R.layout.fragment_lead_detail, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val btnCall: MaterialButton = view.findViewById(R.id.btnCall)
        btnCall.setOnClickListener { makeCall() }
    }

    private fun makeCall() {
        val phone = lead?.phone ?: return
        val callManager = context?.let { CallManager(it) } ?: return
        if (callManager.placeCall(phone)) {
            Toast.makeText(context, "Calling $phone", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(context, "Call failed", Toast.LENGTH_LONG).show()
        }
    }
}''')

write(f"{PKG}/ui/calls/CallsFragment.kt", '''package com.hubsphere.android.ui.calls

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.hubsphere.android.R
import com.hubsphere.android.api.ApiService
import com.hubsphere.android.api.CallRecord
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class CallsFragment : Fragment() {
    private lateinit var rvCalls: RecyclerView
    private lateinit var swipeRefresh: SwipeRefreshLayout

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        return inflater.inflate(R.layout.fragment_calls, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        rvCalls = view.findViewById(R.id.rvCalls)
        swipeRefresh = view.findViewById(R.id.swipeRefresh)
        rvCalls.layoutManager = LinearLayoutManager(context)
        swipeRefresh.setOnRefreshListener { loadCalls() }
        loadCalls()
    }

    private fun loadCalls() {
        swipeRefresh.isRefreshing = true
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val calls = withContext(Dispatchers.IO) {
                    context?.let { ApiService.getInstance(it).getCalls() }
                }
                calls?.let { rvCalls.adapter = CallAdapter(it) }
            } catch (e: Exception) { }
            finally { swipeRefresh.isRefreshing = false }
        }
    }

    inner class CallAdapter(private val calls: List<CallRecord>) :
        RecyclerView.Adapter<CallAdapter.ViewHolder>() {
        inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
            val tvContact: android.widget.TextView = view.findViewById(R.id.tvContact)
            val tvDirection: android.widget.TextView = view.findViewById(R.id.tvDirection)
            val tvDuration: android.widget.TextView = view.findViewById(R.id.tvDuration)
            val tvTime: android.widget.TextView = view.findViewById(R.id.tvTime)
        }
        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
            ViewHolder(LayoutInflater.from(parent.context).inflate(R.layout.item_call, parent, false))
        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val call = calls[position]
            holder.tvContact.text = call.callType ?: "Call"
            holder.tvDirection.text = call.direction ?: "-"
            holder.tvDuration.text = "${call.duration ?: 0}s"
            holder.tvTime.text = call.createdAt?.take(10) ?: "-"
        }
        override fun getItemCount() = calls.size
    }
}''')

write(f"{PKG}/ui/devices/DevicesFragment.kt", '''package com.hubsphere.android.ui.devices

import android.app.AlertDialog
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText
import com.hubsphere.android.R
import com.hubsphere.android.auth.AuthManager
import com.hubsphere.android.device.DeviceManager
import com.hubsphere.android.telecom.SimChecker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class DevicesFragment : Fragment() {
    private lateinit var tvDeviceStatus: TextView
    private lateinit var tvSimInfo: TextView
    private lateinit var tvLastHeartbeat: TextView
    private lateinit var btnPairDevice: MaterialButton

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        return inflater.inflate(R.layout.fragment_devices, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        tvDeviceStatus = view.findViewById(R.id.tvDeviceStatus)
        tvSimInfo = view.findViewById(R.id.tvSimInfo)
        tvLastHeartbeat = view.findViewById(R.id.tvLastHeartbeat)
        btnPairDevice = view.findViewById(R.id.btnPairDevice)

        updateDeviceStatus()

        btnPairDevice.setOnClickListener { showPairDialog() }
    }

    private fun updateDeviceStatus() {
        val deviceManager = context?.let { DeviceManager(it) }
        val status = deviceManager?.getDeviceStatus() ?: "UNREGISTERED"
        tvDeviceStatus.text = "Device Status: $status"

        val simChecker = context?.let { SimChecker(it) }
        if (simChecker?.hasSim() == true) {
            tvSimInfo.text = "SIM: ${simChecker.getOperatorName()} | ${simChecker.getCountryCode()} | ${simChecker.getPhoneNumber() ?: "N/A"}"
        } else {
            tvSimInfo.text = "No SIM card detected"
        }

        val deviceId = AuthManager.getDeviceId()
        tvLastHeartbeat.text = if (deviceId != null) "Device ID: ${deviceId.take(8)}..." else "Not registered"
    }

    private fun showPairDialog() {
        val dialogView = LayoutInflater.from(context).inflate(R.layout.dialog_pair_device, null)
        val etToken = dialogView.findViewById<TextInputEditText>(R.id.etPairingToken)
        val btnPair = dialogView.findViewById<MaterialButton>(R.id.btnPair)

        val dialog = AlertDialog.Builder(context)
            .setView(dialogView)
            .create()

        btnPair.setOnClickListener {
            val token = etToken.text?.toString()?.trim() ?: ""
            if (token.isEmpty()) { etToken.error = "Token required"; return@setOnClickListener }

            CoroutineScope(Dispatchers.Main).launch {
                try {
                    val deviceManager = DeviceManager(requireContext())
                    // First register if not registered
                    if (AuthManager.getDeviceId() == null) {
                        withContext(Dispatchers.IO) { deviceManager.registerDevice() }
                    }
                    val result = withContext(Dispatchers.IO) { deviceManager.pairDevice(token) }
                    if (result != null) {
                        Toast.makeText(context, "Device paired! Status: ${result.status}", Toast.LENGTH_LONG).show()
                        updateDeviceStatus()
                        dialog.dismiss()
                    } else {
                        Toast.makeText(context, "Pairing failed", Toast.LENGTH_LONG).show()
                    }
                } catch (e: Exception) {
                    Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
        dialog.show()
    }
}''')

write(f"{PKG}/ui/profile/ProfileFragment.kt", '''package com.hubsphere.android.ui.profile

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import com.google.android.material.button.MaterialButton
import com.hubsphere.android.R
import com.hubsphere.android.auth.AuthActivity
import com.hubsphere.android.auth.AuthManager
import com.hubsphere.android.device.DeviceManager
import com.hubsphere.android.telecom.SimChecker
import com.hubsphere.android.update.AppUpdateManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class ProfileFragment : Fragment() {
    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        return inflater.inflate(R.layout.fragment_profile, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val tvUserName: TextView = view.findViewById(R.id.tvUserName)
        val tvUserEmail: TextView = view.findViewById(R.id.tvUserEmail)
        val tvTenant: TextView = view.findViewById(R.id.tvTenant)
        val tvDeviceInfo: TextView = view.findViewById(R.id.tvDeviceInfo)
        val tvAppVersion: TextView = view.findViewById(R.id.tvAppVersion)
        val btnCheckUpdate: MaterialButton = view.findViewById(R.id.btnCheckUpdate)
        val btnDevices: MaterialButton = view.findViewById(R.id.btnDevices)
        val btnLogout: MaterialButton = view.findViewById(R.id.btnLogout)

        tvUserName.text = AuthManager.getUserName() ?: "User"
        tvUserEmail.text = AuthManager.getUserEmail() ?: ""

        val tenantName = AuthManager.getTenantName()
        tvTenant.text = if (tenantName != null) "Organization: $tenantName" else ""

        val simChecker = context?.let { SimChecker(it) }
        val simInfo = if (simChecker?.hasSim() == true) "SIM: ${simChecker.getOperatorName()}" else "No SIM"
        val deviceStatus = context?.let { DeviceManager(it).getDeviceStatus() } ?: "N/A"
        tvDeviceInfo.text = "Device: $deviceStatus | $simInfo"

        val versionName = try { context?.packageManager?.getPackageInfo(requireContext().packageName, 0)?.versionName ?: "?" } catch (e: Exception) { "?" }
        tvAppVersion.text = getString(R.string.version_format, versionName)

        // CHECK FOR UPDATE — separate from data sync
        btnCheckUpdate.setOnClickListener {
            CoroutineScope(Dispatchers.Main).launch {
                try {
                    val updateManager = AppUpdateManager(requireContext())
                    val info = withContext(Dispatchers.IO) { updateManager.checkForUpdate() }
                    val msg = updateManager.getUpdateMessage(info)
                    Toast.makeText(context, msg, Toast.LENGTH_LONG).show()
                    if (updateManager.shouldBlockApp(info)) {
                        AlertDialog.Builder(requireContext())
                            .setTitle(R.string.mandatory_update)
                            .setMessage("A mandatory update is required. Please update the app to continue.")
                            .setPositiveButton("OK") { _, _ -> requireActivity().finish() }
                            .setCancelable(false)
                            .show()
                    }
                } catch (e: Exception) {
                    Toast.makeText(context, "Update check failed", Toast.LENGTH_SHORT).show()
                }
            }
        }

        btnDevices.setOnClickListener {
            parentFragmentManager.beginTransaction()
                .replace(R.id.navHostFragment, com.hubsphere.android.ui.devices.DevicesFragment())
                .addToBackStack(null)
                .commit()
        }

        btnLogout.setOnClickListener {
            AuthManager.logout()
            startActivity(Intent(requireContext(), AuthActivity::class.java))
            requireActivity().finish()
        }
    }
}''')

print("\n✅ ALL KOTLIN SOURCE FILES GENERATED")
