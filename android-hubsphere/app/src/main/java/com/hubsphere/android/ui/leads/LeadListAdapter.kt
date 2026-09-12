package com.hubsphere.android.ui.leads

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageButton
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.hubsphere.android.R
import com.hubsphere.android.api.models.Lead

class LeadListAdapter(
    private val leads: List<Lead>,
    private val listener: Listener
) : RecyclerView.Adapter<LeadListAdapter.ViewHolder>() {

    interface Listener {
        fun onLeadClick(lead: Lead)
        fun onCallClick(lead: Lead)
    }

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvInitials: TextView = view.findViewById(R.id.tvInitials)
        val tvName: TextView = view.findViewById(R.id.tvName)
        val tvCompany: TextView = view.findViewById(R.id.tvCompany)
        val tvStatus: TextView = view.findViewById(R.id.tvStatus)
        val btnCall: ImageButton = view.findViewById(R.id.btnCall)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_lead, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val lead = leads[position]

        val initials = lead.name.split(" ")
            .take(2)
            .mapNotNull { it.firstOrNull()?.uppercaseChar()?.toString() }
            .joinToString("")
        holder.tvInitials.text = initials

        holder.tvName.text = lead.name
        holder.tvCompany.text = lead.company ?: ""

        // Status badge
        holder.tvStatus.text = lead.status
        val statusColor = when (lead.status.uppercase()) {
            "NEW" -> R.color.lead_new
            "CONTACTED" -> R.color.lead_contacted
            "QUALIFIED" -> R.color.lead_qualified
            "LOST" -> R.color.lead_lost
            else -> R.color.lead_new
        }
        holder.tvStatus.setBackgroundResource(statusColor)

        holder.itemView.setOnClickListener {
            listener.onLeadClick(lead)
        }

        holder.btnCall.setOnClickListener {
            listener.onCallClick(lead)
        }
    }

    override fun getItemCount(): Int = leads.size
}
