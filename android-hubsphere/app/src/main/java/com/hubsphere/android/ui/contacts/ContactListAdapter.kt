package com.hubsphere.android.ui.contacts

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageButton
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.hubsphere.android.R
import com.hubsphere.android.api.models.Contact

class ContactListAdapter(
    private val contacts: List<Contact>,
    private val listener: Listener
) : RecyclerView.Adapter<ContactListAdapter.ViewHolder>() {

    interface Listener {
        fun onContactClick(contact: Contact)
        fun onCallClick(contact: Contact)
    }

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvInitials: TextView = view.findViewById(R.id.tvInitials)
        val tvName: TextView = view.findViewById(R.id.tvName)
        val tvCompany: TextView = view.findViewById(R.id.tvCompany)
        val tvPhone: TextView = view.findViewById(R.id.tvPhone)
        val btnCall: ImageButton = view.findViewById(R.id.btnCall)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_contact, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val contact = contacts[position]

        // Initials
        val initials = contact.name.split(" ")
            .take(2)
            .mapNotNull { it.firstOrNull()?.uppercaseChar()?.toString() }
            .joinToString("")
        holder.tvInitials.text = initials

        holder.tvName.text = contact.name
        holder.tvCompany.text = contact.company ?: ""
        holder.tvPhone.text = contact.phone ?: ""

        holder.itemView.setOnClickListener {
            listener.onContactClick(contact)
        }

        holder.btnCall.setOnClickListener {
            listener.onCallClick(contact)
        }
    }

    override fun getItemCount(): Int = contacts.size
}
