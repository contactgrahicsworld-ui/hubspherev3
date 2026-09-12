#!/usr/bin/env python3
"""Generate all HubSphere Android app source files."""
import os

BASE = "/home/z/my-project/android-hubsphere/app/src/main"

def write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        f.write(content)
    print(f"  ✅ {path}")

# ============================================================
# MANIFEST
# ============================================================
write(f"{BASE}/AndroidManifest.xml", '''<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <uses-permission android:name="android.permission.CALL_PHONE" />
    <uses-permission android:name="android.permission.READ_PHONE_STATE" />
    <uses-permission android:name="android.permission.READ_CALL_LOG" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.USE_BIOMETRIC" />

    <application
        android:name=".HubSphereApp"
        android:allowBackup="false"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:networkSecurityConfig="@xml/network_security_config"
        android:roundIcon="@mipmap/ic_launcher"
        android:supportsRtl="true"
        android:theme="@style/Theme.HubSphere"
        tools:targetApi="34">

        <activity
            android:name=".auth.LoginActivity"
            android:exported="true"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <activity
            android:name=".ui.MainActivity"
            android:exported="false" />

        <service
            android:name=".telecom.HubSphereInCallService"
            android:exported="true"
            android:permission="android.permission.BIND_INCALL_SERVICE">
            <intent-filter>
                <action android:name="android.telecom.CallService" />
            </intent-filter>
        </service>

        <service
            android:name=".sync.SyncService"
            android:exported="false"
            android:foregroundServiceType="dataSync" />

        <receiver
            android:name=".receiver.BootCompletedReceiver"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
            </intent-filter>
        </receiver>

        <receiver
            android:name=".receiver.NetworkConnectivityReceiver"
            android:exported="false">
            <intent-filter>
                <action android:name="android.net.conn.CONNECTIVITY_CHANGE" />
            </intent-filter>
        </receiver>

    </application>
</manifest>''')

# ============================================================
# RESOURCES
# ============================================================
write(f"{BASE}/res/values/strings.xml", '''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">HubSphere</string>
    <string name="login_title">HubSphere</string>
    <string name="login_subtitle">Sign in to your account</string>
    <string name="email_hint">Email address</string>
    <string name="password_hint">Password</string>
    <string name="login_button">Sign In</string>
    <string name="nav_dashboard">Dashboard</string>
    <string name="nav_contacts">Contacts</string>
    <string name="nav_leads">Leads</string>
    <string name="nav_calls">Calls</string>
    <string name="nav_more">More</string>
    <string name="device_status_active">Active</string>
    <string name="device_status_pending">Pending Approval</string>
    <string name="device_status_revoked">Revoked</string>
    <string name="call_button">Call</string>
    <string name="no_sim_detected">No SIM card detected</string>
    <string name="offline_mode">Offline Mode</string>
    <string name="sync_pending">Sync Pending</string>
    <string name="check_for_updates">Check for Updates</string>
    <string name="logout">Logout</string>
    <string name="version_format">Version %s</string>
    <string name="pair_device">Pair Device</string>
    <string name="pairing_token_hint">Enter pairing token</string>
    <string name="update_available">Update Available</string>
    <string name="mandatory_update">Mandatory Update Required</string>
</resources>''')

write(f"{BASE}/res/values/colors.xml", '''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="primary">#1565C0</color>
    <color name="primary_dark">#0D47A1</color>
    <color name="primary_light">#1E88E5</color>
    <color name="accent">#0D47A1</color>
    <color name="background">#F5F5F5</color>
    <color name="surface">#FFFFFF</color>
    <color name="text_primary">#212121</color>
    <color name="text_secondary">#757575</color>
    <color name="status_active">#4CAF50</color>
    <color name="status_pending">#FF9800</color>
    <color name="status_revoked">#F44336</color>
    <color name="status_pairing">#FFC107</color>
    <color name="white">#FFFFFF</color>
    <color name="black">#000000</color>
</resources>''')

write(f"{BASE}/res/values/themes.xml", '''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.HubSphere" parent="Theme.MaterialComponents.Light.NoActionBar">
        <item name="colorPrimary">@color/primary</item>
        <item name="colorPrimaryDark">@color/primary_dark</item>
        <item name="colorAccent">@color/accent</item>
        <item name="android:statusBarColor">@color/primary_dark</item>
        <item name="android:windowBackground">@color/background</item>
    </style>
    <style name="Theme.HubSphere.Login" parent="Theme.MaterialComponents.Light.NoActionBar">
        <item name="colorPrimary">@color/primary</item>
        <item name="colorPrimaryDark">@color/primary_dark</item>
        <item name="colorAccent">@color/accent</item>
        <item name="android:statusBarColor">@color/primary_dark</item>
    </style>
</resources>''')

write(f"{BASE}/res/xml/network_security_config.xml", '''<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">10.0.2.2</domain>
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">192.168.1.1</domain>
    </domain-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>''')

write(f"{BASE}/res/drawable/ic_launcher_foreground.xml", '''<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M38,35h6v38h-6z M64,35h6v38h-6z M44,50h20v6h-20z" />
</vector>''')

write(f"{BASE}/res/drawable/ic_launcher_background.xml", '''<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#1565C0"
        android:pathData="M0,0h108v108h-108z" />
</vector>''')

write(f"{BASE}/res/mipmap-anydpi-v26/ic_launcher.xml", '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
</adaptive-icon>''')

# Navigation graph
write(f"{BASE}/res/navigation/nav_graph.xml", '''<?xml version="1.0" encoding="utf-8"?>
<navigation xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:id="@+id/nav_graph"
    app:startDestination="@id/dashboardFragment">
    <fragment android:id="@+id/dashboardFragment" android:name="com.hubsphere.android.ui.dashboard.DashboardFragment" android:label="Dashboard" />
    <fragment android:id="@+id/contactsFragment" android:name="com.hubsphere.android.ui.contacts.ContactsFragment" android:label="Contacts" />
    <fragment android:id="@+id/contactDetailFragment" android:name="com.hubsphere.android.ui.contacts.ContactDetailFragment" android:label="Contact Detail" />
    <fragment android:id="@+id/leadsFragment" android:name="com.hubsphere.android.ui.leads.LeadsFragment" android:label="Leads" />
    <fragment android:id="@+id/leadDetailFragment" android:name="com.hubsphere.android.ui.leads.LeadDetailFragment" android:label="Lead Detail" />
    <fragment android:id="@+id/callsFragment" android:name="com.hubsphere.android.ui.calls.CallsFragment" android:label="Calls" />
    <fragment android:id="@+id/devicesFragment" android:name="com.hubsphere.android.ui.devices.DevicesFragment" android:label="Devices" />
    <fragment android:id="@+id/profileFragment" android:name="com.hubsphere.android.ui.profile.ProfileFragment" android:label="Profile" />
</navigation>''')

# ============================================================
# LAYOUTS
# ============================================================
write(f"{BASE}/res/layout/activity_login.xml", '''<?xml version="1.0" encoding="utf-8"?>
<androidx.constraintlayout.widget.ConstraintLayout xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@color/white"
    android:padding="24dp">

    <TextView android:id="@+id/tvLogo" android:layout_width="wrap_content" android:layout_height="wrap_content"
        android:text="HS" android:textSize="48sp" android:textColor="@color/primary" android:textStyle="bold"
        app:layout_constraintTop_toTopOf="parent" app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent" android:layout_marginTop="60dp" />

    <TextView android:id="@+id/tvAppName" android:layout_width="wrap_content" android:layout_height="wrap_content"
        android:text="@string/login_title" android:textSize="24sp" android:textColor="@color/text_primary"
        app:layout_constraintTop_toBottomOf="@id/tvLogo" app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent" android:layout_marginTop="8dp" />

    <TextView android:id="@+id/tvSubtitle" android:layout_width="wrap_content" android:layout_height="wrap_content"
        android:text="@string/login_subtitle" android:textSize="14sp" android:textColor="@color/text_secondary"
        app:layout_constraintTop_toBottomOf="@id/tvAppName" app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent" android:layout_marginTop="4dp" />

    <com.google.android.material.textfield.TextInputLayout android:id="@+id/tilEmail"
        android:layout_width="0dp" android:layout_height="wrap_content" android:layout_marginTop="32dp"
        app:layout_constraintTop_toBottomOf="@id/tvSubtitle" app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent">
        <com.google.android.material.textfield.TextInputEditText android:id="@+id/etEmail"
            android:layout_width="match_parent" android:layout_height="wrap_content"
            android:hint="@string/email_hint" android:inputType="textEmailAddress" />
    </com.google.android.material.textfield.TextInputLayout>

    <com.google.android.material.textfield.TextInputLayout android:id="@+id/tilPassword"
        android:layout_width="0dp" android:layout_height="wrap_content" android:layout_marginTop="16dp"
        app:passwordToggleEnabled="true"
        app:layout_constraintTop_toBottomOf="@id/tilEmail" app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent">
        <com.google.android.material.textfield.TextInputEditText android:id="@+id/etPassword"
            android:layout_width="match_parent" android:layout_height="wrap_content"
            android:hint="@string/password_hint" android:inputType="textPassword" />
    </com.google.android.material.textfield.TextInputLayout>

    <com.google.android.material.button.MaterialButton android:id="@+id/btnLogin"
        android:layout_width="0dp" android:layout_height="48dp" android:layout_marginTop="24dp"
        android:text="@string/login_button" app:cornerRadius="8dp"
        app:layout_constraintTop_toBottomOf="@id/tilPassword" app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent" />

    <ProgressBar android:id="@+id/progressBar" android:layout_width="wrap_content" android:layout_height="wrap_content"
        android:visibility="gone" app:layout_constraintTop_toBottomOf="@id/btnLogin"
        app:layout_constraintStart_toStartOf="parent" app:layout_constraintEnd_toEndOf="parent"
        android:layout_marginTop="16dp" />

    <TextView android:id="@+id/tvSimStatus" android:layout_width="wrap_content" android:layout_height="wrap_content"
        android:textSize="12sp" android:textColor="@color/text_secondary"
        app:layout_constraintBottom_toBottomOf="parent" app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent" android:layout_marginBottom="16dp" />

</androidx.constraintlayout.widget.ConstraintLayout>''')

write(f"{BASE}/res/layout/activity_main.xml", '''<?xml version="1.0" encoding="utf-8"?>
<androidx.constraintlayout.widget.ConstraintLayout xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent" android:layout_height="match_parent">

    <fragment android:id="@+id/navHostFragment"
        android:name="androidx.navigation.fragment.NavHostFragment"
        android:layout_width="0dp" android:layout_height="0dp"
        app:navGraph="@navigation/nav_graph"
        app:defaultNavHost="true"
        app:layout_constraintTop_toTopOf="parent"
        app:layout_constraintBottom_toTopOf="@id/bottomNav"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent" />

    <com.google.android.material.bottomnavigation.BottomNavigationView android:id="@+id/bottomNav"
        android:layout_width="0dp" android:layout_height="wrap_content"
        app:menu="@menu/bottom_nav_menu"
        app:labelVisibilityMode="labeled"
        app:layout_constraintBottom_toBottomOf="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent" />

</androidx.constraintlayout.widget.ConstraintLayout>''')

# Menu for bottom nav
os.makedirs(f"{BASE}/res/menu", exist_ok=True)
write(f"{BASE}/res/menu/bottom_nav_menu.xml", '''<?xml version="1.0" encoding="utf-8"?>
<menu xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:id="@+id/dashboardFragment" android:icon="@android:drawable/ic_menu_today" android:title="@string/nav_dashboard" />
    <item android:id="@+id/contactsFragment" android:icon="@android:drawable/ic_menu_myplaces" android:title="@string/nav_contacts" />
    <item android:id="@+id/leadsFragment" android:icon="@android:drawable/ic_menu_sort_by_size" android:title="@string/nav_leads" />
    <item android:id="@+id/callsFragment" android:icon="@android:drawable/ic_menu_call" android:title="@string/nav_calls" />
    <item android:id="@+id/profileFragment" android:icon="@android:drawable/ic_menu_preferences" android:title="@string/nav_more" />
</menu>''')

# Simple fragment layouts
for name, content in [
    ("fragment_dashboard", '''<?xml version="1.0" encoding="utf-8"?>
<ScrollView xmlns:android="http://schemas.android.com/apk/res/android" android:layout_width="match_parent" android:layout_height="match_parent" android:padding="16dp">
    <LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="vertical">
        <TextView android:id="@+id/tvGreeting" android:layout_width="match_parent" android:layout_height="wrap_content" android:textSize="20sp" android:textColor="@color/text_primary" android:textStyle="bold" />
        <TextView android:id="@+id/tvDeviceStatus" android:layout_width="match_parent" android:layout_height="wrap_content" android:textSize="14sp" android:textColor="@color/text_secondary" android:layout_marginTop="8dp" />
        <TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:text="Recent Calls" android:textSize="16sp" android:textColor="@color/text_primary" android:textStyle="bold" android:layout_marginTop="24dp" />
        <androidx.recyclerview.widget.RecyclerView android:id="@+id/rvRecentCalls" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="8dp" android:nestedScrollingEnabled="false" />
        <TextView android:id="@+id/tvPendingRequests" android:layout_width="match_parent" android:layout_height="wrap_content" android:textSize="14sp" android:textColor="@color/status_pending" android:visibility="gone" android:layout_marginTop="16dp" />
    </LinearLayout>
</ScrollView>'''),
    ("fragment_contacts", '''<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android" android:layout_width="match_parent" android:layout_height="match_parent" android:orientation="vertical">
    <com.google.android.material.textfield.TextInputEditText android:id="@+id/etSearch" android:layout_width="match_parent" android:layout_height="wrap_content" android:hint="Search contacts..." android:padding="12dp" android:layout_margin="8dp" android:drawableStart="@android:drawable/ic_menu_search" />
    <androidx.swiperefreshlayout.widget.SwipeRefreshLayout android:id="@+id/swipeRefresh" android:layout_width="match_parent" android:layout_height="match_parent">
        <androidx.recyclerview.widget.RecyclerView android:id="@+id/rvContacts" android:layout_width="match_parent" android:layout_height="match_parent" />
    </androidx.swiperefreshlayout.widget.SwipeRefreshLayout>
</LinearLayout>'''),
    ("fragment_contact_detail", '''<?xml version="1.0" encoding="utf-8"?>
<ScrollView xmlns:android="http://schemas.android.com/apk/res/android" android:layout_width="match_parent" android:layout_height="match_parent" android:padding="16dp">
    <LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="vertical">
        <TextView android:id="@+id/tvContactName" android:layout_width="match_parent" android:layout_height="wrap_content" android:textSize="22sp" android:textColor="@color/text_primary" android:textStyle="bold" />
        <TextView android:id="@+id/tvCompany" android:layout_width="match_parent" android:layout_height="wrap_content" android:textSize="14sp" android:textColor="@color/text_secondary" android:layout_marginTop="4dp" />
        <TextView android:id="@+id/tvPhone" android:layout_width="match_parent" android:layout_height="wrap_content" android:textSize="16sp" android:textColor="@color/primary" android:layout_marginTop="12dp" />
        <TextView android:id="@+id/tvEmail" android:layout_width="match_parent" android:layout_height="wrap_content" android:textSize="14sp" android:textColor="@color/text_secondary" android:layout_marginTop="4dp" />
        <com.google.android.material.button.MaterialButton android:id="@+id/btnCall" android:layout_width="match_parent" android:layout_height="48dp" android:text="@string/call_button" android:layout_marginTop="24dp" />
        <TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:text="Call History" android:textSize="16sp" android:textStyle="bold" android:layout_marginTop="24dp" />
        <androidx.recyclerview.widget.RecyclerView android:id="@+id/rvCallHistory" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="8dp" android:nestedScrollingEnabled="false" />
    </LinearLayout>
</ScrollView>'''),
    ("fragment_leads", '''<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android" android:layout_width="match_parent" android:layout_height="match_parent" android:orientation="vertical">
    <com.google.android.material.textfield.TextInputEditText android:id="@+id/etSearch" android:layout_width="match_parent" android:layout_height="wrap_content" android:hint="Search leads..." android:padding="12dp" android:layout_margin="8dp" android:drawableStart="@android:drawable/ic_menu_search" />
    <androidx.swiperefreshlayout.widget.SwipeRefreshLayout android:id="@+id/swipeRefresh" android:layout_width="match_parent" android:layout_height="match_parent">
        <androidx.recyclerview.widget.RecyclerView android:id="@+id/rvLeads" android:layout_width="match_parent" android:layout_height="match_parent" />
    </androidx.swiperefreshlayout.widget.SwipeRefreshLayout>
</LinearLayout>'''),
    ("fragment_lead_detail", '''<?xml version="1.0" encoding="utf-8"?>
<ScrollView xmlns:android="http://schemas.android.com/apk/res/android" android:layout_width="match_parent" android:layout_height="match_parent" android:padding="16dp">
    <LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="vertical">
        <TextView android:id="@+id/tvLeadName" android:layout_width="match_parent" android:layout_height="wrap_content" android:textSize="22sp" android:textColor="@color/text_primary" android:textStyle="bold" />
        <TextView android:id="@+id/tvLeadCompany" android:layout_width="match_parent" android:layout_height="wrap_content" android:textSize="14sp" android:textColor="@color/text_secondary" android:layout_marginTop="4dp" />
        <TextView android:id="@+id/tvLeadPhone" android:layout_width="match_parent" android:layout_height="wrap_content" android:textSize="16sp" android:textColor="@color/primary" android:layout_marginTop="12dp" />
        <TextView android:id="@+id/tvLeadStatus" android:layout_width="match_parent" android:layout_height="wrap_content" android:textSize="14sp" android:textColor="@color/status_pending" android:layout_marginTop="4dp" />
        <com.google.android.material.button.MaterialButton android:id="@+id/btnCall" android:layout_width="match_parent" android:layout_height="48dp" android:text="@string/call_button" android:layout_marginTop="24dp" />
    </LinearLayout>
</ScrollView>'''),
    ("fragment_calls", '''<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android" android:layout_width="match_parent" android:layout_height="match_parent" android:orientation="vertical">
    <androidx.swiperefreshlayout.widget.SwipeRefreshLayout android:id="@+id/swipeRefresh" android:layout_width="match_parent" android:layout_height="match_parent">
        <androidx.recyclerview.widget.RecyclerView android:id="@+id/rvCalls" android:layout_width="match_parent" android:layout_height="match_parent" />
    </androidx.swiperefreshlayout.widget.SwipeRefreshLayout>
</LinearLayout>'''),
    ("fragment_devices", '''<?xml version="1.0" encoding="utf-8"?>
<ScrollView xmlns:android="http://schemas.android.com/apk/res/android" android:layout_width="match_parent" android:layout_height="match_parent" android:padding="16dp">
    <LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="vertical">
        <TextView android:id="@+id/tvDeviceStatus" android:layout_width="match_parent" android:layout_height="wrap_content" android:textSize="16sp" android:textStyle="bold" />
        <TextView android:id="@+id/tvSimInfo" android:layout_width="match_parent" android:layout_height="wrap_content" android:textSize="14sp" android:textColor="@color/text_secondary" android:layout_marginTop="4dp" />
        <TextView android:id="@+id/tvLastHeartbeat" android:layout_width="match_parent" android:layout_height="wrap_content" android:textSize="12sp" android:textColor="@color/text_secondary" android:layout_marginTop="4dp" />
        <com.google.android.material.button.MaterialButton android:id="@+id/btnPairDevice" android:layout_width="match_parent" android:layout_height="48dp" android:text="@string/pair_device" android:layout_marginTop="16dp" />
        <TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:text="Call Requests" android:textSize="16sp" android:textStyle="bold" android:layout_marginTop="24dp" />
        <androidx.recyclerview.widget.RecyclerView android:id="@+id/rvCallRequests" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="8dp" android:nestedScrollingEnabled="false" />
    </LinearLayout>
</ScrollView>'''),
    ("fragment_profile", '''<?xml version="1.0" encoding="utf-8"?>
<ScrollView xmlns:android="http://schemas.android.com/apk/res/android" android:layout_width="match_parent" android:layout_height="match_parent" android:padding="16dp">
    <LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="vertical">
        <TextView android:id="@+id/tvUserName" android:layout_width="match_parent" android:layout_height="wrap_content" android:textSize="20sp" android:textColor="@color/text_primary" android:textStyle="bold" />
        <TextView android:id="@+id/tvUserEmail" android:layout_width="match_parent" android:layout_height="wrap_content" android:textSize="14sp" android:textColor="@color/text_secondary" android:layout_marginTop="4dp" />
        <TextView android:id="@+id/tvTenant" android:layout_width="match_parent" android:layout_height="wrap_content" android:textSize="14sp" android:textColor="@color/text_secondary" android:layout_marginTop="4dp" />
        <TextView android:id="@+id/tvDeviceInfo" android:layout_width="match_parent" android:layout_height="wrap_content" android:textSize="12sp" android:textColor="@color/text_secondary" android:layout_marginTop="12dp" />
        <TextView android:id="@+id/tvAppVersion" android:layout_width="match_parent" android:layout_height="wrap_content" android:textSize="12sp" android:textColor="@color/text_secondary" android:layout_marginTop="4dp" />
        <com.google.android.material.button.MaterialButton android:id="@+id/btnCheckUpdate" android:layout_width="match_parent" android:layout_height="48dp" android:text="@string/check_for_updates" android:layout_marginTop="24dp" style="@style/Widget.MaterialComponents.Button.OutlinedButton" />
        <com.google.android.material.button.MaterialButton android:id="@+id/btnDevices" android:layout_width="match_parent" android:layout_height="48dp" android:text="@string/pair_device" android:layout_marginTop="8dp" style="@style/Widget.MaterialComponents.Button.OutlinedButton" />
        <com.google.android.material.button.MaterialButton android:id="@+id/btnLogout" android:layout_width="match_parent" android:layout_height="48dp" android:text="@string/logout" android:layout_marginTop="8dp" android:backgroundTint="@color/status_revoked" />
    </LinearLayout>
</ScrollView>'''),
    ("item_contact", '''<?xml version="1.0" encoding="utf-8"?>
<androidx.cardview.widget.CardView xmlns:android="http://schemas.android.com/apk/res/android" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_margin="4dp" app:cardCornerRadius="8dp" xmlns:app="http://schemas.android.com/apk/res-auto">
    <LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="vertical" android:padding="12dp">
        <TextView android:id="@+id/tvName" android:layout_width="match_parent" android:layout_height="wrap_content" android:textSize="16sp" android:textColor="@color/text_primary" />
        <TextView android:id="@+id/tvCompany" android:layout_width="match_parent" android:layout_height="wrap_content" android:textSize="12sp" android:textColor="@color/text_secondary" />
        <TextView android:id="@+id/tvPhone" android:layout_width="match_parent" android:layout_height="wrap_content" android:textSize="14sp" android:textColor="@color/primary" />
    </LinearLayout>
</androidx.cardview.widget.CardView>'''),
    ("item_lead", '''<?xml version="1.0" encoding="utf-8"?>
<androidx.cardview.widget.CardView xmlns:android="http://schemas.android.com/apk/res/android" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_margin="4dp" xmlns:app="http://schemas.android.com/apk/res-auto" app:cardCornerRadius="8dp">
    <LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="vertical" android:padding="12dp">
        <TextView android:id="@+id/tvName" android:layout_width="match_parent" android:layout_height="wrap_content" android:textSize="16sp" android:textColor="@color/text_primary" />
        <TextView android:id="@+id/tvCompany" android:layout_width="match_parent" android:layout_height="wrap_content" android:textSize="12sp" android:textColor="@color/text_secondary" />
        <TextView android:id="@+id/tvStatus" android:layout_width="match_parent" android:layout_height="wrap_content" android:textSize="12sp" android:textColor="@color/status_pending" />
    </LinearLayout>
</androidx.cardview.widget.CardView>'''),
    ("item_call", '''<?xml version="1.0" encoding="utf-8"?>
<androidx.cardview.widget.CardView xmlns:android="http://schemas.android.com/apk/res/android" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_margin="4dp" xmlns:app="http://schemas.android.com/apk/res-auto" app:cardCornerRadius="8dp">
    <LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="vertical" android:padding="12dp">
        <TextView android:id="@+id/tvContact" android:layout_width="match_parent" android:layout_height="wrap_content" android:textSize="14sp" android:textColor="@color/text_primary" />
        <TextView android:id="@+id/tvDirection" android:layout_width="match_parent" android:layout_height="wrap_content" android:textSize="12sp" android:textColor="@color/text_secondary" />
        <TextView android:id="@+id/tvDuration" android:layout_width="match_parent" android:layout_height="wrap_content" android:textSize="12sp" android:textColor="@color/text_secondary" />
        <TextView android:id="@+id/tvTime" android:layout_width="match_parent" android:layout_height="wrap_content" android:textSize="12sp" android:textColor="@color/text_secondary" />
    </LinearLayout>
</androidx.cardview.widget.CardView>'''),
    ("item_device", '''<?xml version="1.0" encoding="utf-8"?>
<androidx.cardview.widget.CardView xmlns:android="http://schemas.android.com/apk/res/android" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_margin="4dp" xmlns:app="http://schemas.android.com/apk/res-auto" app:cardCornerRadius="8dp">
    <LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="vertical" android:padding="12dp">
        <TextView android:id="@+id/tvDeviceName" android:layout_width="match_parent" android:layout_height="wrap_content" android:textSize="14sp" android:textColor="@color/text_primary" />
        <TextView android:id="@+id/tvStatus" android:layout_width="match_parent" android:layout_height="wrap_content" android:textSize="12sp" />
    </LinearLayout>
</androidx.cardview.widget.CardView>'''),
    ("dialog_pair_device", '''<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android" android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="vertical" android:padding="24dp">
    <TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:text="Pair Device" android:textSize="20sp" android:textStyle="bold" />
    <TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:text="Enter the pairing token from the HubSphere web app" android:textSize="14sp" android:textColor="@color/text_secondary" android:layout_marginTop="8dp" />
    <com.google.android.material.textfield.TextInputEditText android:id="@+id/etPairingToken" android:layout_width="match_parent" android:layout_height="wrap_content" android:hint="@string/pairing_token_hint" android:layout_marginTop="16dp" />
    <com.google.android.material.button.MaterialButton android:id="@+id/btnPair" android:layout_width="match_parent" android:layout_height="48dp" android:text="Pair" android:layout_marginTop="16dp" />
</LinearLayout>'''),
    ("layout_call_overlay", '''<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android" android:layout_width="match_parent" android:layout_height="match_parent" android:background="#CC000000">
    <LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="vertical" android:gravity="center" android:layout_gravity="center" android:padding="24dp">
        <TextView android:id="@+id/tvCallContact" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textSize="24sp" android:textColor="@color/white" />
        <TextView android:id="@+id/tvCallStatus" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textSize="14sp" android:textColor="#B0BEC5" android:layout_marginTop="4dp" />
        <Chronometer android:id="@+id/chronometer" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textSize="32sp" android:textColor="@color/white" android:layout_marginTop="16dp" />
        <LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="horizontal" android:gravity="center" android:layout_marginTop="32dp">
            <com.google.android.material.button.MaterialButton android:id="@+id/btnMute" android:layout_width="64dp" android:layout_height="64dp" android:text="Mute" style="@style/Widget.MaterialComponents.Button.OutlinedButton" android:layout_marginEnd="24dp" />
            <com.google.android.material.button.MaterialButton android:id="@+id/btnEndCall" android:layout_width="64dp" android:layout_height="64dp" android:backgroundTint="@color/status_revoked" android:text="End" />
        </LinearLayout>
    </LinearLayout>
</FrameLayout>'''),
]:
    write(f"{BASE}/res/layout/{name}.xml", content)

# ProGuard
write(f"{BASE.replace('/src/main', '')}/app/proguard-rules.pro", '''# Gson
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
''')

print("\n✅ ALL RESOURCE FILES GENERATED")
