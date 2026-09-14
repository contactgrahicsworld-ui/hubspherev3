package com.hubsphere.android.ui.devices

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.hubsphere.android.R
import com.hubsphere.android.api.Device
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.TimeUnit

class DeviceListAdapter(
    private val devices: List<Device>
) : RecyclerView.Adapter<DeviceListAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val ivDeviceIcon: ImageView = view.findViewById(R.id.ivDeviceIcon)
        val tvDeviceName: TextView = view.findViewById(R.id.tvDeviceName)
        val tvDeviceStatus: TextView = view.findViewById(R.id.tvDeviceStatus)
        val tvLastHeartbeat: TextView = view.findViewById(R.id.tvLastHeartbeat)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_device, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val device = devices[position]

        holder.tvDeviceName.text = device.deviceName ?: "Unknown Device"

        // Status
        val statusColor = when (device.status.uppercase()) {
            "ACTIVE" -> R.color.status_active
            "PENDING_APPROVAL" -> R.color.status_pending
            "REVOKED" -> R.color.status_revoked
            else -> R.color.status_pairing
        }
        holder.tvDeviceStatus.text = device.status
        holder.tvDeviceStatus.setTextColor(holder.itemView.context.getColor(statusColor))

        // Last heartbeat
        if (!device.lastHeartbeatAt.isNullOrEmpty()) {
            try {
                val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
                format.timeZone = TimeZone.getTimeZone("UTC")
                val heartbeatDate = format.parse(device.lastHeartbeatAt)
                if (heartbeatDate != null) {
                    val elapsedMs = Date().time - heartbeatDate.time
                    val elapsedMin = TimeUnit.MILLISECONDS.toMinutes(elapsedMs)
                    holder.tvLastHeartbeat.text = "Last heartbeat: ${elapsedMin} min ago"
                } else {
                    holder.tvLastHeartbeat.text = "Last heartbeat: unknown"
                }
            } catch (e: Exception) {
                holder.tvLastHeartbeat.text = "Last heartbeat: ${device.lastHeartbeatAt}"
            }
        } else {
            holder.tvLastHeartbeat.text = "No heartbeat"
        }

        // Device type icon
        holder.ivDeviceIcon.setImageResource(android.R.drawable.ic_menu_manage)
        holder.ivDeviceIcon.setColorFilter(holder.itemView.context.getColor(R.color.status_active))
    }

    override fun getItemCount(): Int = devices.size
}
