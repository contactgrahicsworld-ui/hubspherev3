package com.hubsphere.android.receiver

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
}