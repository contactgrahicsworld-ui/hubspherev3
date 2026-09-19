import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthenticationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);
    if (!payload.tenantId) throw new AuthenticationError('Tenant context required');
    await requirePermission(payload.roleCode ?? null, 'accounting.view', payload.tenantId, payload.isSuperAdmin);

    const tenantId = payload.tenantId;

    // Get all accounts grouped by type for balance sheet
    const [assetAccounts, liabilityAccounts, equityAccounts, revenueAccounts, expenseAccounts, draftEntries, postedEntries, recentEntries] = await Promise.all([
      db.account.findMany({ where: { tenantId, type: 'ASSET', isActive: true }, select: { id: true, code: true, name: true, balance: true } }),
      db.account.findMany({ where: { tenantId, type: 'LIABILITY', isActive: true }, select: { id: true, code: true, name: true, balance: true } }),
      db.account.findMany({ where: { tenantId, type: 'EQUITY', isActive: true }, select: { id: true, code: true, name: true, balance: true } }),
      db.account.findMany({ where: { tenantId, type: 'REVENUE', isActive: true }, select: { id: true, code: true, name: true, balance: true } }),
      db.account.findMany({ where: { tenantId, type: 'EXPENSE', isActive: true }, select: { id: true, code: true, name: true, balance: true } }),
      db.journalEntry.count({ where: { tenantId, status: 'DRAFT' } }),
      db.journalEntry.count({ where: { tenantId, status: 'POSTED' } }),
      db.journalEntry.findMany({
        where: { tenantId }, take: 5, orderBy: { createdAt: 'desc' },
        include: { lines: { include: { account: { select: { code: true, name: true } } } } },
      }),
    ]);

    const totalAssets = assetAccounts.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = liabilityAccounts.reduce((sum, a) => sum + a.balance, 0);
    const totalEquity = equityAccounts.reduce((sum, a) => sum + a.balance, 0);
    const totalRevenue = revenueAccounts.reduce((sum, a) => sum + a.balance, 0);
    const totalExpenses = expenseAccounts.reduce((sum, a) => sum + a.balance, 0);
    const netIncome = totalRevenue - totalExpenses;

    return NextResponse.json(success({
      balanceSheet: {
        assets: { accounts: assetAccounts, total: totalAssets },
        liabilities: { accounts: liabilityAccounts, total: totalLiabilities },
        equity: { accounts: equityAccounts, total: totalEquity },
      },
      profitAndLoss: {
        revenue: { accounts: revenueAccounts, total: totalRevenue },
        expenses: { accounts: expenseAccounts, total: totalExpenses },
        netIncome,
      },
      journalEntries: { draft: draftEntries, posted: postedEntries },
      recentEntries,
    }));
  } catch (err) {
    if (err instanceof Error && (err.message?.includes('connect') || err.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(err); return NextResponse.json(body, { status: statusCode });
  }
}
