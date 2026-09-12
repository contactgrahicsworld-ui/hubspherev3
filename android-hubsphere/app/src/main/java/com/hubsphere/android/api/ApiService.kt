package com.hubsphere.android.api

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
}