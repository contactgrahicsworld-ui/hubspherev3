#!/bin/bash
# Route verification script for HubSphere
# Starts dev server and checks all routes

cd /home/z/my-project
export DATABASE_URL="postgresql://hubsphere:hubsphere_secure_password@localhost:5432/hubsphere"

# Start dev server in background
npx next dev --port 3000 > /tmp/hubsphere-dev.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait for server to be ready
for i in $(seq 1 30); do
  if curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/login 2>/dev/null | grep -q '200'; then
    echo "Server ready after ${i}s"
    break
  fi
  sleep 2
done

# Test routes
PASS=0
FAIL=0
RESULTS=""

for route in / /login /setup /signup /forgot-password /reset-password \
  /admin /crm /crm/leads /crm/contacts /crm/companies /crm/deals \
  /crm/tasks /crm/follow-ups /crm/telecaller /hrms /hrms/employees \
  /hrms/attendance /hrms/leave /hrms/payroll /communication \
  /communication/inbox /automation /automation/workflows /ai /ai/chat \
  /analytics /analytics/crm /analytics/hr /super-admin \
  /super-admin/tenants /super-admin/users /super-admin/health; do
  
  RESP=$(curl -s -w '\n%{http_code}' "http://localhost:3000$route" 2>/dev/null)
  CODE=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | sed '$d')
  SIZE=${#BODY}
  
  if [ "$CODE" = "200" ] || [ "$CODE" = "307" ] || [ "$CODE" = "302" ]; then
    if [ "$SIZE" -gt 500 ]; then
      RESULTS="$RESULTS\nOK|$CODE|$SIZE|$route"
      PASS=$((PASS + 1))
    else
      RESULTS="$RESULTS\nSMALL|$CODE|$SIZE|$route"
      FAIL=$((FAIL + 1))
    fi
  else
    RESULTS="$RESULTS\nFAIL|$CODE|$SIZE|$route"
    FAIL=$((FAIL + 1))
  fi
done

echo ""
echo "=== ROUTE VERIFICATION RESULTS ==="
echo "PASS: $PASS / FAIL: $FAIL"
echo -e "$RESULTS"

# Kill server
kill $SERVER_PID 2>/dev/null
echo ""
echo "Server stopped."
