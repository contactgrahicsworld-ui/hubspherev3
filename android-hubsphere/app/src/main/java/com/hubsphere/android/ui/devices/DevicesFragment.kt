package com.hubsphere.android.ui.devices

import android.app.AlertDialog
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText
import com.hubsphere.android.R
import com.hubsphere.android.auth.AuthManager
import com.hubsphere.android.device.DeviceManager
import com.hubsphere.android.telecom.SimChecker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class DevicesFragment : Fragment() {
    private lateinit var tvDeviceStatus: TextView
    private lateinit var tvSimInfo: TextView
    private lateinit var tvLastHeartbeat: TextView
    private lateinit var btnPairDevice: MaterialButton

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        return inflater.inflate(R.layout.fragment_devices, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        tvDeviceStatus = view.findViewById(R.id.tvDeviceStatus)
        tvSimInfo = view.findViewById(R.id.tvSimInfo)
        tvLastHeartbeat = view.findViewById(R.id.tvLastHeartbeat)
        btnPairDevice = view.findViewById(R.id.btnPairDevice)

        updateDeviceStatus()

        btnPairDevice.setOnClickListener { showPairDialog() }
    }

    private fun updateDeviceStatus() {
        val deviceManager = context?.let { DeviceManager(it) }
        val status = deviceManager?.getDeviceStatus() ?: "UNREGISTERED"
        tvDeviceStatus.text = "Device Status: $status"

        val simChecker = context?.let { SimChecker(it) }
        if (simChecker?.hasSim() == true) {
            tvSimInfo.text = "SIM: ${simChecker.getOperatorName()} | ${simChecker.getCountryCode()} | ${simChecker.getPhoneNumber() ?: "N/A"}"
        } else {
            tvSimInfo.text = "No SIM card detected"
        }

        val deviceId = AuthManager.getDeviceId()
        tvLastHeartbeat.text = if (deviceId != null) "Device ID: ${deviceId.take(8)}..." else "Not registered"
    }

    private fun showPairDialog() {
        val dialogView = LayoutInflater.from(context).inflate(R.layout.dialog_pair_device, null)
        val etToken = dialogView.findViewById<TextInputEditText>(R.id.etPairingToken)
        val btnPair = dialogView.findViewById<MaterialButton>(R.id.btnPair)

        val dialog = AlertDialog.Builder(context)
            .setView(dialogView)
            .create()

        btnPair.setOnClickListener {
            val token = etToken.text?.toString()?.trim() ?: ""
            if (token.isEmpty()) { etToken.error = "Token required"; return@setOnClickListener }

            CoroutineScope(Dispatchers.Main).launch {
                try {
                    val deviceManager = DeviceManager(requireContext())
                    // First register if not registered
                    if (AuthManager.getDeviceId() == null) {
                        withContext(Dispatchers.IO) { deviceManager.registerDevice() }
                    }
                    val result = withContext(Dispatchers.IO) { deviceManager.pairDevice(token) }
                    if (result != null) {
                        Toast.makeText(context, "Device paired! Status: ${result.status}", Toast.LENGTH_LONG).show()
                        updateDeviceStatus()
                        dialog.dismiss()
                    } else {
                        Toast.makeText(context, "Pairing failed", Toast.LENGTH_LONG).show()
                    }
                } catch (e: Exception) {
                    Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
        dialog.show()
    }
}