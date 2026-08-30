import { PrismaClient } from '@prisma/client';
const db = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres.nhgijoqgekhhoonmrsru:ipgroup%409301056006@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true' } }
});
async function reset() {
  console.log('Deleting all data...');
  const models = [
    'AutomationExecutionLog','AutomationExecution','AutomationAction','AutomationCondition','AutomationTrigger','AutomationWorkflow',
    'MessageEvent','DeliveryAttempt','MessageAttachment','Message','Conversation','CommunicationTemplate','CommunicationProviderConfig','Notification',
    'AiUsageLog','BankTransfer','PayrollItem','PayrollRecord','Expense','FieldVisit','AttendanceSession','LeaveRequest','LeaveType','EmployeeDocument','Employee','Designation','Department',
    'CallRecording','Call','FollowUp','Task','Note','Activity','StageHistory','CompanyTag','ContactTag','LeadTag','Tag','Deal','Contact','Company','Lead',
    'EmailVerificationToken','PasswordResetToken','RefreshToken',
    'TenantFeatureFlag','FeatureFlag','AuditLog','RolePermission','Membership','Subscription','User','Role','Permission','Tenant','ProviderConfig',
  ];
  let total = 0;
  for (const m of models) {
    try {
      // @ts-expect-error
      const c = await db[m].count();
      if (c > 0) {
        // @ts-expect-error
        await db[m].deleteMany();
        console.log('  Deleted ' + c + ' from ' + m);
        total += c;
      }
    } catch (e: any) { console.log('  Skip ' + m + ': ' + e.message?.substring(0, 60)); }
  }
  console.log('Total deleted: ' + total);
  await db.$disconnect();
}
reset().catch(e => { console.error(e); process.exit(1); });
