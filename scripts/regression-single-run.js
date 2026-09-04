/**
 * Single regression run with cleanup
 */
const BASE = 'https://hubspherev3.vercel.app';
const DB_URL = 'postgresql://postgres.nhgijoqgekhhoonmrsru:ipgroup%409301056006@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true';
const RUN_NUM = parseInt(process.argv[2] || '1');

async function cleanDB() {
  const {PrismaClient}=require('@prisma/client');
  const p=new PrismaClient({datasources:{db:{url:DB_URL}}});
  const tables=['delivery_attempts','message_events','message_attachments','messages','conversations','communication_provider_configs','communication_templates','notifications','automation_execution_logs','automation_executions','automation_actions','automation_conditions','automation_triggers','automation_workflows','ai_usage_logs','provider_configs','bank_transfers','payroll_items','payroll_records','expenses','field_visits','attendance_sessions','leave_requests','leave_types','employee_documents','employees','designations','departments','stage_history','activities','call_recordings','calls','company_tags','contact_tags','lead_tags','tags','notes','follow_ups','tasks','deals','companies','contacts','leads','role_permissions','permissions','audit_logs','refresh_tokens','password_reset_tokens','email_verification_tokens','memberships','users','roles','tenants'];
  for(const t of tables){try{await p.$executeRawUnsafe(`DELETE FROM ${t}`);}catch(e){}}
  await p.$disconnect();
}

// Import and reuse the test logic from v3
// Instead, just exec the v3 with TOTAL_RUNS=1
async function main() {
  console.log(`=== SINGLE RUN ${RUN_NUM} ===`);
  await cleanDB();
  console.log('DB cleaned, waiting 2s...');
  await new Promise(r=>setTimeout(r,2000));

  // Now run the v3 test but only 1 run
  const {execSync} = require('child_process');
  // Actually, let's just inline the full test
  // Quick approach: modify env and run
  process.env.RUN_NUM = RUN_NUM;
  
  // Load the test module
  const testCode = require('fs').readFileSync('/home/z/my-project/scripts/regression-5x-v3.js', 'utf8');
  // Override TOTAL_RUNS
  const modifiedCode = testCode.replace('const TOTAL_RUNS = 5;', `const TOTAL_RUNS = 1;`);
  require('fs').writeFileSync('/tmp/regression-single.js', modifiedCode);
  
  execSync('node /tmp/regression-single.js', {stdio: 'inherit'});
}

main().catch(e => console.error(e));
