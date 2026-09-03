#!/bin/bash
set -e
BASE="http://localhost:3099"
PASS=0; FAIL=0; ERRORS=""

log_pass() { PASS=$((PASS+1)); echo "✅ PASS: $1"; }
log_fail() { FAIL=$((FAIL+1)); echo "❌ FAIL: $1 — $2"; ERRORS="$ERRORS\n  ❌ $1: $2"; }

resp_code() { echo "$1" | tail -1; }
resp_body() { echo "$1" | sed '$d'; }
http_get() { curl -s -m 15 -w "\n%{http_code}" "$BASE$1"; }
http_post() { curl -s -m 15 -w "\n%{http_code}" -X POST "$BASE$1" -H "Content-Type: application/json" ${2:+-d "$2"}; }
http_auth_get() { curl -s -m 15 -w "\n%{http_code}" "$BASE$1" -H "Authorization: Bearer $ACCESS_TOKEN"; }
http_auth_post() { curl -s -m 15 -w "\n%{http_code}" -X POST "$BASE$1" -H "Content-Type: application/json" -H "Authorization: Bearer $ACCESS_TOKEN" ${2:+-d "$2"}; }
extract_json() { echo "$1" | node -e "process.stdin.on('data',d=>{try{const j=JSON.parse(d);console.log($2)}catch{console.log('')}})"; }

# 1. Setup status - fresh
echo "=== TEST 1: Setup Status (Fresh DB) ==="
R=$(http_get "/api/v1/auth/setup/status")
C=$(resp_code "$R")
B=$(resp_body "$R")
echo "  Body: $B"
if [ "$C" = "200" ]; then
  SETUP_CHECK=$(echo "$B" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.setupComplete)}catch{}})")
  if [ "$SETUP_CHECK" = "false" ]; then
    log_pass "Setup status: setupComplete=false"
  else
    log_fail "Setup status" "Expected false, got $SETUP_CHECK"
  fi
else
  log_fail "Setup status HTTP" "$C"
fi

# 2. Setup - Create Super Admin
echo "\n=== TEST 2: Setup - Create Super Admin ==="
R=$(http_post "/api/v1/auth/setup" '{"name":"Admin","email":"admin@hubsphere.in","password":"Admin@12345"}')
C=$(resp_code "$R")
B=$(resp_body "$R")
echo "  Code: $C, Body: $(echo $B | head -c 400)"
if [ "$C" = "201" ]; then
  log_pass "Setup created admin (201)"
  ACCESS_TOKEN=$(extract_json "$B" "j.data.accessToken")
  REFRESH_TOKEN=$(extract_json "$B" "j.data.refreshToken")
  USER_ID=$(extract_json "$B" "j.data.user.id")
  echo "  Token (30): ${ACCESS_TOKEN:0:30}..."
  echo "  UserID: $USER_ID"
  if [ ${#ACCESS_TOKEN} -gt 50 ]; then
    log_pass "Valid access token returned"
  else
    log_fail "Access token" "Too short or empty"
  fi
else
  log_fail "Setup HTTP" "$C body: $(echo $B | head -c 200)"
fi

# 3. Setup status after setup
echo "\n=== TEST 3: Setup Status (After Setup) ==="
R=$(http_get "/api/v1/auth/setup/status")
C=$(resp_code "$R")
B=$(resp_body "$R")
SETUP_DONE=$(echo "$B" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.setupComplete)}catch{}})")
if [ "$SETUP_DONE" = "true" ]; then
  log_pass "Setup status now true"
else
  log_fail "Setup status" "Expected true, got $SETUP_DONE"
fi

# 4. Login correct
echo "\n=== TEST 4: Login (Correct Creds) ==="
R=$(http_post "/api/v1/auth/login" '{"email":"admin@hubsphere.in","password":"Admin@12345"}')
C=$(resp_code "$R")
B=$(resp_body "$R")
if [ "$C" = "200" ]; then
  log_pass "Login 200 OK"
  ACCESS_TOKEN=$(extract_json "$B" "j.data.accessToken")
  REFRESH_TOKEN=$(extract_json "$B" "j.data.refreshToken")
else
  log_fail "Login HTTP" "$C"
fi

# 5. Login wrong password
echo "\n=== TEST 5: Login (Wrong Password) ==="
R=$(http_post "/api/v1/auth/login" '{"email":"admin@hubsphere.in","password":"WrongPass123"}')
C=$(resp_code "$R")
if [ "$C" = "401" ]; then
  log_pass "Wrong password → 401"
else
  log_fail "Wrong pass" "Expected 401, got $C"
fi

# 6. Login non-existent user
echo "\n=== TEST 6: Login (Non-existent User) ==="
R=$(http_post "/api/v1/auth/login" '{"email":"nobody@nowhere.com","password":"Whatever@123"}')
C=$(resp_code "$R")
if [ "$C" = "401" ]; then
  log_pass "Non-existent user → 401"
else
  log_fail "Non-existent" "Expected 401, got $C"
fi

# 7. Setup again (should 403)
echo "\n=== TEST 7: Setup Again (Should 403) ==="
R=$(http_post "/api/v1/auth/setup" '{"name":"Hacker","email":"hacker@evil.com","password":"Hack@12345"}')
C=$(resp_code "$R")
B=$(resp_body "$R")
if [ "$C" = "403" ]; then
  log_pass "Repeat setup → 403"
else
  log_fail "Repeat setup" "Expected 403, got $C body: $(echo $B | head -c 200)"
fi

# 8. GET /auth/me with token
echo "\n=== TEST 8: GET /auth/me (With Token) ==="
R=$(http_auth_get "/api/v1/auth/me")
C=$(resp_code "$R")
B=$(resp_body "$R")
if [ "$C" = "200" ]; then
  log_pass "/auth/me 200 OK"
  echo "  User: $(echo $B | head -c 200)"
else
  log_fail "/auth/me" "Got $C"
fi

# 9. GET /auth/me without token
echo "\n=== TEST 9: GET /auth/me (No Token) ==="
R=$(http_get "/api/v1/auth/me")
C=$(resp_code "$R")
if [ "$C" = "401" ]; then
  log_pass "No token → 401"
else
  log_fail "No token" "Expected 401, got $C"
fi

# 10. Invalid token
echo "\n=== TEST 10: Invalid Token ==="
R=$(curl -s -m 10 -w "\n%{http_code}" "$BASE/api/v1/auth/me" -H "Authorization: Bearer invalidtoken123")
C=$(resp_code "$R")
if [ "$C" = "401" ]; then
  log_pass "Invalid token → 401"
else
  log_fail "Invalid token" "Expected 401, got $C"
fi

# 11. Refresh token
echo "\n=== TEST 11: Refresh Token ==="
R=$(curl -s -m 15 -w "\n%{http_code}" -X POST "$BASE/api/v1/auth/refresh" -H "Content-Type: application/json" -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}")
C=$(resp_code "$R")
B=$(resp_body "$R")
if [ "$C" = "200" ]; then
  log_pass "Refresh 200 OK"
  NEW_TOK=$(extract_json "$B" "j.data.accessToken")
  if [ -n "$NEW_TOK" ] && [ ${#NEW_TOK} -gt 50 ]; then
    ACCESS_TOKEN="$NEW_TOK"
    log_pass "New access token valid"
  else
    log_fail "New token" "Empty or too short"
  fi
else
  log_fail "Refresh" "Got $C: $(echo $B | head -c 200)"
fi

# 12. Forgot password
echo "\n=== TEST 12: Forgot Password ==="
R=$(http_post "/api/v1/auth/forgot-password" '{"email":"admin@hubsphere.in"}')
C=$(resp_code "$R")
B=$(resp_body "$R")
echo "  Code: $C, Body: $(echo $B | head -c 200)"
if [ "$C" = "200" ]; then
  log_pass "Forgot password 200"
else
  log_fail "Forgot password" "Got $C"
fi

# 13. Change password
echo "\n=== TEST 13: Change Password ==="
R=$(http_auth_post "/api/v1/auth/change-password" '{"currentPassword":"Admin@12345","newPassword":"NewAdmin@12345"}')
C=$(resp_code "$R")
B=$(resp_body "$R")
echo "  Change pw code: $C"
if [ "$C" = "200" ]; then
  log_pass "Change password 200"
  # Login with new pw
  R2=$(http_post "/api/v1/auth/login" '{"email":"admin@hubsphere.in","password":"NewAdmin@12345"}')
  C2=$(resp_code "$R2")
  if [ "$C2" = "200" ]; then
    log_pass "Login with new password OK"
    B2=$(resp_body "$R2")
    ACCESS_TOKEN=$(extract_json "$B2" "j.data.accessToken")
    REFRESH_TOKEN=$(extract_json "$B2" "j.data.refreshToken")
  else
    log_fail "New pw login" "Got $C2"
  fi
  # Change back
  R3=$(http_auth_post "/api/v1/auth/change-password" '{"currentPassword":"NewAdmin@12345","newPassword":"Admin@12345"}')
  C3=$(resp_code "$R3")
  if [ "$C3" = "200" ]; then
    log_pass "Password reverted OK"
  else
    log_fail "Password revert" "Got $C3"
  fi
  # Re-login original
  R4=$(http_post "/api/v1/auth/login" '{"email":"admin@hubsphere.in","password":"Admin@12345"}')
  C4=$(resp_code "$R4")
  if [ "$C4" = "200" ]; then
    log_pass "Re-login original pw OK"
    B4=$(resp_body "$R4")
    ACCESS_TOKEN=$(extract_json "$B4" "j.data.accessToken")
    REFRESH_TOKEN=$(extract_json "$B4" "j.data.refreshToken")
  else
    log_fail "Re-login original" "Got $C4"
  fi
else
  log_fail "Change password" "Got $C: $(echo $B | head -c 200)"
fi

# 14. Logout
echo "\n=== TEST 14: Logout ==="
R=$(http_auth_post "/api/v1/auth/logout" '')
C=$(resp_code "$R")
if [ "$C" = "200" ]; then
  log_pass "Logout 200"
else
  log_fail "Logout" "Got $C"
fi

# Re-login
R=$(http_post "/api/v1/auth/login" '{"email":"admin@hubsphere.in","password":"Admin@12345"}')
B=$(resp_body "$R")
ACCESS_TOKEN=$(extract_json "$B" "j.data.accessToken")
REFRESH_TOKEN=$(extract_json "$B" "j.data.refreshToken")

# 15. 2FA status
echo "\n=== TEST 15: 2FA Status ==="
R=$(http_auth_get "/api/v1/auth/two-factor/status")
C=$(resp_code "$R")
B=$(resp_body "$R")
echo "  2FA: $B"
if [ "$C" = "200" ]; then
  log_pass "2FA status 200"
  ENA=$(echo "$B" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.enabled)}catch{}})")
  if [ "$ENA" = "false" ]; then
    log_pass "2FA disabled by default"
  fi
else
  log_fail "2FA status" "Got $C"
fi

# 16. 2FA setup
echo "\n=== TEST 16: 2FA Setup ==="
R=$(http_auth_post "/api/v1/auth/two-factor/setup" '')
C=$(resp_code "$R")
B=$(resp_body "$R")
echo "  2FA Setup: $C, $(echo $B | head -c 300)"
if [ "$C" = "200" ]; then
  log_pass "2FA setup 200"
  SECRET=$(echo "$B" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).data.secret)}catch{}})")
  if [ -n "$SECRET" ]; then
    log_pass "2FA secret returned"
  else
    log_fail "2FA secret" "Empty"
  fi
else
  log_fail "2FA setup" "Got $C"
fi

# 17. System health
echo "\n=== TEST 17: System Health ==="
R=$(http_get "/api/v1/system/health")
C=$(resp_code "$R")
B=$(resp_body "$R")
echo "  Health: $(echo $B | head -c 300)"
if [ "$C" = "200" ]; then
  log_pass "System health 200"
else
  log_fail "System health" "Got $C"
fi

# 18. Root API
echo "\n=== TEST 18: Root API ==="
R=$(http_get "/api")
C=$(resp_code "$R")
if [ "$C" = "200" ]; then
  log_pass "Root API 200"
else
  log_fail "Root API" "Got $C"
fi

# Save tokens
echo "ACCESS_TOKEN=$ACCESS_TOKEN" > /tmp/hs-tokens.env
echo "REFRESH_TOKEN=$REFRESH_TOKEN" >> /tmp/hs-tokens.env
echo "USER_ID=$USER_ID" >> /tmp/hs-tokens.env

echo ""
echo "========================================"
echo "AUTH RESULTS: $PASS PASSED, $FAIL FAILED"
echo "========================================"
[ $FAIL -gt 0 ] && echo "FAILURES:$ERRORS"
