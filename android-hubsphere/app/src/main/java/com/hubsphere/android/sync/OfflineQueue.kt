package com.hubsphere.android.sync

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
}