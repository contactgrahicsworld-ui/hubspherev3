#!/bin/bash
BASE="http://localhost:3099"
PASS=0
FAIL=0
ERRORS=""

log_pass() { PASS=$((PASS+1)); echo "✅ PASS: $1"; }
log_fail() { FAIL=$((FAIL+1)); echo "❌ FAIL: $1 — $2"; ERRORS="$ERRORS\n  ❌ $1: $2"; }

# ========================================
# 1. SETUP STATUS (should show NOT setup)
# ========================================
STATUS=$(curl -s "$BASE/api/v1/auth/setup/status")
echo "Setup Status: $STATUS"
if echo "$STATUS" | grep -q '"setupComplete":false'; then
  log_pass "GET /api/v1/auth/setup/status — setupComplete:false (fresh DB)"
else
  log_fail "GET /api/v1/auth/setup/status" "Expected setupComplete:false"
fi

# ========================================
# 2. SETUP — Create Super Admin
# ========================================
SETUP_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v1/auth/setup" \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@hubsphere.in","password":"Admin@12345"}')
SETUP_CODE=$(echo "$SETUP_RESP" | tail -1)
SETUP_BODY=$(echo "$SETUP_RESP" | sed '$d')
echo "Setup Response ($SETUP_CODE): $SETUP_BODY" | head -c 500

if [ "$SETUP_CODE" = "201" ]; then
  log_pass "POST /api/v1/auth/setup — 201 Created Super Admin"
else
  log_fail "POST /api/v1/auth/setup" "Got HTTP $SETUP_CODE"
fi

# Extract tokens
ACCESS_TOKEN=$(echo "$SETUP_BODY" | node -e "process.stdin.on('data',d=>{try{const j=JSON.parse(d);console.log(j.data?.accessToken||'')}catch{}})")
REFRESH_TOKEN=$(echo "$SETUP_BODY" | node -e "process.stdin.on('data',d=>{try{const j=JSON.parse(d);console.log(j.data?.refreshToken||'')}catch{}})")
USER_ID=$(echo "$SETUP_BODY" | node -e "process.stdin.on('data',d=>{try{const j=JSON.parse(d);console.log(j.data?.user?.id||'')}catch{}})")
echo "Access Token (first 30): ${ACCESS_TOKEN:0:30}..."
echo "User ID: $USER_ID"

if [ -n "$ACCESS_TOKEN" ] && [ ${#ACCESS_TOKEN} -gt 50 ]; then
  log_pass "Setup returned valid access token"
else
  log_fail "Setup access token" "Token missing or too short: ${ACCESS_TOKEN:0:30}"
fi

# ========================================
# 3. SETUP STATUS AGAIN (should show setup COMPLETE)
# ========================================
STATUS2=$(curl -s "$BASE/api/v1/auth/setup/status")
if echo "$STATUS2" | grep -q '"setupComplete":true'; then
  log_pass "GET /api/v1/auth/setup/status — setupComplete:true (after setup)"
else
  log_fail "GET /api/v1/auth/setup/status" "Expected setupComplete:true, got: $STATUS2"
fi

# ========================================
# 4. LOGIN with correct credentials
# ========================================
LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hubsphere.in","password":"Admin@12345"}')
LOGIN_CODE=$(echo "$LOGIN_RESP" | tail -1)
LOGIN_BODY=$(echo "$LOGIN_RESP" | sed '$d')
echo "Login Response ($LOGIN_CODE): $(echo $LOGIN_BODY | head -c 300)"

if [ "$LOGIN_CODE" = "200" ]; then
  log_pass "POST /api/v1/auth/login — 200 OK"
  ACCESS_TOKEN=$(echo "$LOGIN_BODY" | node -e "process.stdin.on('data',d=>{try{const j=JSON.parse(d);console.log(j.data?.accessToken||'')}catch{}})")
  REFRESH_TOKEN=$(echo "$LOGIN_BODY" | node -e "process.stdin.on('data',d=>{try{const j=JSON.parse(d);console.log(j.data?.refreshToken||'')}catch{}})")
else
  log_fail "POST /api/v1/auth/login" "Got HTTP $LOGIN_CODE"
fi

# ========================================
# 5. LOGIN with wrong password
# ========================================
LOGIN_FAIL=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hubsphere.in","password":"WrongPass123"}')
FAIL_CODE=$(echo "$LOGIN_FAIL" | tail -1)
if [ "$FAIL_CODE" = "401" ]; then
  log_pass "POST /api/v1/auth/login (wrong pass) — 401 Unauthorized"
else
  log_fail "POST /api/v1/auth/login (wrong pass)" "Expected 401, got $FAIL_CODE"
fi

# ========================================
# 6. LOGIN with non-existent user
# ========================================
LOGIN_NOUSER=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"nobody@nowhere.com","password":"Admin@12345"}')
NOUSER_CODE=$(echo "$LOGIN_NOUSER" | tail -1)
if [ "$NOUSER_CODE" = "401" ]; then
  log_pass "POST /api/v1/auth/login (no user) — 401 Unauthorized"
else
  log_fail "POST /api/v1/auth/login (no user)" "Expected 401, got $NOUSER_CODE"
fi

# ========================================
# 7. SETUP AGAIN (should be rejected — already done)
# ========================================
SETUP_AGAIN=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v1/auth/setup" \
  -H "Content-Type: application/json" \
  -d '{"name":"Hacker","email":"hacker@evil.com","password":"Hacker@12345"}')
SETUP_AGAIN_CODE=$(echo "$SETUP_AGAIN" | tail -1)
if [ "$SETUP_AGAIN_CODE" = "403" ]; then
  log_pass "POST /api/v1/auth/setup (repeat) — 403 Forbidden"
else
  log_fail "POST /api/v1/auth/setup (repeat)" "Expected 403, got $SETUP_AGAIN_CODE"
fi

# ========================================
# 8. GET /auth/me with token
# ========================================
ME_RESP=$(curl -s -w "\n%{http_code}" "$BASE/api/v1/auth/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
ME_CODE=$(echo "$ME_RESP" | tail -1)
ME_BODY=$(echo "$ME_RESP" | sed '$d')
if [ "$ME_CODE" = "200" ]; then
  log_pass "GET /api/v1/auth/me — 200 OK"
else
  log_fail "GET /api/v1/auth/me" "Got $ME_CODE, body: $(echo $ME_BODY | head -c 200)"
fi

# ========================================
# 9. GET /auth/me WITHOUT token (should 401)
# ========================================
ME_NOAUTH=$(curl -s -w "\n%{http_code}" "$BASE/api/v1/auth/me")
ME_NOAUTH_CODE=$(echo "$ME_NOAUTH" | tail -1)
if [ "$ME_NOAUTH_CODE" = "401" ]; then
  log_pass "GET /api/v1/auth/me (no token) — 401"
else
  log_fail "GET /api/v1/auth/me (no token)" "Expected 401, got $ME_NOAUTH_CODE"
fi

# ========================================
# 10. SIGNUP (admin-invited flow)
# ========================================
SIGNUP_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v1/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"testuser@hubsphere.in","password":"Test@12345"}')
SIGNUP_CODE=$(echo "$SIGNUP_RESP" | tail -1)
SIGNUP_BODY=$(echo "$SIGNUP_RESP" | sed '$d')
echo "Signup ($SIGNUP_CODE): $(echo $SIGNUP_BODY | head -c 300)"
# Note: signup may require invitation - check if 403 or 201
if [ "$SIGNUP_CODE" = "201" ] || [ "$SIGNUP_CODE" = "403" ]; then
  log_pass "POST /api/v1/auth/signup — $SIGNUP_CODE (expected behavior)"
else
  log_fail "POST /api/v1/auth/signup" "Got $SIGNUP_CODE"
fi

# ========================================
# 11. REFRESH TOKEN
# ========================================
REFRESH_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v1/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}")
REFRESH_CODE=$(echo "$REFRESH_RESP" | tail -1)
REFRESH_BODY=$(echo "$REFRESH_RESP" | sed '$d')
if [ "$REFRESH_CODE" = "200" ]; then
  log_pass "POST /api/v1/auth/refresh — 200 OK"
  NEW_ACCESS=$(echo "$REFRESH_BODY" | node -e "process.stdin.on('data',d=>{try{const j=JSON.parse(d);console.log(j.data?.accessToken||'')}catch{}})")
  if [ -n "$NEW_ACCESS" ]; then
    ACCESS_TOKEN="$NEW_ACCESS"
    log_pass "Refresh returned new valid access token"
  fi
else
  log_fail "POST /api/v1/auth/refresh" "Got $REFRESH_CODE"
fi

# ========================================
# 12. FORGOT PASSWORD
# ========================================
FORGOT_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v1/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hubsphere.in"}')
FORGOT_CODE=$(echo "$FORGOT_RESP" | tail -1)
if [ "$FORGOT_CODE" = "200" ]; then
  log_pass "POST /api/v1/auth/forgot-password — 200 OK (email may not be sent without SMTP)"
else
  log_fail "POST /api/v1/auth/forgot-password" "Got $FORGOT_CODE"
fi

# ========================================
# 13. CHANGE PASSWORD (with current auth)
# ========================================
CHANGE_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v1/auth/change-password" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"currentPassword":"Admin@12345","newPassword":"NewAdmin@12345"}')
CHANGE_CODE=$(echo "$CHANGE_RESP" | tail -1)
CHANGE_BODY=$(echo "$CHANGE_RESP" | sed '$d')
if [ "$CHANGE_CODE" = "200" ]; then
  log_pass "POST /api/v1/auth/change-password — 200 OK"
  # Login with new password
  LOGIN_NEW=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@hubsphere.in","password":"NewAdmin@12345"}')
  LOGIN_NEW_CODE=$(echo "$LOGIN_NEW" | tail -1)
  if [ "$LOGIN_NEW_CODE" = "200" ]; then
    log_pass "Login with NEW password — 200 OK"
    LOGIN_NEW_BODY=$(echo "$LOGIN_NEW" | sed '$d')
    ACCESS_TOKEN=$(echo "$LOGIN_NEW_BODY" | node -e "process.stdin.on('data',d=>{try{const j=JSON.parse(d);console.log(j.data?.accessToken||'')}catch{}})")
    REFRESH_TOKEN=$(echo "$LOGIN_NEW_BODY" | node -e "process.stdin.on('data',d=>{try{const j=JSON.parse(d);console.log(j.data?.refreshToken||'')}catch{}})")
  else
    log_fail "Login with NEW password" "Got $LOGIN_NEW_CODE"
  fi
  # Change back to original
  curl -s -X POST "$BASE/api/v1/auth/change-password" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d '{"currentPassword":"NewAdmin@12345","newPassword":"Admin@12345"}' > /dev/null 2>&1
  # Re-login with original
  LOGIN_ORIG=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@hubsphere.in","password":"Admin@12345"}')
  LOGIN_ORIG_CODE=$(echo "$LOGIN_ORIG" | tail -1)
  LOGIN_ORIG_BODY=$(echo "$LOGIN_ORIG" | sed '$d')
  if [ "$LOGIN_ORIG_CODE" = "200" ]; then
    log_pass "Password change-back + re-login — 200 OK"
    ACCESS_TOKEN=$(echo "$LOGIN_ORIG_BODY" | node -e "process.stdin.on('data',d=>{try{const j=JSON.parse(d);console.log(j.data?.accessToken||'')}catch{}})")
    REFRESH_TOKEN=$(echo "$LOGIN_ORIG_BODY" | node -e "process.stdin.on('data',d=>{try{const j=JSON.parse(d);console.log(j.data?.refreshToken||'')}catch{}})")
  else
    log_fail "Password change-back + re-login" "Got $LOGIN_ORIG_CODE"
  fi
else
  log_fail "POST /api/v1/auth/change-password" "Got $CHANGE_CODE: $(echo $CHANGE_BODY | head -c 200)"
fi

# ========================================
# 14. LOGOUT
# ========================================
LOGOUT_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v1/auth/logout" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
LOGOUT_CODE=$(echo "$LOGOUT_RESP" | tail -1)
if [ "$LOGOUT_CODE" = "200" ]; then
  log_pass "POST /api/v1/auth/logout — 200 OK"
else
  log_fail "POST /api/v1/auth/logout" "Got $LOGOUT_CODE"
fi

# Re-login after logout
RELOGIN=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hubsphere.in","password":"Admin@12345"}')
RELOGIN_CODE=$(echo "$RELOGIN" | tail -1)
RELOGIN_BODY=$(echo "$RELOGIN" | sed '$d')
if [ "$RELOGIN_CODE" = "200" ]; then
  log_pass "Re-login after logout — 200 OK"
  ACCESS_TOKEN=$(echo "$RELOGIN_BODY" | node -e "process.stdin.on('data',d=>{try{const j=JSON.parse(d);console.log(j.data?.accessToken||'')}catch{}})")
  REFRESH_TOKEN=$(echo "$RELOGIN_BODY" | node -e "process.stdin.on('data',d=>{try{const j=JSON.parse(d);console.log(j.data?.refreshToken||'')}catch{}})")
else
  log_fail "Re-login after logout" "Got $RELOGIN_CODE"
fi

# ========================================
# 15. 2FA STATUS (should be disabled by default)
# ========================================
2FA_STATUS=$(curl -s -w "\n%{http_code}" "$BASE/api/v1/auth/two-factor/status" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
2FA_CODE=$(echo "$2FA_STATUS" | tail -1)
2FA_BODY=$(echo "$2FA_STATUS" | sed '$d')
echo "2FA Status ($2FA_CODE): $(echo $2FA_BODY | head -c 200)"
if [ "$2FA_CODE" = "200" ]; then
  log_pass "GET /api/v1/auth/two-factor/status — 200 OK"
  if echo "$2FA_BODY" | grep -q '"enabled":false'; then
    log_pass "2FA is disabled by default (correct)"
  fi
else
  log_fail "GET /api/v1/auth/two-factor/status" "Got $2FA_CODE"
fi

# ========================================
# 16. 2FA SETUP
# ========================================
2FA_SETUP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v1/auth/two-factor/setup" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json")
2FA_SETUP_CODE=$(echo "$2FA_SETUP" | tail -1)
2FA_SETUP_BODY=$(echo "$2FA_SETUP" | sed '$d')
echo "2FA Setup ($2FA_SETUP_CODE): $(echo $2FA_SETUP_BODY | head -c 300)"
if [ "$2FA_SETUP_CODE" = "200" ]; then
  log_pass "POST /api/v1/auth/two-factor/setup — 200 OK"
else
  log_fail "POST /api/v1/auth/two-factor/setup" "Got $2FA_SETUP_CODE"
fi

# ========================================
# 17. INVALID TOKEN test
# ========================================
INVALID_RESP=$(curl -s -w "\n%{http_code}" "$BASE/api/v1/auth/me" \
  -H "Authorization: Bearer invalidtoken12345")
INVALID_CODE=$(echo "$INVALID_RESP" | tail -1)
if [ "$INVALID_CODE" = "401" ]; then
  log_pass "GET /api/v1/auth/me (invalid token) — 401"
else
  log_fail "GET /api/v1/auth/me (invalid token)" "Expected 401, got $INVALID_CODE"
fi

# ========================================
# 18. SYSTEM HEALTH
# ========================================
HEALTH=$(curl -s -w "\n%{http_code}" "$BASE/api/v1/system/health")
HEALTH_CODE=$(echo "$HEALTH" | tail -1)
HEALTH_BODY=$(echo "$HEALTH" | sed '$d')
echo "Health ($HEALTH_CODE): $(echo $HEALTH_BODY | head -c 300)"
if [ "$HEALTH_CODE" = "200" ]; then
  log_pass "GET /api/v1/system/health — 200 OK"
else
  log_fail "GET /api/v1/system/health" "Got $HEALTH_CODE"
fi

# ========================================
# 19. ROOT API
# ========================================
ROOT_API=$(curl -s -w "\n%{http_code}" "$BASE/api")
ROOT_API_CODE=$(echo "$ROOT_API" | tail -1)
if [ "$ROOT_API_CODE" = "200" ]; then
  log_pass "GET /api — 200 OK"
else
  log_fail "GET /api" "Got $ROOT_API_CODE"
fi

# ========================================
# SAVE TOKENS FOR NEXT TEST SCRIPT
# ========================================
echo "ACCESS_TOKEN=$ACCESS_TOKEN" > /tmp/hs-test-tokens.env
echo "REFRESH_TOKEN=$REFRESH_TOKEN" >> /tmp/hs-test-tokens.env
echo "USER_ID=$USER_ID" >> /tmp/hs-test-tokens.env

# ========================================
# SUMMARY
# ========================================
echo ""
echo "========================================"
echo "AUTH TEST RESULTS: $PASS PASSED, $FAIL FAILED"
echo "========================================"
if [ $FAIL -gt 0 ]; then
  echo "FAILURES:$ERRORS"
fi
