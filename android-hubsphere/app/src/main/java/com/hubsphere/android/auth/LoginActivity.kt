package com.hubsphere.android.auth

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText
import com.hubsphere.android.R
import com.hubsphere.android.api.ApiService
import com.hubsphere.android.telecom.SimChecker
import com.hubsphere.android.ui.MainActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class LoginActivity : AppCompatActivity() {
    private lateinit var etEmail: TextInputEditText
    private lateinit var etPassword: TextInputEditText
    private lateinit var btnLogin: MaterialButton
    private lateinit var progressBar: ProgressBar
    private lateinit var tvSimStatus: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        etEmail = findViewById(R.id.etEmail)
        etPassword = findViewById(R.id.etPassword)
        btnLogin = findViewById(R.id.btnLogin)
        progressBar = findViewById(R.id.progressBar)
        tvSimStatus = findViewById(R.id.tvSimStatus)

        // Show SIM status
        val simChecker = SimChecker(this)
        if (simChecker.hasSim()) {
            tvSimStatus.text = "SIM: ${simChecker.getOperatorName()} (${simChecker.getCountryCode()})"
        } else {
            tvSimStatus.text = getString(R.string.no_sim_detected)
            tvSimStatus.setTextColor(getColor(R.color.status_revoked))
        }

        // Auto-login if already authenticated
        if (AuthManager.isLoggedIn()) {
            navigateToMain()
            return
        }

        btnLogin.setOnClickListener { performLogin() }
    }

    private fun performLogin() {
        val email = etEmail.text?.toString()?.trim() ?: ""
        val password = etPassword.text?.toString() ?: ""
        if (email.isEmpty() || password.isEmpty()) return

        btnLogin.isEnabled = false
        progressBar.visibility = View.VISIBLE

        CoroutineScope(Dispatchers.Main).launch {
            try {
                val apiService = ApiService.getInstance(this@LoginActivity)
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
                    showError("Invalid credentials")
                }
            } catch (e: Exception) {
                showError(e.message ?: "Login failed")
            } finally {
                btnLogin.isEnabled = true
                progressBar.visibility = View.GONE
            }
        }
    }

    private fun showError(msg: String) {
        etPassword.error = msg
    }

    private fun navigateToMain() {
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}