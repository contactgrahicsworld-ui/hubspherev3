package com.hubsphere.android.ui.calls

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.hubsphere.android.R
import com.hubsphere.android.api.models.Call
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class CallListAdapter(
    private val calls: List<Call>,
    private val onClick: (Call) -> Unit
) : RecyclerView.Adapter<CallListAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val ivCallType: ImageView = view.findViewById(R.id.ivCallType)
        val tvContactName: TextView = view.findViewById(R.id.tvContactName)
        val tvCallInfo: TextView = view.findViewById(R.id.tvCallInfo)
        val tvTime: TextView = view.findViewById(R.id.tvTime)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_call, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val call = calls[position]

        // Call type icon and color
        when (call.direction.lowercase()) {
            "inbound" -> {
                holder.ivCallType.setImageResource(android.R.drawable.ic_menu_call)
                holder.ivCallType.setColorFilter(holder.itemView.context.getColor(R.color.call_incoming))
            }
            "outbound" -> {
                holder.ivCallType.setImageResource(android.R.drawable.ic_menu_call)
                holder.ivCallType.setColorFilter(holder.itemView.context.getColor(R.color.call_outgoing))
            }
            else -> {
                holder.ivCallType.setImageResource(android.R.drawable.ic_menu_call)
                holder.ivCallType.setColorFilter(holder.itemView.context.getColor(R.color.call_missed))
            }
        }

        // Contact name
        holder.tvContactName.text = call.contactName ?: call.phoneNumber

        // Call info
        val directionLabel = when (call.direction.lowercase()) {
            "inbound" -> "Incoming"
            "outbound" -> "Outgoing"
            else -> call.direction
        }
        val durationLabel = formatDuration(call.duration)
        holder.tvCallInfo.text = "$directionLabel • $durationLabel"

        // Time
        holder.tvTime.text = formatTime(call.startTime)

        holder.itemView.setOnClickListener {
            onClick(call)
        }
    }

    override fun getItemCount(): Int = calls.size

    private fun formatDuration(seconds: Int): String {
        if (seconds <= 0) return "0s"
        val minutes = seconds / 60
        val remainingSeconds = seconds % 60
        return if (minutes > 0) {
            "${minutes}m ${remainingSeconds}s"
        } else {
            "${remainingSeconds}s"
        }
    }

    private fun formatTime(timeString: String?): String {
        if (timeString.isNullOrEmpty()) return ""
        return try {
            val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
            inputFormat.timeZone = TimeZone.getTimeZone("UTC")
            val date = inputFormat.parse(timeString)
            val outputFormat = SimpleDateFormat("h:mm a", Locale.US)
            if (date != null) outputFormat.format(date) else ""
        } catch (e: Exception) {
            timeString
        }
    }
}
