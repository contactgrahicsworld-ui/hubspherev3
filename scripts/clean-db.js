const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres.nhgijoqgekhhoonmrsru:ipgroup%409301056006@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true' } }
});
(async () => {
  try {
    // First clean all data tables that have FK to users/tenants
    const dataTables = [
      'delivery_attempts','message_events','message_attachments','messages','conversations',
      'communication_provider_configs','communication_templates','notifications',
      'automation_execution_logs','automation_executions','automation_actions','automation_conditions','automation_triggers','automation_workflows',
      'ai_usage_logs','provider_configs',
      'bank_transfers','payroll_items','payroll_records','expenses','field_visits',
      'attendance_sessions','leave_requests','leave_types','employee_documents','employees',
      'designations','departments',
      'stage_history','activities','call_recordings','calls',
      'company_tags','contact_tags','lead_tags','tags',
      'notes','follow_ups','tasks','deals','companies','contacts','leads'
    ];
    for (const t of dataTables) {
      try { await p.$executeRawUnsafe('DELETE FROM ' + t); } catch(e) { /* skip */ }
    }
    console.log('Data tables cleared');

    // Then clean system tables
    await p.$executeRawUnsafe('DELETE FROM role_permissions');
    await p.$executeRawUnsafe('DELETE FROM permissions');
    await p.$executeRawUnsafe('DELETE FROM audit_logs');
    await p.$executeRawUnsafe('DELETE FROM refresh_tokens');
    await p.$executeRawUnsafe('DELETE FROM password_reset_tokens');
    await p.$executeRawUnsafe('DELETE FROM email_verification_tokens');
    await p.$executeRawUnsafe('DELETE FROM memberships');
    await p.$executeRawUnsafe('DELETE FROM users');
    await p.$executeRawUnsafe('DELETE FROM roles');
    await p.$executeRawUnsafe('DELETE FROM tenants');
    console.log('System tables cleared');
    console.log('DATABASE CLEANED!');
  } catch(e) { console.error('Error:', e.message); }
  await p.$disconnect();
})();