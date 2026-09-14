package com.hubsphere.android.sync

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
}