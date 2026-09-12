package com.hubsphere.android.update

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
}