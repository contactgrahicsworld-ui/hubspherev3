package com.hubsphere.android.ui.leads

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.google.android.material.button.MaterialButton
import com.hubsphere.android.R
import com.hubsphere.android.api.ApiService
import com.hubsphere.android.api.Lead
import com.hubsphere.android.auth.AuthManager
import com.hubsphere.android.telecom.CallManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class LeadDetailFragment : Fragment() {
    private var lead: Lead? = null
    private var leadId: String? = null

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        return inflater.inflate(R.layout.fragment_lead_detail, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        leadId = arguments?.getString("leadId")
        val btnCall: MaterialButton = view.findViewById(R.id.btnCall)
        btnCall.setOnClickListener { makeCall() }

        loadLead()
    }

    private fun loadLead() {
        val id = leadId ?: return
        lifecycleScope.launch {
            try {
                val apiService = ApiService.getInstance(requireContext())
                val leads = withContext(Dispatchers.IO) { apiService.getLeads(search = id) }
                lead = leads?.firstOrNull()
                updateUI()
            } catch (e: Exception) {
                // Silently fail - UI shows default state
            }
        }
    }

    private fun updateUI() {
        val l = lead ?: return
        view?.let { v ->
            val tvName: TextView? = v.findViewById(R.id.tvLeadName)
            val tvEmail: TextView? = v.findViewById(R.id.tvLeadEmail)
            val tvPhone: TextView? = v.findViewById(R.id.tvLeadPhone)
            val tvStatus: TextView? = v.findViewById(R.id.tvLeadStatus)
            tvName?.text = l.displayName
            tvEmail?.text = l.email ?: ""
            tvPhone?.text = l.phone ?: ""
            tvStatus?.text = l.status
        }
    }

    private fun makeCall() {
        val phone = lead?.phone
        if (phone.isNullOrEmpty()) {
            Toast.makeText(context, "No phone number available", Toast.LENGTH_SHORT).show()
            return
        }
        val callManager = context?.let { CallManager(it) } ?: return
        if (callManager.placeCall(phone)) {
            Toast.makeText(context, "Calling $phone", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(context, "Call failed", Toast.LENGTH_LONG).show()
        }
    }
}
