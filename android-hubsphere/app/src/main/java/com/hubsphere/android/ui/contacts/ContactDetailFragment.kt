package com.hubsphere.android.ui.contacts

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import com.google.android.material.button.MaterialButton
import com.hubsphere.android.R
import com.hubsphere.android.api.ApiService
import com.hubsphere.android.api.Contact
import com.hubsphere.android.telecom.CallManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class ContactDetailFragment : Fragment() {
    private lateinit var tvName: TextView
    private lateinit var tvCompany: TextView
    private lateinit var tvPhone: TextView
    private lateinit var tvEmail: TextView
    private lateinit var btnCall: MaterialButton

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        return inflater.inflate(R.layout.fragment_contact_detail, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        tvName = view.findViewById(R.id.tvContactName)
        tvCompany = view.findViewById(R.id.tvCompany)
        tvPhone = view.findViewById(R.id.tvPhone)
        tvEmail = view.findViewById(R.id.tvEmail)
        btnCall = view.findViewById(R.id.btnCall)

        val contactId = arguments?.getString("contactId") ?: return
        loadContact(contactId)

        btnCall.setOnClickListener { makeCall() }
    }

    private var contact: Contact? = null

    private fun loadContact(id: String) {
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val contacts = withContext(Dispatchers.IO) {
                    context?.let { ApiService.getInstance(it).getContacts(search = id) }
                }
                contact = contacts?.firstOrNull()
                contact?.let { c ->
                    tvName.text = c.displayName
                    tvCompany.text = c.company ?: ""
                    tvPhone.text = c.phone ?: "No phone"
                    tvEmail.text = c.email ?: ""
                }
            } catch (e: Exception) { }
        }
    }

    private fun makeCall() {
        val phone = contact?.phone ?: return
        val callManager = context?.let { CallManager(it) } ?: return
        if (callManager.placeCall(phone)) {
            Toast.makeText(context, "Calling $phone", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(context, "Call failed - check SIM", Toast.LENGTH_LONG).show()
        }
    }
}