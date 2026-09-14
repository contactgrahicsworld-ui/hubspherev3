package com.hubsphere.android.receiver

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
}