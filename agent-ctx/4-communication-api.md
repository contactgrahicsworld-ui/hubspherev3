# Task 4: Communication Hub API Routes

## Agent: Communication API Agent

## Work Log

### Schema Changes
- Added `Notification` model to `prisma/schema.prisma` with fields: id, tenantId, recipientId, title, body, type, category, link, isRead, readAt, metadata, timestamps
- Added `notifications` relation to `Tenant` model
- Added `notifications` relation to `User` model ("NotificationRecipient")
- Generated Prisma client successfully

### API Routes Created (11 files)

1. **`conversations/route.ts`** — GET (paginated list with search, channel/status/assignedTo filters, unreadCount option) + POST (create with channel validation, assignee check, audit log)
2. **`conversations/[id]/route.ts`** — GET (single with paginated messages) + PATCH (update assignee/status/subject/participantIds) + DELETE (archive)
3. **`conversations/[id]/messages/route.ts`** — GET (paginated, optional internalOnly filter) + POST (send with direction INBOUND/OUTBOUND/SYSTEM, auto-sets senderId, updates conversation lastMessage)
4. **`conversations/[id]/read/route.ts`** — POST (resets unreadCount, marks INBOUND messages as READ)
5. **`notifications/route.ts`** — GET (user's own notifications, unread filter, unreadCount option) + POST (create with recipient validation) + PATCH (mark single or all as read)
6. **`notifications/[id]/route.ts`** — DELETE (soft - only owner can delete, scoping by recipientId=userId)
7. **`templates/route.ts`** — GET (paginated with channel/category/status filters) + POST (create with {{variable}} extraction)
8. **`templates/[id]/route.ts`** — GET + PATCH (re-extracts variables on body change) + DELETE (archive)
9. **`providers/route.ts`** — GET (masked config) + POST (create with uniqueness check) + PATCH (update by channel+provider identifier)
10. **`providers/[id]/route.ts`** — GET (masked config) + DELETE
11. **`dashboard/route.ts`** — GET (parallel queries: conversation counts, messages by channel, provider status, template stats, recent activity)

### Key Patterns Followed
- Auth + RBAC on every route with correct permission codes
- Tenant-scoped queries throughout
- DB error handling (connect/ECONNREFUSED → 503)
- Zod validation for all inputs
- Audit logging for create/update/delete operations
- Prisma selects to control returned fields
- Provider config secrets masked in all GET responses
- Template variable extraction from `{{variable}}` patterns
- Lint passes cleanly
