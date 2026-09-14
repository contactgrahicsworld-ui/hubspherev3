package com.hubsphere.android.auth

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ProgressBar
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import com.hubsphere.android.R
import com.hubsphere.android.api.ApiService
import com.hubsphere.android.telecom.SimChecker
import com.hubsphere.android.ui.MainActivity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class LoginFragment : Fragment() {

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.activity_login, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        if (AuthManager.isLoggedIn()) {
            navigateToMain()
            return
        }

        val tilEmail = view.findViewById<TextInputLayout>(R.id.tilEmail)
        val tilPassword = view.findViewById<TextInputLayout>(R.id.tilPassword)
        val etEmail = view.findViewById<TextInputEditText>(R.id.etEmail)
        val etPassword = view.findViewById<TextInputEditText>(R.id.etPassword)
        val btnLogin = view.findViewById<MaterialButton>(R.id.btnLogin)
        val tvError = view.findViewById<TextView>(R.id.tvError)
        val progressBar = view.findViewById<ProgressBar>(R.id.progressBar)
        val tvSimStatus = view.findViewById<TextView>(R.id.tvSimStatus)

        // Show SIM status
        context?.let {
            val simChecker = SimChecker(it)
            if (simChecker.hasSim()) {
                tvSimStatus.text = "SIM: ${simChecker.getOperatorName()} (${simChecker.getCountryCode()})"
            } else {
                tvSimStatus.text = getString(R.string.no_sim_detected)
                tvSimStatus.setTextColor(it.getColor(R.color.status_revoked))
            }
        }

        btnLogin.setOnClickListener {
            tilEmail.error = null
            tilPassword.error = null
            tvError.visibility = View.GONE

            val email = etEmail.text?.toString()?.trim() ?: ""
            val password = etPassword.text?.toString() ?: ""

            if (email.isEmpty()) {
                tilEmail.error = "Email is required"
                return@setOnClickListener
            }
            if (password.isEmpty()) {
                tilPassword.error = "Password is required"
                return@setOnClickListener
            }

            btnLogin.isEnabled = false
            progressBar.visibility = View.VISIBLE

            lifecycleScope.launch {
                try {
                    val apiService = ApiService.getInstance(requireContext())
                    val result = withContext(Dispatchers.IO) {
                        apiService.login(email, password, AuthManager.DEVICE_TYPE)
                    }
                    if (result != null) {
                        AuthManager.saveTokens(result.accessToken, result.refreshToken)
                        AuthManager.saveUser(
                            result.user.id,
                            result.user.name ?: "",
                            result.user.email,
                            result.tenant?.id ?: "",
                            result.tenant?.name ?: ""
                        )
                        navigateToMain()
                    } else {
                        tvError.text = getString(R.string.login_error_invalid)
                        tvError.visibility = View.VISIBLE
                    }
                } catch (e: Exception) {
                    tvError.text = getString(R.string.login_error_network)
                    tvError.visibility = View.VISIBLE
                } finally {
                    btnLogin.isEnabled = true
                    progressBar.visibility = View.GONE
                }
            }
        }
    }

    private fun navigateToMain() {
        startActivity(Intent(requireContext(), MainActivity::class.java))
        requireActivity().finish()
    }
}
