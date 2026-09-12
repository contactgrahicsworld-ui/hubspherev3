package com.hubsphere.android.ui.leads

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import com.google.android.material.button.MaterialButton
import com.hubsphere.android.R
import com.hubsphere.android.api.Lead
import com.hubsphere.android.telecom.CallManager

class LeadDetailFragment : Fragment() {
    private var lead: Lead? = null

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        return inflater.inflate(R.layout.fragment_lead_detail, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val btnCall: MaterialButton = view.findViewById(R.id.btnCall)
        btnCall.setOnClickListener { makeCall() }
    }

    private fun makeCall() {
        val phone = lead?.phone ?: return
        val callManager = context?.let { CallManager(it) } ?: return
        if (callManager.placeCall(phone)) {
            Toast.makeText(context, "Calling $phone", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(context, "Call failed", Toast.LENGTH_LONG).show()
        }
    }
}