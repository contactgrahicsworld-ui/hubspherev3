# Gson
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.hubsphere.android.api.models.** { *; }
-keep class com.google.gson.** { *; }
-dontwarn sun.misc.**

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

# OkHttp Logging Interceptor
-dontwarn okhttp3.internal.platform.**

# Security Crypto
-keep class androidx.security.** { *; }

# Kotlin Coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembers class kotlinx.coroutines.** {
    volatile **;
}

# AndroidX
-keep class androidx.** { *; }
-keep interface androidx.** { *; }
-dontwarn androidx.**

# Navigation
-keepnames class androidx.navigation.fragment.NavHostFragment
-keep class * extends androidx.fragment.app.Fragment { *; }

# HubSphere Models
-keep class com.hubsphere.android.api.models.** { *; }
-keep class com.hubsphere.android.auth.** { *; }
-keep class com.hubsphere.android.sync.** { *; }
-keep class com.hubsphere.android.device.** { *; }

# Telephony
-keep class android.telecom.** { *; }
-keep class com.hubsphere.android.telecom.** { *; }
