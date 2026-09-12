package com.hubsphere.android.auth

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ProgressBar
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import com.hubsphere.android.HubSphereApp
import com.hubsphere.android.R
import com.hubsphere.android.api.ApiService
import com.hubsphere.android.api.models.LoginRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class LoginFragment : Fragment() {

    private lateinit var authManager: AuthManager
    private lateinit var apiService: ApiService

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.activity_login, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val app = requireActivity().application as HubSphereApp
        authManager = app.authManager
        apiService = ApiService(requireContext())

        if (authManager.isLoggedIn()) {
            findNavController().navigate(R.id.action_login_to_main)
            return
        }

        val tilEmail = view.findViewById<TextInputLayout>(R.id.tilEmail)
        val tilPassword = view.findViewById<TextInputLayout>(R.id.tilPassword)
        val etEmail = view.findViewById<TextInputEditText>(R.id.etEmail)
        val etPassword = view.findViewById<TextInputEditText>(R.id.etPassword)
        val btnLogin = view.findViewById<MaterialButton>(R.id.btnLogin)
        val tvError = view.findViewById<TextView>(R.id.tvError)
        val progressBar = view.findViewById<ProgressBar>(R.id.progressBar)

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
                    val request = LoginRequest(email, password, AuthManager.DEVICE_TYPE)
                    val response = withContext(Dispatchers.IO) {
                        apiService.login(request)
                    }
                    if (response.isSuccessful && response.body() != null) {
                        val loginResponse = response.body()!!
                        authManager.saveTokens(loginResponse.accessToken, loginResponse.refreshToken)
                        val user = loginResponse.user
                        if (user != null) {
                            authManager.saveUserInfo(
                                user.id, user.email, user.name, user.role,
                                user.tenantId ?: "", user.tenantName ?: ""
                            )
                        }
                        findNavController().navigate(R.id.action_login_to_main)
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
}
