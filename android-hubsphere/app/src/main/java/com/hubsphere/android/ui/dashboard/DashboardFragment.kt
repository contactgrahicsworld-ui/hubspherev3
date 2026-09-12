package com.hubsphere.android.ui.dashboard

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.hubsphere.android.R
import com.hubsphere.android.api.ApiService
import com.hubsphere.android.api.CallRecord
import com.hubsphere.android.auth.AuthManager
import com.hubsphere.android.device.DeviceManager
import com.hubsphere.android.telecom.SimChecker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class DashboardFragment : Fragment() {
    private lateinit var tvGreeting: TextView
    private lateinit var tvDeviceStatus: TextView
    private lateinit var rvRecentCalls: RecyclerView

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        return inflater.inflate(R.layout.fragment_dashboard, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        tvGreeting = view.findViewById(R.id.tvGreeting)
        tvDeviceStatus = view.findViewById(R.id.tvDeviceStatus)
        rvRecentCalls = view.findViewById(R.id.rvRecentCalls)
        rvRecentCalls.layoutManager = LinearLayoutManager(context)

        val userName = AuthManager.getUserName() ?: "User"
        tvGreeting.text = "Hello, $userName"

        // Show device/SIM status
        val simChecker = context?.let { SimChecker(it) }
        val simStatus = if (simChecker?.hasSim() == true) "SIM: ${simChecker.getOperatorName()}" else "No SIM"
        val deviceStatus = DeviceManager(requireContext()).getDeviceStatus()
        tvDeviceStatus.text = "Device: $deviceStatus | $simStatus"

        loadRecentCalls()
    }

    private fun loadRecentCalls() {
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val calls = withContext(Dispatchers.IO) {
                    ApiService.getInstance(requireContext()).getCalls(limit = 5)
                }
                // Display calls in RecyclerView (simplified adapter)
                calls?.let {
                    rvRecentCalls.adapter = SimpleCallAdapter(it)
                }
            } catch (e: Exception) { }
        }
    }

    inner class SimpleCallAdapter(private val calls: List<CallRecord>) :
        RecyclerView.Adapter<SimpleCallAdapter.ViewHolder>() {
        inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
            val tvContact: TextView = view.findViewById(R.id.tvContact)
            val tvDirection: TextView = view.findViewById(R.id.tvDirection)
            val tvDuration: TextView = view.findViewById(R.id.tvDuration)
            val tvTime: TextView = view.findViewById(R.id.tvTime)
        }
        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
            ViewHolder(LayoutInflater.from(parent.context).inflate(R.layout.item_call, parent, false))
        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val call = calls[position]
            holder.tvContact.text = call.callType ?: "Unknown"
            holder.tvDirection.text = call.direction ?: "-"
            holder.tvDuration.text = "${call.duration ?: 0}s"
            holder.tvTime.text = call.createdAt?.take(10) ?: "-"
        }
        override fun getItemCount() = calls.size
    }
}