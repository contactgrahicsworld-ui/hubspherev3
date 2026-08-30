import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function resetDatabase() {
  console.log('🗑️  Starting complete database reset...');

  // Delete in correct FK order to avoid constraint violations
  const deleteOrder = [
    // Automation (depends on users, tenants)
    'AutomationExecutionLog',
    'AutomationExecution',
    'AutomationAction',
    'AutomationCondition',
    'AutomationTrigger',
    'AutomationWorkflow',

    // Communication (depends on users, tenants, templates)
    'MessageEvent',
    'DeliveryAttempt',
    'MessageAttachment',
    'Message',
    'Conversation',
    'CommunicationTemplate',
    'CommunicationProviderConfig',
    'Notification',

    // AI
    'AiUsageLog',

    // HRMS
    'BankTransfer',
    'PayrollItem',
    'PayrollRecord',
    'Expense',
    'FieldVisit',
    'AttendanceSession',
    'LeaveRequest',
    'LeaveType',
    'EmployeeDocument',
    'Employee',
    'Designation',
    'Department',

    // CRM
    'CallRecording',
    'Call',
    'FollowUp',
    'Task',
    'Note',
    'Activity',
    'StageHistory',
    'CompanyTag',
    'ContactTag',
    'LeadTag',
    'Tag',
    'Deal',
    'Contact',
    'Company',
    'Lead',

    // Auth tokens
    'EmailVerificationToken',
    'PasswordResetToken',
    'RefreshToken',

    // Core platform
    'TenantFeatureFlag',
    'FeatureFlag',
    'AuditLog',
    'RolePermission',
    'Membership',
    'Subscription',
    'User',
    'Role',
    'Permission',
    'Tenant',
    'ProviderConfig',
  ];

  let totalDeleted = 0;

  for (const model of deleteOrder) {
    try {
      // @ts-expect-error dynamic model access
      const count = await db[model].count();
      if (count > 0) {
        // @ts-expect-error dynamic model access
        await db[model].deleteMany();
        console.log(`  ✅ Deleted ${count} rows from ${model}`);
        totalDeleted += count;
      } else {
        console.log(`  ⏭️  ${model}: empty (skipped)`);
      }
    } catch (err: any) {
      console.log(`  ❌ Error on ${model}: ${err.message}`);
    }
  }

  console.log(`\n🎉 Reset complete! Total records deleted: ${totalDeleted}`);
}

resetDatabase()
  .catch(console.error)
  .finally(() => db.$disconnect());
