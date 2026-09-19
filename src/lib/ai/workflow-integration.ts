/**
 * AI Workflow Integration — connects AI to actual business workflows.
 *
 * Every function:
 * - Checks aiGateway.isAvailable() first — returns null if not configured
 * - Respects RBAC (checks user has ai.use permission)
 * - Respects tenant isolation (tenantId is always required)
 * - Respects feature entitlements (checks 'ai' feature flag)
 * - Logs AI usage via AiUsageLog
 * - NEVER fakes AI responses
 * - High-impact actions support dryRun option (default false)
 *   — when dryRun=true, return recommendations without making changes
 */

import { db } from '@/lib/db';
import { aiGateway } from '@/lib/providers/ai-gateway';
import { hasPermission, requirePermission } from '@/lib/rbac';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { FEATURE_FLAG_KEYS } from '@/lib/feature-flags';
import { ProviderNotConfiguredError } from '@/lib/errors';
import type { AIResponse } from '@/lib/providers/types';

// ============================================
// TYPES
// ============================================

interface WorkflowContext {
  tenantId: string;
  userId: string;
  roleCode?: string | null;
  isSuperAdmin?: boolean;
}

interface AIWorkflowResult<T> {
  success: boolean;
  data: T | null;
  aiUsed: boolean;
  dryRun: boolean;
  error?: string;
}

// ============================================
// HELPERS
// ============================================

/**
 * Pre-flight check for AI availability + RBAC + feature flag.
 * Returns an error string if AI cannot proceed, null if OK.
 */
async function preflightCheck(ctx: WorkflowContext): Promise<string | null> {
  // 1. AI provider available?
  if (!aiGateway.isAvailable()) {
    return 'AI_NOT_CONFIGURED';
  }

  // 2. Feature flag
  const aiEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.AI, ctx.tenantId);
  if (!aiEnabled) {
    return 'AI_FEATURE_DISABLED';
  }

  // 3. RBAC — user must have ai.use permission
  const hasAccess = await hasPermission(
    ctx.roleCode ?? null,
    'ai.use',
    ctx.tenantId,
    ctx.isSuperAdmin,
  );
  if (!hasAccess) {
    return 'AI_PERMISSION_DENIED';
  }

  return null;
}

/**
 * Call AI gateway with error handling. Returns null if provider not configured.
 */
async function callAI(
  prompt: string,
  tenantId: string,
): Promise<AIResponse | null> {
  try {
    return await aiGateway.process(prompt, tenantId);
  } catch (err) {
    if (err instanceof ProviderNotConfiguredError) {
      return null;
    }
    throw err;
  }
}

/**
 * Log AI usage to AiUsageLog table (best-effort).
 */
async function logAIUsage(
  tenantId: string,
  userId: string,
  agentName: string,
  durationMs: number,
  success: boolean,
  response?: AIResponse,
  error?: string,
): Promise<void> {
  try {
    await db.aiUsageLog.create({
      data: {
        tenantId,
        userId,
        providerId: response?.providerId,
        model: response?.model,
        agentName,
        inputTokens: response?.usage?.inputTokens,
        outputTokens: response?.usage?.outputTokens,
        durationMs,
        status: success ? 'SUCCESS' : 'FAILED',
      },
    });
  } catch {
    // Usage logging is best-effort — never block the response
  }
}

/**
 * Parse a JSON response from AI. Returns null if parsing fails.
 */
function parseAIJson<T>(content: string): T | null {
  try {
    // Try direct JSON parse
    return JSON.parse(content) as T;
  } catch {
    // Try extracting JSON from markdown code block
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim()) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ============================================
// 1. NEW LEAD — AI Qualification
// ============================================

interface LeadQualification {
  score: number;        // 0-100
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  recommendedOwner: string | null;
  suggestedFollowUp: string | null;
}

interface LeadData {
  id: string;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  company?: string | null;
  source: string;
  value?: number | null;
  description?: string | null;
}

/**
 * AI qualifies a new lead.
 * Returns score, priority, recommended owner, and suggested follow-up.
 * Creates a task for follow-up if suggested (unless dryRun).
 */
export async function qualifyLead(
  ctx: WorkflowContext,
  lead: LeadData,
  dryRun = false,
): Promise<AIWorkflowResult<LeadQualification>> {
  const check = await preflightCheck(ctx);
  if (check) {
    return { success: false, data: null, aiUsed: false, dryRun, error: check };
  }

  const start = Date.now();

  try {
    const prompt = `You are a lead qualification AI. Analyze this new lead and provide a qualification assessment.

Lead details:
- Name: ${lead.firstName} ${lead.lastName ?? ''}
- Email: ${lead.email ?? 'N/A'}
- Company: ${lead.company ?? 'N/A'}
- Source: ${lead.source}
- Estimated Value: ${lead.value ?? 'N/A'}
- Description: ${lead.description ?? 'N/A'}

Respond with a JSON object containing:
{
  "score": <number 0-100, lead quality score>,
  "priority": <"LOW" | "MEDIUM" | "HIGH" | "URGENT">,
  "recommendedOwner": <null or a role like "SALES_EXECUTIVE" | "SALES_MANAGER">,
  "suggestedFollowUp": <null or a brief description of the recommended next follow-up action>
}

Be conservative with scores. Only suggest URGENT for high-value leads from strong sources.`;

    const response = await callAI(prompt, ctx.tenantId);
    if (!response) {
      return { success: false, data: null, aiUsed: false, dryRun, error: 'AI_NOT_CONFIGURED' };
    }

    const durationMs = Date.now() - start;
    await logAIUsage(ctx.tenantId, ctx.userId, 'WORKFLOW_QUALIFY_LEAD', durationMs, true, response);

    const parsed = parseAIJson<LeadQualification>(response.content);
    if (!parsed || typeof parsed.score !== 'number') {
      return { success: false, data: null, aiUsed: true, dryRun, error: 'AI_RESPONSE_PARSE_ERROR' };
    }

    // Clamp score
    parsed.score = Math.max(0, Math.min(100, parsed.score));

    // Validate priority
    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
    if (!validPriorities.includes(parsed.priority as any)) {
      parsed.priority = parsed.score >= 80 ? 'URGENT' : parsed.score >= 60 ? 'HIGH' : parsed.score >= 40 ? 'MEDIUM' : 'LOW';
    }

    // Apply changes (unless dryRun)
    if (!dryRun) {
      // Update lead priority if AI suggests different
      await db.lead.update({
        where: { id: lead.id, tenantId: ctx.tenantId },
        data: { priority: parsed.priority },
      });

      // Create follow-up task if suggested
      if (parsed.suggestedFollowUp) {
        await db.task.create({
          data: {
            tenantId: ctx.tenantId,
            title: `Follow-up: ${parsed.suggestedFollowUp}`,
            description: `AI-suggested follow-up for lead ${lead.firstName} ${lead.lastName ?? ''} (Score: ${parsed.score})`,
            status: 'TODO',
            priority: parsed.priority,
            entityType: 'LEAD',
            entityId: lead.id,
            ownerId: ctx.userId,
          },
        });
      }
    }

    return { success: true, data: parsed, aiUsed: true, dryRun };
  } catch (err) {
    const durationMs = Date.now() - start;
    await logAIUsage(ctx.tenantId, ctx.userId, 'WORKFLOW_QUALIFY_LEAD', durationMs, false, undefined, String(err));
    return { success: false, data: null, aiUsed: true, dryRun, error: 'AI_PROCESSING_ERROR' };
  }
}

// ============================================
// 2. OVERDUE LEADS — AI Analysis
// ============================================

interface OverdueLeadAnalysis {
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendedAction: string;
  followUpTask: string | null;
}

/**
 * AI detects and analyzes an overdue lead.
 * Updates lead priority if urgency is HIGH (unless dryRun).
 */
export async function analyzeOverdueLead(
  ctx: WorkflowContext,
  lead: LeadData & { status: string; lastActivityAt?: string | null; daysOverdue: number },
  dryRun = false,
): Promise<AIWorkflowResult<OverdueLeadAnalysis>> {
  const check = await preflightCheck(ctx);
  if (check) {
    return { success: false, data: null, aiUsed: false, dryRun, error: check };
  }

  const start = Date.now();

  try {
    const prompt = `You are an overdue lead analysis AI. This lead has not been followed up on time.

Lead details:
- Name: ${lead.firstName} ${lead.lastName ?? ''}
- Company: ${lead.company ?? 'N/A'}
- Status: ${lead.status}
- Days overdue: ${lead.daysOverdue}
- Source: ${lead.source}
- Value: ${lead.value ?? 'N/A'}

Respond with JSON:
{
  "urgency": <"LOW" | "MEDIUM" | "HIGH">,
  "recommendedAction": <brief description of what should be done>,
  "followUpTask": <null or a brief task title for follow-up>
}

Higher overdue days and higher value = higher urgency.`;

    const response = await callAI(prompt, ctx.tenantId);
    if (!response) {
      return { success: false, data: null, aiUsed: false, dryRun, error: 'AI_NOT_CONFIGURED' };
    }

    const durationMs = Date.now() - start;
    await logAIUsage(ctx.tenantId, ctx.userId, 'WORKFLOW_OVERDUE_LEAD', durationMs, true, response);

    const parsed = parseAIJson<OverdueLeadAnalysis>(response.content);
    if (!parsed || !parsed.urgency) {
      return { success: false, data: null, aiUsed: true, dryRun, error: 'AI_RESPONSE_PARSE_ERROR' };
    }

    // Validate urgency
    const validUrgencies = ['LOW', 'MEDIUM', 'HIGH'] as const;
    if (!validUrgencies.includes(parsed.urgency as any)) {
      parsed.urgency = lead.daysOverdue > 7 ? 'HIGH' : lead.daysOverdue > 3 ? 'MEDIUM' : 'LOW';
    }

    if (!dryRun) {
      // Update lead priority to HIGH or URGENT if urgency is HIGH
      if (parsed.urgency === 'HIGH') {
        await db.lead.update({
          where: { id: lead.id, tenantId: ctx.tenantId },
          data: { priority: 'URGENT' },
        });
      }

      // Create follow-up task if suggested
      if (parsed.followUpTask) {
        await db.task.create({
          data: {
            tenantId: ctx.tenantId,
            title: parsed.followUpTask,
            description: `AI-recommended follow-up for overdue lead ${lead.firstName} ${lead.lastName ?? ''} (${lead.daysOverdue} days overdue)`,
            status: 'TODO',
            priority: parsed.urgency === 'HIGH' ? 'URGENT' : 'HIGH',
            entityType: 'LEAD',
            entityId: lead.id,
            ownerId: ctx.userId,
          },
        });
      }
    }

    return { success: true, data: parsed, aiUsed: true, dryRun };
  } catch (err) {
    const durationMs = Date.now() - start;
    await logAIUsage(ctx.tenantId, ctx.userId, 'WORKFLOW_OVERDUE_LEAD', durationMs, false, undefined, String(err));
    return { success: false, data: null, aiUsed: true, dryRun, error: 'AI_PROCESSING_ERROR' };
  }
}

// ============================================
// 3. CUSTOMER CALL — AI Summarization
// ============================================

interface CallSummary {
  summary: string;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  nextAction: string | null;
  followUpTask: string | null;
}

interface CallData {
  id: string;
  direction?: string | null;
  duration?: number | null;
  callStatus?: string | null;
  notes?: string | null;
  transcript?: string | null;
}

/**
 * AI summarizes a completed call.
 * Creates follow-up task if nextAction exists (unless dryRun).
 */
export async function summarizeCall(
  ctx: WorkflowContext,
  call: CallData,
  dryRun = false,
): Promise<AIWorkflowResult<CallSummary>> {
  const check = await preflightCheck(ctx);
  if (check) {
    return { success: false, data: null, aiUsed: false, dryRun, error: check };
  }

  const start = Date.now();

  try {
    const callContent = call.transcript ?? call.notes ?? 'No transcript or notes available';

    const prompt = `You are a call analysis AI. Summarize this completed customer call and provide insights.

Call details:
- Direction: ${call.direction ?? 'N/A'}
- Duration: ${call.duration ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : 'N/A'}
- Status: ${call.callStatus ?? 'N/A'}
- Content/Transcript: ${callContent}

Respond with JSON:
{
  "summary": <2-3 sentence summary of the call>,
  "sentiment": <"POSITIVE" | "NEUTRAL" | "NEGATIVE">,
  "nextAction": <null or a brief description of the recommended next action>,
  "followUpTask": <null or a brief task title if follow-up is needed>
}`;

    const response = await callAI(prompt, ctx.tenantId);
    if (!response) {
      return { success: false, data: null, aiUsed: false, dryRun, error: 'AI_NOT_CONFIGURED' };
    }

    const durationMs = Date.now() - start;
    await logAIUsage(ctx.tenantId, ctx.userId, 'WORKFLOW_SUMMARIZE_CALL', durationMs, true, response);

    const parsed = parseAIJson<CallSummary>(response.content);
    if (!parsed || !parsed.summary) {
      return { success: false, data: null, aiUsed: true, dryRun, error: 'AI_RESPONSE_PARSE_ERROR' };
    }

    // Validate sentiment
    const validSentiments = ['POSITIVE', 'NEUTRAL', 'NEGATIVE'] as const;
    if (!validSentiments.includes(parsed.sentiment as any)) {
      parsed.sentiment = 'NEUTRAL';
    }

    if (!dryRun && parsed.nextAction && parsed.followUpTask) {
      await db.task.create({
        data: {
          tenantId: ctx.tenantId,
          title: parsed.followUpTask,
          description: `AI-recommended follow-up after call: ${parsed.nextAction}`,
          status: 'TODO',
          priority: parsed.sentiment === 'NEGATIVE' ? 'HIGH' : 'MEDIUM',
          entityType: 'CALL',
          entityId: call.id,
          ownerId: ctx.userId,
        },
      });
    }

    return { success: true, data: parsed, aiUsed: true, dryRun };
  } catch (err) {
    const durationMs = Date.now() - start;
    await logAIUsage(ctx.tenantId, ctx.userId, 'WORKFLOW_SUMMARIZE_CALL', durationMs, false, undefined, String(err));
    return { success: false, data: null, aiUsed: true, dryRun, error: 'AI_PROCESSING_ERROR' };
  }
}

// ============================================
// 4. FIELD VISIT — AI Analysis
// ============================================

interface FieldVisitAnalysis {
  summary: string;
  opportunity: string | null;
  nextAction: string | null;
}

interface FieldVisitData {
  id: string;
  purpose?: string | null;
  outcome?: string | null;
  notes?: string | null;
  status: string;
}

/**
 * AI analyzes a completed field visit.
 * Creates task for opportunity if detected (unless dryRun).
 */
export async function analyzeFieldVisit(
  ctx: WorkflowContext,
  visit: FieldVisitData,
  dryRun = false,
): Promise<AIWorkflowResult<FieldVisitAnalysis>> {
  const check = await preflightCheck(ctx);
  if (check) {
    return { success: false, data: null, aiUsed: false, dryRun, error: check };
  }

  const start = Date.now();

  try {
    const prompt = `You are a field visit analysis AI. Analyze this completed field visit.

Visit details:
- Purpose: ${visit.purpose ?? 'N/A'}
- Outcome: ${visit.outcome ?? 'N/A'}
- Notes: ${visit.notes ?? 'N/A'}
- Status: ${visit.status}

Respond with JSON:
{
  "summary": <2-3 sentence summary of the visit>,
  "opportunity": <null or a brief description of any sales/business opportunity identified>,
  "nextAction": <null or a brief description of the recommended next action>
}`;

    const response = await callAI(prompt, ctx.tenantId);
    if (!response) {
      return { success: false, data: null, aiUsed: false, dryRun, error: 'AI_NOT_CONFIGURED' };
    }

    const durationMs = Date.now() - start;
    await logAIUsage(ctx.tenantId, ctx.userId, 'WORKFLOW_FIELD_VISIT', durationMs, true, response);

    const parsed = parseAIJson<FieldVisitAnalysis>(response.content);
    if (!parsed || !parsed.summary) {
      return { success: false, data: null, aiUsed: true, dryRun, error: 'AI_RESPONSE_PARSE_ERROR' };
    }

    if (!dryRun && parsed.opportunity) {
      await db.task.create({
        data: {
          tenantId: ctx.tenantId,
          title: `Opportunity: ${parsed.opportunity.slice(0, 100)}`,
          description: `AI-detected opportunity from field visit: ${parsed.nextAction ?? 'Follow up on visit'}`,
          status: 'TODO',
          priority: 'HIGH',
          entityType: 'FIELD_VISIT',
          entityId: visit.id,
          ownerId: ctx.userId,
        },
      });
    }

    return { success: true, data: parsed, aiUsed: true, dryRun };
  } catch (err) {
    const durationMs = Date.now() - start;
    await logAIUsage(ctx.tenantId, ctx.userId, 'WORKFLOW_FIELD_VISIT', durationMs, false, undefined, String(err));
    return { success: false, data: null, aiUsed: true, dryRun, error: 'AI_PROCESSING_ERROR' };
  }
}

// ============================================
// 5. DEAL — AI Risk Analysis
// ============================================

interface DealRiskAnalysis {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factors: string[];
  recommendedNextAction: string;
}

interface DealData {
  id: string;
  title: string;
  value: number;
  stage: string;
  probability?: number | null;
  expectedCloseDate?: string | null;
  daysInStage?: number;
}

/**
 * AI risk analysis for a deal.
 * Read-only analysis — no side effects even without dryRun.
 */
export async function analyzeDealRisk(
  ctx: WorkflowContext,
  deal: DealData,
  dryRun = false,
): Promise<AIWorkflowResult<DealRiskAnalysis>> {
  const check = await preflightCheck(ctx);
  if (check) {
    return { success: false, data: null, aiUsed: false, dryRun, error: check };
  }

  const start = Date.now();

  try {
    const prompt = `You are a deal risk analysis AI. Assess the risk level of this deal.

Deal details:
- Title: ${deal.title}
- Value: ${deal.value}
- Stage: ${deal.stage}
- Probability: ${deal.probability ?? 'N/A'}%
- Expected Close Date: ${deal.expectedCloseDate ?? 'N/A'}
- Days in current stage: ${deal.daysInStage ?? 'N/A'}

Respond with JSON:
{
  "riskLevel": <"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">,
  "factors": [<array of risk factor descriptions>],
  "recommendedNextAction": <brief description of what should be done next>
}

Consider: stalled deals, low probability with high value, overdue close dates, unusual stage duration.`;

    const response = await callAI(prompt, ctx.tenantId);
    if (!response) {
      return { success: false, data: null, aiUsed: false, dryRun, error: 'AI_NOT_CONFIGURED' };
    }

    const durationMs = Date.now() - start;
    await logAIUsage(ctx.tenantId, ctx.userId, 'WORKFLOW_DEAL_RISK', durationMs, true, response);

    const parsed = parseAIJson<DealRiskAnalysis>(response.content);
    if (!parsed || !parsed.riskLevel) {
      return { success: false, data: null, aiUsed: true, dryRun, error: 'AI_RESPONSE_PARSE_ERROR' };
    }

    // Validate risk level
    const validLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
    if (!validLevels.includes(parsed.riskLevel as any)) {
      parsed.riskLevel = 'MEDIUM';
    }
    if (!Array.isArray(parsed.factors)) {
      parsed.factors = [];
    }

    return { success: true, data: parsed, aiUsed: true, dryRun };
  } catch (err) {
    const durationMs = Date.now() - start;
    await logAIUsage(ctx.tenantId, ctx.userId, 'WORKFLOW_DEAL_RISK', durationMs, false, undefined, String(err));
    return { success: false, data: null, aiUsed: true, dryRun, error: 'AI_PROCESSING_ERROR' };
  }
}

// ============================================
// 6. INVENTORY — AI Stock Analysis
// ============================================

interface StockAnalysis {
  demandForecast: string;
  reorderRecommendation: boolean;
  suggestedQuantity: number | null;
}

interface ProductData {
  id: string;
  name: string;
  currentStock: number;
  reorderPoint: number;
  unit?: string | null;
  category?: string | null;
  averageWeeklyDemand?: number | null;
}

/**
 * AI analyzes low stock levels.
 * Read-only analysis — returns recommendations without making changes.
 */
export async function analyzeStockLevel(
  ctx: WorkflowContext,
  product: ProductData,
  dryRun = false,
): Promise<AIWorkflowResult<StockAnalysis>> {
  const check = await preflightCheck(ctx);
  if (check) {
    return { success: false, data: null, aiUsed: false, dryRun, error: check };
  }

  const start = Date.now();

  try {
    const prompt = `You are an inventory management AI. Analyze this product's stock level and provide recommendations.

Product details:
- Name: ${product.name}
- Current Stock: ${product.currentStock} ${product.unit ?? 'units'}
- Reorder Point: ${product.reorderPoint} ${product.unit ?? 'units'}
- Category: ${product.category ?? 'N/A'}
- Average Weekly Demand: ${product.averageWeeklyDemand ?? 'N/A'}

Stock is below reorder point: ${product.currentStock <= product.reorderPoint ? 'YES' : 'NO'}

Respond with JSON:
{
  "demandForecast": <brief forecast of expected demand over next 2-4 weeks>,
  "reorderRecommendation": <true if reorder is recommended, false otherwise>,
  "suggestedQuantity": <null or suggested reorder quantity>
}`;

    const response = await callAI(prompt, ctx.tenantId);
    if (!response) {
      return { success: false, data: null, aiUsed: false, dryRun, error: 'AI_NOT_CONFIGURED' };
    }

    const durationMs = Date.now() - start;
    await logAIUsage(ctx.tenantId, ctx.userId, 'WORKFLOW_STOCK_ANALYSIS', durationMs, true, response);

    const parsed = parseAIJson<StockAnalysis>(response.content);
    if (!parsed || !parsed.demandForecast) {
      return { success: false, data: null, aiUsed: true, dryRun, error: 'AI_RESPONSE_PARSE_ERROR' };
    }

    return { success: true, data: parsed, aiUsed: true, dryRun };
  } catch (err) {
    const durationMs = Date.now() - start;
    await logAIUsage(ctx.tenantId, ctx.userId, 'WORKFLOW_STOCK_ANALYSIS', durationMs, false, undefined, String(err));
    return { success: false, data: null, aiUsed: true, dryRun, error: 'AI_PROCESSING_ERROR' };
  }
}

// ============================================
// 7. ACCOUNTING — AI Overdue Invoice Analysis
// ============================================

interface InvoiceRiskAnalysis {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendedAction: string;
  reminderTemplate: string | null;
}

interface InvoiceData {
  id: string;
  amount: number;
  currency: string;
  status: string;
  dueDate?: string | null;
  daysOverdue?: number;
  description?: string | null;
}

/**
 * AI detects invoice risk and provides collection recommendations.
 * Read-only analysis — returns recommendations without making changes.
 */
export async function analyzeOverdueInvoice(
  ctx: WorkflowContext,
  invoice: InvoiceData,
  dryRun = false,
): Promise<AIWorkflowResult<InvoiceRiskAnalysis>> {
  const check = await preflightCheck(ctx);
  if (check) {
    return { success: false, data: null, aiUsed: false, dryRun, error: check };
  }

  const start = Date.now();

  try {
    const prompt = `You are an accounts receivable AI. Analyze this overdue invoice and provide collection recommendations.

Invoice details:
- Amount: ${invoice.currency} ${invoice.amount.toLocaleString()}
- Status: ${invoice.status}
- Due Date: ${invoice.dueDate ?? 'N/A'}
- Days Overdue: ${invoice.daysOverdue ?? 'N/A'}
- Description: ${invoice.description ?? 'N/A'}

Respond with JSON:
{
  "riskLevel": <"LOW" | "MEDIUM" | "HIGH">,
  "recommendedAction": <brief description of the recommended collection action>,
  "reminderTemplate": <null or a short reminder message template for the customer>
}

Higher amount and longer overdue = higher risk. Be professional in reminder templates.`;

    const response = await callAI(prompt, ctx.tenantId);
    if (!response) {
      return { success: false, data: null, aiUsed: false, dryRun, error: 'AI_NOT_CONFIGURED' };
    }

    const durationMs = Date.now() - start;
    await logAIUsage(ctx.tenantId, ctx.userId, 'WORKFLOW_INVOICE_RISK', durationMs, true, response);

    const parsed = parseAIJson<InvoiceRiskAnalysis>(response.content);
    if (!parsed || !parsed.riskLevel) {
      return { success: false, data: null, aiUsed: true, dryRun, error: 'AI_RESPONSE_PARSE_ERROR' };
    }

    // Validate risk level
    const validLevels = ['LOW', 'MEDIUM', 'HIGH'] as const;
    if (!validLevels.includes(parsed.riskLevel as any)) {
      parsed.riskLevel = 'MEDIUM';
    }

    return { success: true, data: parsed, aiUsed: true, dryRun };
  } catch (err) {
    const durationMs = Date.now() - start;
    await logAIUsage(ctx.tenantId, ctx.userId, 'WORKFLOW_INVOICE_RISK', durationMs, false, undefined, String(err));
    return { success: false, data: null, aiUsed: true, dryRun, error: 'AI_PROCESSING_ERROR' };
  }
}

// ============================================
// 8. HRMS — AI Attendance Anomaly Detection
// ============================================

interface AttendanceAnomalyAnalysis {
  anomaly: string | null;
  recommendation: string;
}

interface AttendanceData {
  employeeId: string;
  employeeName: string;
  date: string;
  status: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  workingMinutes?: number | null;
  lateMinutes?: number | null;
  earlyExitMinutes?: number | null;
  overtimeMinutes?: number | null;
}

/**
 * AI detects attendance anomalies.
 * Read-only analysis — returns recommendations without making changes.
 */
export async function analyzeAttendanceAnomaly(
  ctx: WorkflowContext,
  employee: { id: string; name: string },
  attendanceData: AttendanceData[],
  dryRun = false,
): Promise<AIWorkflowResult<AttendanceAnomalyAnalysis>> {
  const check = await preflightCheck(ctx);
  if (check) {
    return { success: false, data: null, aiUsed: false, dryRun, error: check };
  }

  const start = Date.now();

  try {
    const recentAttendance = attendanceData.slice(0, 14).map((a) => ({
      date: a.date,
      status: a.status,
      workingMinutes: a.workingMinutes,
      lateMinutes: a.lateMinutes,
      earlyExitMinutes: a.earlyExitMinutes,
    }));

    const prompt = `You are an HR attendance analysis AI. Analyze this employee's recent attendance for anomalies.

Employee: ${employee.name}
Recent attendance (last ${recentAttendance.length} days):
${JSON.stringify(recentAttendance, null, 2)}

Respond with JSON:
{
  "anomaly": <null if no anomaly detected, or a brief description of the detected anomaly>,
  "recommendation": <brief recommendation for HR if anomaly is detected, or "No action needed" if normal>
}

Look for: frequent lateness, absenteeism patterns, unusual working hours, early exits.`;

    const response = await callAI(prompt, ctx.tenantId);
    if (!response) {
      return { success: false, data: null, aiUsed: false, dryRun, error: 'AI_NOT_CONFIGURED' };
    }

    const durationMs = Date.now() - start;
    await logAIUsage(ctx.tenantId, ctx.userId, 'WORKFLOW_ATTENDANCE_ANOMALY', durationMs, true, response);

    const parsed = parseAIJson<AttendanceAnomalyAnalysis>(response.content);
    if (!parsed || !parsed.recommendation) {
      return { success: false, data: null, aiUsed: true, dryRun, error: 'AI_RESPONSE_PARSE_ERROR' };
    }

    return { success: true, data: parsed, aiUsed: true, dryRun };
  } catch (err) {
    const durationMs = Date.now() - start;
    await logAIUsage(ctx.tenantId, ctx.userId, 'WORKFLOW_ATTENDANCE_ANOMALY', durationMs, false, undefined, String(err));
    return { success: false, data: null, aiUsed: true, dryRun, error: 'AI_PROCESSING_ERROR' };
  }
}

// ============================================
// 9. MARKETING — AI Campaign Performance Analysis
// ============================================

interface CampaignPerformanceAnalysis {
  insights: string[];
  recommendation: string;
  nextCampaignSuggestion: string | null;
}

interface CampaignData {
  id: string;
  name: string;
  channel: string;
  status: string;
  metrics: {
    sent?: number;
    delivered?: number;
    opened?: number;
    clicked?: number;
    converted?: number;
    bounced?: number;
  };
  budget?: number | null;
}

/**
 * AI insight on marketing campaign performance.
 * Read-only analysis — returns recommendations without making changes.
 */
export async function analyzeCampaignPerformance(
  ctx: WorkflowContext,
  campaign: CampaignData,
  dryRun = false,
): Promise<AIWorkflowResult<CampaignPerformanceAnalysis>> {
  const check = await preflightCheck(ctx);
  if (check) {
    return { success: false, data: null, aiUsed: false, dryRun, error: check };
  }

  const start = Date.now();

  try {
    const { metrics } = campaign;
    const deliveryRate = metrics.sent ? ((metrics.delivered ?? 0) / metrics.sent * 100).toFixed(1) : 'N/A';
    const openRate = metrics.delivered ? ((metrics.opened ?? 0) / metrics.delivered * 100).toFixed(1) : 'N/A';
    const clickRate = metrics.opened ? ((metrics.clicked ?? 0) / metrics.opened * 100).toFixed(1) : 'N/A';
    const conversionRate = metrics.clicked ? ((metrics.converted ?? 0) / metrics.clicked * 100).toFixed(1) : 'N/A';

    const prompt = `You are a marketing campaign analysis AI. Analyze this campaign's performance.

Campaign details:
- Name: ${campaign.name}
- Channel: ${campaign.channel}
- Status: ${campaign.status}
- Budget: ${campaign.budget ? `$${campaign.budget.toLocaleString()}` : 'N/A'}

Metrics:
- Sent: ${metrics.sent ?? 'N/A'}
- Delivered: ${metrics.delivered ?? 'N/A'} (${deliveryRate}% delivery rate)
- Opened: ${metrics.opened ?? 'N/A'} (${openRate}% open rate)
- Clicked: ${metrics.clicked ?? 'N/A'} (${clickRate}% click-through rate)
- Converted: ${metrics.converted ?? 'N/A'} (${conversionRate}% conversion rate)
- Bounced: ${metrics.bounced ?? 'N/A'}

Respond with JSON:
{
  "insights": [<array of 2-4 key insights about the campaign performance>],
  "recommendation": <brief overall recommendation>,
  "nextCampaignSuggestion": <null or a suggestion for the next campaign based on learnings>
}`;

    const response = await callAI(prompt, ctx.tenantId);
    if (!response) {
      return { success: false, data: null, aiUsed: false, dryRun, error: 'AI_NOT_CONFIGURED' };
    }

    const durationMs = Date.now() - start;
    await logAIUsage(ctx.tenantId, ctx.userId, 'WORKFLOW_CAMPAIGN_ANALYSIS', durationMs, true, response);

    const parsed = parseAIJson<CampaignPerformanceAnalysis>(response.content);
    if (!parsed || !parsed.recommendation) {
      return { success: false, data: null, aiUsed: true, dryRun, error: 'AI_RESPONSE_PARSE_ERROR' };
    }

    if (!Array.isArray(parsed.insights)) {
      parsed.insights = [parsed.recommendation];
    }

    return { success: true, data: parsed, aiUsed: true, dryRun };
  } catch (err) {
    const durationMs = Date.now() - start;
    await logAIUsage(ctx.tenantId, ctx.userId, 'WORKFLOW_CAMPAIGN_ANALYSIS', durationMs, false, undefined, String(err));
    return { success: false, data: null, aiUsed: true, dryRun, error: 'AI_PROCESSING_ERROR' };
  }
}
