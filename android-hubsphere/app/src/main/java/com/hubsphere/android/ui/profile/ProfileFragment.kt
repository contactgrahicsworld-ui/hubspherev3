package com.hubsphere.android.ui.profile

import android.app.AlertDialog
import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import com.google.android.material.button.MaterialButton
import com.hubsphere.android.R
import com.hubsphere.android.auth.AuthActivity
import com.hubsphere.android.auth.AuthManager
import com.hubsphere.android.device.DeviceManager
import com.hubsphere.android.telecom.SimChecker
import com.hubsphere.android.update.AppUpdateManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class ProfileFragment : Fragment() {
    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        return inflater.inflate(R.layout.fragment_profile, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val tvUserName: TextView = view.findViewById(R.id.tvUserName)
        val tvUserEmail: TextView = view.findViewById(R.id.tvUserEmail)
        val tvTenant: TextView = view.findViewById(R.id.tvTenant)
        val tvDeviceInfo: TextView = view.findViewById(R.id.tvDeviceInfo)
        val tvAppVersion: TextView = view.findViewById(R.id.tvAppVersion)
        val btnCheckUpdate: MaterialButton = view.findViewById(R.id.btnCheckUpdate)
        val btnDevices: MaterialButton = view.findViewById(R.id.btnDevices)
        val btnLogout: MaterialButton = view.findViewById(R.id.btnLogout)

        tvUserName.text = AuthManager.getUserName() ?: "User"
        tvUserEmail.text = AuthManager.getUserEmail() ?: ""

        val tenantName = AuthManager.getTenantName()
        tvTenant.text = if (tenantName != null) "Organization: $tenantName" else ""

        val simChecker = context?.let { SimChecker(it) }
        val simInfo = if (simChecker?.hasSim() == true) "SIM: ${simChecker.getOperatorName()}" else "No SIM"
        val deviceStatus = context?.let { DeviceManager(it).getDeviceStatus() } ?: "N/A"
        tvDeviceInfo.text = "Device: $deviceStatus | $simInfo"

        val versionName = try { context?.packageManager?.getPackageInfo(requireContext().packageName, 0)?.versionName ?: "?" } catch (e: Exception) { "?" }
        tvAppVersion.text = getString(R.string.version_format, versionName)

        // CHECK FOR UPDATE — separate from data sync
        btnCheckUpdate.setOnClickListener {
            CoroutineScope(Dispatchers.Main).launch {
                try {
                    val updateManager = AppUpdateManager(requireContext())
                    val info = withContext(Dispatchers.IO) { updateManager.checkForUpdate() }
                    val msg = updateManager.getUpdateMessage(info)
                    Toast.makeText(context, msg, Toast.LENGTH_LONG).show()
                    if (updateManager.shouldBlockApp(info)) {
                        AlertDialog.Builder(requireContext())
                            .setTitle(R.string.mandatory_update)
                            .setMessage("A mandatory update is required. Please update the app to continue.")
                            .setPositiveButton("OK") { _, _ -> requireActivity().finish() }
                            .setCancelable(false)
                            .show()
                    }
                } catch (e: Exception) {
                    Toast.makeText(context, "Update check failed", Toast.LENGTH_SHORT).show()
                }
            }
        }

        btnDevices.setOnClickListener {
            parentFragmentManager.beginTransaction()
                .replace(R.id.navHostFragment, com.hubsphere.android.ui.devices.DevicesFragment())
                .addToBackStack(null)
                .commit()
        }

        btnLogout.setOnClickListener {
            AuthManager.logout()
            startActivity(Intent(requireContext(), AuthActivity::class.java))
            requireActivity().finish()
        }
    }
}