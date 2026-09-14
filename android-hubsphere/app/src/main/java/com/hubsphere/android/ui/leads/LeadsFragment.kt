package com.hubsphere.android.ui.leads

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
import com.hubsphere.android.api.Lead
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class LeadsFragment : Fragment() {
    private lateinit var rvLeads: RecyclerView
    private lateinit var swipeRefresh: SwipeRefreshLayout

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        return inflater.inflate(R.layout.fragment_leads, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        rvLeads = view.findViewById(R.id.rvLeads)
        swipeRefresh = view.findViewById(R.id.swipeRefresh)
        rvLeads.layoutManager = LinearLayoutManager(context)
        swipeRefresh.setOnRefreshListener { loadLeads() }
        loadLeads()
    }

    private fun loadLeads() {
        swipeRefresh.isRefreshing = true
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val leads = withContext(Dispatchers.IO) {
                    context?.let { ApiService.getInstance(it).getLeads() }
                }
                leads?.let { rvLeads.adapter = LeadAdapter(it) }
            } catch (e: Exception) { }
            finally { swipeRefresh.isRefreshing = false }
        }
    }

    inner class LeadAdapter(private val leads: List<Lead>) :
        RecyclerView.Adapter<LeadAdapter.ViewHolder>() {
        inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
            val tvName: android.widget.TextView = view.findViewById(R.id.tvName)
            val tvCompany: android.widget.TextView = view.findViewById(R.id.tvCompany)
            val tvStatus: android.widget.TextView = view.findViewById(R.id.tvStatus)
        }
        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
            ViewHolder(LayoutInflater.from(parent.context).inflate(R.layout.item_lead, parent, false))
        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val lead = leads[position]
            holder.tvName.text = lead.displayName
            holder.tvCompany.text = lead.company ?: ""
            holder.tvStatus.text = lead.status
        }
        override fun getItemCount() = leads.size
    }
}