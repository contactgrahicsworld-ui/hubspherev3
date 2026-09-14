package com.hubsphere.android.telecom

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
}