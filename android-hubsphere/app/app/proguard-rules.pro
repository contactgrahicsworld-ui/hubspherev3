# Gson
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.hubsphere.android.api.models.** { *; }
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.TypeAdapter

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }

# AndroidX Security
-keep class androidx.security.** { *; }

# Kotlin Coroutines
-keepnames class kotlinx.coroutines.internal.CoroutineExceptionHandlerImpl
-keepclassmembernames class kotlinx.** {
    volatile **;
}
