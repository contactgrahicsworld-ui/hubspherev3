package com.hubsphere.android.api

data class ApiResponse(
    val success: Boolean = false,
    val message: String? = null,
    val data: Any? = null
)

data class LoginResponse(
    val accessToken: String,
    val refreshToken: String,
    val user: UserBrief,
    val tenant: TenantBrief?,
    val role: String?
)

data class UserBrief(
    val id: String,
    val email: String,
    val name: String?,
    val isSuperAdmin: Boolean = false,
    val status: String = "ACTIVE",
    val avatarUrl: String? = null
)

data class TenantBrief(
    val id: String,
    val name: String,
    val status: String = "ACTIVE"
)

data class Contact(
    val id: String,
    val firstName: String? = null,
    val lastName: String? = null,
    val email: String? = null,
    val phone: String? = null,
    val company: String? = null,
    val companyId: String? = null,
    val status: String? = null,
    val createdAt: String? = null
) {
    val displayName: String get() = "${firstName ?: ""} ${lastName ?: ""}".trim().ifEmpty { "Unknown" }
}

data class Lead(
    val id: String,
    val firstName: String? = null,
    val lastName: String? = null,
    val email: String? = null,
    val phone: String? = null,
    val company: String? = null,
    val status: String = "NEW",
    val value: Double? = null,
    val createdAt: String? = null
) {
    val displayName: String get() = "${firstName ?: ""} ${lastName ?: ""}".trim().ifEmpty { "Unknown" }
}

data class CallRecord(
    val id: String,
    val direction: String? = null,
    val callType: String? = null,
    val callStatus: String? = null,
    val callStartTime: String? = null,
    val callEndTime: String? = null,
    val duration: Int? = null,
    val recordingStatus: String? = null,
    val recordingUrl: String? = null,
    val failureReason: String? = null,
    val createdAt: String? = null
)

data class Device(
    val id: String,
    val deviceName: String? = null,
    val deviceModel: String? = null,
    val osVersion: String? = null,
    val appVersion: String? = null,
    val simOperator: String? = null,
    val simCountry: String? = null,
    val phoneNumber: String? = null,
    val status: String = "UNREGISTERED",
    val pairingToken: String? = null,
    val deviceToken: String? = null,
    val lastHeartbeatAt: String? = null,
    val createdAt: String? = null
)

data class CallRequest(
    val id: String,
    val deviceId: String,
    val requestedBy: String,
    val phoneNumber: String,
    val contactName: String? = null,
    val status: String = "PENDING",
    val callId: String? = null,
    val expiresAt: String? = null,
    val createdAt: String? = null
)

data class CallEvent(
    val id: String,
    val callRequestId: String,
    val deviceId: String,
    val eventType: String,
    val eventData: Map<String, Any>? = null,
    val eventId: String,
    val duration: Int? = null,
    val failureReason: String? = null,
    val recordingAvailable: Boolean? = null,
    val recordingUrl: String? = null,
    val createdAt: String? = null
)

data class AppUpdateInfo(
    val updateAvailable: Boolean = false,
    val isMandatory: Boolean = false,
    val isCompatible: Boolean = true,
    val currentVersion: String = "",
    val latestVersion: String = "",
    val latestRelease: VersionRelease? = null,
    val action: String = "NO_UPDATE",
    val deprecationWarning: String? = null
)

data class VersionRelease(
    val version: String,
    val releaseDate: String,
    val changelog: List<String> = emptyList(),
    val mandatory: Boolean = false,
    val securityUpdate: Boolean = false
)