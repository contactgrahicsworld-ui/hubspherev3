import { PrismaClient } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()
  
  try {
    // Delete in reverse dependency order
    console.log('Deleting all data...')
    
    await prisma.automationExecutionLog.deleteMany()
    console.log('  ✓ automationExecutionLogs')
    
    await prisma.automationAction.deleteMany()
    console.log('  ✓ automationActions')
    
    await prisma.automationCondition.deleteMany()
    console.log('  ✓ automationConditions')
    
    await prisma.automationTrigger.deleteMany()
    console.log('  ✓ automationTriggers')
    
    await prisma.automationExecution.deleteMany()
    console.log('  ✓ automationExecutions')
    
    await prisma.automationWorkflow.deleteMany()
    console.log('  ✓ automationWorkflows')
    
    await prisma.messageEvent.deleteMany()
    console.log('  ✓ messageEvents')
    
    await prisma.deliveryAttempt.deleteMany()
    console.log('  ✓ deliveryAttempts')
    
    await prisma.messageAttachment.deleteMany()
    console.log('  ✓ messageAttachments')
    
    await prisma.message.deleteMany()
    console.log('  ✓ messages')
    
    await prisma.conversation.deleteMany()
    console.log('  ✓ conversations')
    
    await prisma.communicationProviderConfig.deleteMany()
    console.log('  ✓ communicationProviderConfigs')
    
    await prisma.communicationTemplate.deleteMany()
    console.log('  ✓ communicationTemplates')
    
    await prisma.notification.deleteMany()
    console.log('  ✓ notifications')
    
    await prisma.bankTransfer.deleteMany()
    console.log('  ✓ bankTransfers')
    
    await prisma.payrollItem.deleteMany()
    console.log('  ✓ payrollItems')
    
    await prisma.employeeDocument.deleteMany()
    console.log('  ✓ employeeDocuments')
    
    await prisma.attendanceSession.deleteMany()
    console.log('  ✓ attendanceSessions')
    
    await prisma.payrollRecord.deleteMany()
    console.log('  ✓ payrollRecords')
    
    await prisma.expense.deleteMany()
    console.log('  ✓ expenses')
    
    await prisma.fieldVisit.deleteMany()
    console.log('  ✓ fieldVisits')
    
    await prisma.leaveRequest.deleteMany()
    console.log('  ✓ leaveRequests')
    
    await prisma.leaveType.deleteMany()
    console.log('  ✓ leaveTypes')
    
    await prisma.employee.deleteMany()
    console.log('  ✓ employees')
    
    await prisma.designation.deleteMany()
    console.log('  ✓ designations')
    
    await prisma.department.deleteMany()
    console.log('  ✓ departments')
    
    await prisma.callRecording.deleteMany()
    console.log('  ✓ callRecordings')
    
    await prisma.followUp.deleteMany()
    console.log('  ✓ followUps')
    
    await prisma.task.deleteMany()
    console.log('  ✓ tasks')
    
    await prisma.note.deleteMany()
    console.log('  ✓ notes')
    
    await prisma.tag.deleteMany()
    console.log('  ✓ tags')
    
    await prisma.activity.deleteMany()
    console.log('  ✓ activities')
    
    await prisma.stageHistory.deleteMany()
    console.log('  ✓ stageHistory')
    
    await prisma.deal.deleteMany()
    console.log('  ✓ deals')
    
    await prisma.company.deleteMany()
    console.log('  ✓ companies')
    
    await prisma.contact.deleteMany()
    console.log('  ✓ contacts')
    
    await prisma.lead.deleteMany()
    console.log('  ✓ leads')
    
    await prisma.call.deleteMany()
    console.log('  ✓ calls')
    
    await prisma.auditLog.deleteMany()
    console.log('  ✓ auditLogs')
    
    await prisma.tenantFeatureFlag.deleteMany()
    console.log('  ✓ tenantFeatureFlags')
    
    await prisma.rolePermission.deleteMany()
    console.log('  ✓ rolePermissions')
    
    await prisma.role.deleteMany()
    console.log('  ✓ roles')
    
    await prisma.membership.deleteMany()
    console.log('  ✓ memberships')
    
    await prisma.subscription.deleteMany()
    console.log('  ✓ subscriptions')
    
    await prisma.tenant.deleteMany()
    console.log('  ✓ tenants')
    
    await prisma.emailVerificationToken.deleteMany()
    console.log('  ✓ emailVerificationTokens')
    
    await prisma.passwordResetToken.deleteMany()
    console.log('  ✓ passwordResetTokens')
    
    await prisma.refreshToken.deleteMany()
    console.log('  ✓ refreshTokens')
    
    await prisma.user.deleteMany()
    console.log('  ✓ users')
    
    await prisma.permission.deleteMany()
    console.log('  ✓ permissions')
    
    console.log('\n✅ All data deleted successfully! Database is fresh.')
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
