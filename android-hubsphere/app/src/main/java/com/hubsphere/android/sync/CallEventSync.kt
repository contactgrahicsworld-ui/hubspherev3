package com.hubsphere.android.sync

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
}