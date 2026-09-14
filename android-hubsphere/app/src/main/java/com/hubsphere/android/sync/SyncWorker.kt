package com.hubsphere.android.sync

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
}