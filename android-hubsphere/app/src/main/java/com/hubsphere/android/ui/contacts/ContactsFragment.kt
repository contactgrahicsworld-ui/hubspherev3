package com.hubsphere.android.ui.contacts

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.android.material.textfield.TextInputEditText
import com.hubsphere.android.R
import com.hubsphere.android.api.ApiService
import com.hubsphere.android.api.Contact
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class ContactsFragment : Fragment() {
    private lateinit var rvContacts: RecyclerView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var etSearch: TextInputEditText

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        return inflater.inflate(R.layout.fragment_contacts, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        rvContacts = view.findViewById(R.id.rvContacts)
        swipeRefresh = view.findViewById(R.id.swipeRefresh)
        etSearch = view.findViewById(R.id.etSearch)
        rvContacts.layoutManager = LinearLayoutManager(context)

        swipeRefresh.setOnRefreshListener { loadContacts() }
        loadContacts()

        etSearch.addTextChangedListener(object : android.text.TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) { loadContacts(s?.toString()) }
            override fun afterTextChanged(s: android.text.Editable?) {}
        })
    }

    private fun loadContacts(search: String? = null) {
        swipeRefresh.isRefreshing = true
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val contacts = withContext(Dispatchers.IO) {
                    context?.let { ApiService.getInstance(it).getContacts(search = search) }
                }
                contacts?.let { rvContacts.adapter = ContactAdapter(it) { c -> onContactClick(c) } }
            } catch (e: Exception) {
                Toast.makeText(context, "Failed to load contacts", Toast.LENGTH_SHORT).show()
            } finally { swipeRefresh.isRefreshing = false }
        }
    }

    private fun onContactClick(contact: Contact) {
        // Navigate to contact detail
        val bundle = Bundle().apply { putString("contactId", contact.id) }
        parentFragmentManager.beginTransaction()
            .replace(R.id.navHostFragment, ContactDetailFragment().apply { arguments = bundle })
            .addToBackStack(null)
            .commit()
    }

    inner class ContactAdapter(private val contacts: List<Contact>, private val onClick: (Contact) -> Unit) :
        RecyclerView.Adapter<ContactAdapter.ViewHolder>() {
        inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
            val tvName: TextView = view.findViewById(R.id.tvName)
            val tvCompany: TextView = view.findViewById(R.id.tvCompany)
            val tvPhone: TextView = view.findViewById(R.id.tvPhone)
        }
        private lateinit var tvName: android.widget.TextView
        private lateinit var tvCompany: android.widget.TextView
        private lateinit var tvPhone: android.widget.TextView
        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
            ViewHolder(LayoutInflater.from(parent.context).inflate(R.layout.item_contact, parent, false))
        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val contact = contacts[position]
            holder.tvName.text = contact.displayName
            holder.tvCompany.text = contact.company ?: ""
            holder.tvPhone.text = contact.phone ?: ""
            holder.itemView.setOnClickListener { onClick(contact) }
        }
        override fun getItemCount() = contacts.size
    }
}