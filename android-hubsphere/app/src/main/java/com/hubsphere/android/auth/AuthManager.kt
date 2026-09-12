package com.hubsphere.android.auth

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
}