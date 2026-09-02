#!/bin/bash
# Quick focused API test
set -e

BASE="https://hubspherev3.vercel.app"

# Login
TOKEN=$(curl -s "$BASE/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@hubsphere.test","password":"Test@123456"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['accessToken'])")

echo "Token obtained: ${#TOKEN} chars"

PASS=0
FAIL=0

check() {
  local name="$1" status="$2"
  if [ "$status" -ge 200 ] && [ "$status" -lt 300 ]; then
    echo "✅ $name: $status"
    PASS=$((PASS+1))
  else
    echo "❌ $name: $status"
    FAIL=$((FAIL+1))
  fi
}

# POST endpoints
S=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/crm/leads" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"firstName":"J","lastName":"D","email":"j2@test.com"}')
check "Create Lead" "$S"

S=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/crm/contacts" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"firstName":"C","lastName":"D","email":"c2@test.com"}')
check "Create Contact" "$S"

S=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/crm/companies" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Acme Corp","industry":"TECHNOLOGY"}')
check "Create Company" "$S"

S=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/crm/deals" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Enterprise Deal","value":50000,"stage":"PROPOSAL"}')
check "Create Deal" "$S"

S=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/crm/tasks" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Follow up","priority":"HIGH","status":"PENDING"}')
check "Create Task" "$S"

S=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/crm/notes" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Meeting","content":"Discussed Q4"}')
check "Create Note" "$S"

S=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/crm/follow-ups" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Follow up","type":"CALL","dueDate":"2026-09-10"}')
check "Create FollowUp" "$S"

S=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/crm/calls" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"subject":"Call","direction":"OUTBOUND","duration":300,"status":"COMPLETED"}')
check "Create Call" "$S"

S=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/crm/tags" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"VIP","color":"#FF0000"}')
check "Create Tag" "$S"

S=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/hrms/departments" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Engineering","description":"Tech"}')
check "Create Department" "$S"

S=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/hrms/leave-types" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Casual Leave","code":"CL","days":12,"paid":true}')
check "Create LeaveType" "$S"

S=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/hrms/expenses" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Travel","amount":5000,"currency":"INR","category":"TRAVEL","date":"2026-09-01"}')
check "Create Expense" "$S"

S=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/hrms/field-visits" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Visit","date":"2026-09-03","purpose":"demo","location":"Mumbai","status":"PLANNED"}')
check "Create FieldVisit" "$S"

S=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/communication/templates" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Welcome","subject":"Hi","body":"Hello","type":"EMAIL","channel":"EMAIL"}')
check "Create Template" "$S"

S=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/automation/workflows" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"WF1","description":"test","triggerType":"MANUAL","status":"DRAFT"}')
check "Create Workflow" "$S"

# GET endpoints
for ep in "crm/dashboard" "crm/leads" "crm/contacts" "crm/companies" "crm/deals" "crm/tasks" "crm/notes" "crm/follow-ups" "crm/calls" "crm/tags" "crm/search?q=J" "crm/export?entityType=leads" "hrms/dashboard" "hrms/employees" "hrms/departments" "hrms/designations" "hrms/leave-types" "hrms/leave-requests" "hrms/attendance" "hrms/expenses" "hrms/field-visits" "hrms/payroll" "communication/dashboard" "communication/conversations" "communication/notifications" "communication/templates" "communication/providers" "automation/dashboard" "automation/workflows" "automation/executions" "analytics/crm" "analytics/hr" "analytics/communication" "analytics/automation" "analytics/ai-usage" "analytics/executive" "analytics/telecaller" "admin/users" "admin/roles" "admin/memberships" "admin/audit" "admin/settings" "super-admin/stats" "super-admin/users" "super-admin/tenants" "super-admin/roles" "super-admin/audit" "ai/providers" "ai/agents" "ai/usage" "system/providers"; do
  S=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/v1/$ep" -H "Authorization: Bearer $TOKEN")
  check "GET: $ep" "$S"
done

echo ""
echo "========================================"
echo "  RESULTS: $((PASS+FAIL)) total | ✅ $PASS passed | ❌ $FAIL failed"
echo "  Pass Rate: $(python3 -c "print(f'{$PASS/($PASS+$FAIL)*100:.1f}%')")  
echo "========================================"
