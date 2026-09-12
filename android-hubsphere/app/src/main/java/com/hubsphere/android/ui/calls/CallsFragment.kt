package com.hubsphere.android.ui.calls

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.hubsphere.android.R
import com.hubsphere.android.api.ApiService
import com.hubsphere.android.api.CallRecord
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class CallsFragment : Fragment() {
    private lateinit var rvCalls: RecyclerView
    private lateinit var swipeRefresh: SwipeRefreshLayout

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        return inflater.inflate(R.layout.fragment_calls, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        rvCalls = view.findViewById(R.id.rvCalls)
        swipeRefresh = view.findViewById(R.id.swipeRefresh)
        rvCalls.layoutManager = LinearLayoutManager(context)
        swipeRefresh.setOnRefreshListener { loadCalls() }
        loadCalls()
    }

    private fun loadCalls() {
        swipeRefresh.isRefreshing = true
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val calls = withContext(Dispatchers.IO) {
                    context?.let { ApiService.getInstance(it).getCalls() }
                }
                calls?.let { rvCalls.adapter = CallAdapter(it) }
            } catch (e: Exception) { }
            finally { swipeRefresh.isRefreshing = false }
        }
    }

    inner class CallAdapter(private val calls: List<CallRecord>) :
        RecyclerView.Adapter<CallAdapter.ViewHolder>() {
        inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
            val tvContact: android.widget.TextView = view.findViewById(R.id.tvContact)
            val tvDirection: android.widget.TextView = view.findViewById(R.id.tvDirection)
            val tvDuration: android.widget.TextView = view.findViewById(R.id.tvDuration)
            val tvTime: android.widget.TextView = view.findViewById(R.id.tvTime)
        }
        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
            ViewHolder(LayoutInflater.from(parent.context).inflate(R.layout.item_call, parent, false))
        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val call = calls[position]
            holder.tvContact.text = call.callType ?: "Call"
            holder.tvDirection.text = call.direction ?: "-"
            holder.tvDuration.text = "${call.duration ?: 0}s"
            holder.tvTime.text = call.createdAt?.take(10) ?: "-"
        }
        override fun getItemCount() = calls.size
    }
}