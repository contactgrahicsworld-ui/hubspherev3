#!/usr/bin/env python3
"""
HubSphere V3 — Complete User Instruction Guide (PDF)
Professional ReportLab PDF generation with Hindi + English content.
"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, inch
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, ListFlowable, ListItem, KeepTogether
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Register fonts
try:
    pdfmetrics.registerFont(TTFont('NotoSansSC', '/usr/share/fonts/truetype/chinese/NotoSansSC-Regular.ttf'))
    pdfmetrics.registerFont(TTFont('NotoSansSC-Bold', '/usr/share/fonts/truetype/chinese/NotoSansSC-Bold.ttf'))
    CJK_FONT = 'NotoSansSC'
    CJK_FONT_BOLD = 'NotoSansSC-Bold'
except:
    CJK_FONT = 'Helvetica'
    CJK_FONT_BOLD = 'Helvetica-Bold'

# Colors
PRIMARY = HexColor('#0F172A')
ACCENT = HexColor('#3B82F6')
ACCENT_LIGHT = HexColor('#EFF6FF')
SUCCESS = HexColor('#10B981')
DARK_BG = HexColor('#1E293B')
GRAY = HexColor('#64748B')
LIGHT_GRAY = HexColor('#F1F5F9')
BORDER = HexColor('#E2E8F0')

# Output path
OUTPUT_DIR = '/home/z/my-project/download'
os.makedirs(OUTPUT_DIR, exist_ok=True)
OUTPUT_PATH = os.path.join(OUTPUT_DIR, 'HubSphere-V3-User-Guide.pdf')

# Page setup
doc = SimpleDocTemplate(
    OUTPUT_PATH,
    pagesize=A4,
    leftMargin=25*mm,
    rightMargin=25*mm,
    topMargin=20*mm,
    bottomMargin=20*mm,
    title='HubSphere V3 - Complete User Guide',
    author='Z.ai',
    subject='HubSphere V3 Application Instruction Guide'
)

# Styles
styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    'CustomTitle', parent=styles['Title'],
    fontName=CJK_FONT_BOLD, fontSize=28, leading=34,
    textColor=PRIMARY, alignment=TA_CENTER, spaceAfter=6
)

subtitle_style = ParagraphStyle(
    'CustomSubtitle', parent=styles['Normal'],
    fontName=CJK_FONT, fontSize=14, leading=18,
    textColor=GRAY, alignment=TA_CENTER, spaceAfter=30
)

h1_style = ParagraphStyle(
    'H1', parent=styles['Heading1'],
    fontName=CJK_FONT_BOLD, fontSize=20, leading=26,
    textColor=PRIMARY, spaceBefore=20, spaceAfter=12,
    borderWidth=0, borderPadding=0
)

h2_style = ParagraphStyle(
    'H2', parent=styles['Heading2'],
    fontName=CJK_FONT_BOLD, fontSize=15, leading=20,
    textColor=ACCENT, spaceBefore=14, spaceAfter=8
)

h3_style = ParagraphStyle(
    'H3', parent=styles['Heading3'],
    fontName=CJK_FONT_BOLD, fontSize=12, leading=16,
    textColor=PRIMARY, spaceBefore=10, spaceAfter=6
)

body_style = ParagraphStyle(
    'Body', parent=styles['Normal'],
    fontName=CJK_FONT, fontSize=10, leading=15,
    textColor=black, alignment=TA_JUSTIFY, spaceAfter=8
)

bullet_style = ParagraphStyle(
    'Bullet', parent=body_style,
    leftIndent=20, bulletIndent=8,
    spaceAfter=4
)

link_style = ParagraphStyle(
    'Link', parent=body_style,
    textColor=ACCENT, fontName=CJK_FONT_BOLD
)

toc_style = ParagraphStyle(
    'TOC', parent=body_style,
    fontSize=12, leading=20, leftIndent=20,
    fontName=CJK_FONT
)

# Helpers
def heading1(text):
    return Paragraph(text, h1_style)

def heading2(text):
    return Paragraph(text, h2_style)

def heading3(text):
    return Paragraph(text, h3_style)

def body(text):
    return Paragraph(text, body_style)

def bullet(text):
    return Paragraph(f'<bullet>&bull;</bullet> {text}', bullet_style)

def spacer(h=8):
    return Spacer(1, h*mm)

def section_divider():
    t = Table([['']], colWidths=[160*mm], rowHeights=[1])
    t.setStyle(TableStyle([
        ('LINEABOVE', (0,0), (-1,0), 1, BORDER),
    ]))
    return t

# Build document content
story = []

# ========== COVER PAGE ==========
story.append(Spacer(1, 60*mm))

# Title
story.append(Paragraph('HubSphere V3', ParagraphStyle(
    'CoverTitle', fontName=CJK_FONT_BOLD, fontSize=36, leading=44,
    textColor=PRIMARY, alignment=TA_CENTER
)))
story.append(Spacer(1, 5*mm))
story.append(Paragraph('Complete User Instruction Guide', ParagraphStyle(
    'CoverSub', fontName=CJK_FONT, fontSize=18, leading=24,
    textColor=ACCENT, alignment=TA_CENTER
)))
story.append(Spacer(1, 8*mm))
story.append(Paragraph('CRM | HRMS | Communication | Automation | AI | Analytics', ParagraphStyle(
    'CoverTag', fontName=CJK_FONT, fontSize=11, leading=14,
    textColor=GRAY, alignment=TA_CENTER
)))
story.append(Spacer(1, 30*mm))

# Info box on cover
cover_info = [
    ['Application URL', 'https://hubspherev3.vercel.app'],
    ['Version', 'V3 (Production)'],
    ['Technology', 'Next.js 16 + Prisma + PostgreSQL'],
    ['Authentication', 'JWT + Refresh Token Rotation + 2FA'],
    ['Access Control', 'RBAC with 13 Roles, 394 Permissions'],
]
cover_table = Table(cover_info, colWidths=[50*mm, 110*mm])
cover_table.setStyle(TableStyle([
    ('FONTNAME', (0,0), (0,-1), CJK_FONT_BOLD),
    ('FONTNAME', (1,0), (1,-1), CJK_FONT),
    ('FONTSIZE', (0,0), (-1,-1), 10),
    ('TEXTCOLOR', (0,0), (0,-1), GRAY),
    ('TEXTCOLOR', (1,0), (1,-1), black),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ('TOPPADDING', (0,0), (-1,-1), 6),
    ('LINEBELOW', (0,0), (-1,-2), 0.5, BORDER),
    ('ALIGN', (0,0), (-1,-1), 'LEFT'),
]))
story.append(cover_table)

story.append(PageBreak())

# ========== TABLE OF CONTENTS ==========
story.append(heading1('Table of Contents'))
story.append(spacer(5))

toc_items = [
    '1. Getting Started (Setup & Login)',
    '2. CRM - Customer Relationship Management',
    '3. HRMS - Human Resource Management',
    '4. Communication Hub',
    '5. Automation Engine',
    '6. AI Hub - Intelligent Agents',
    '7. Analytics & Reports',
    '8. Administration',
    '9. Super Admin (Platform Management)',
    '10. Security & Authentication',
    '11. User Roles & Permissions',
    '12. Keyboard Shortcuts & Tips',
]
for item in toc_items:
    story.append(Paragraph(item, toc_style))

story.append(PageBreak())

# ========== SECTION 1: GETTING STARTED ==========
story.append(heading1('1. Getting Started - Setup & Login'))
story.append(section_divider())
story.append(spacer(4))

story.append(heading2('1.1 First-Time Setup Wizard'))
story.append(body(
    'Jab aap pehli baar HubSphere V3 application ko open karte hain, tab aapko Setup Wizard dikhayi dega. '
    'Yeh wizard tabhi appear hota hai jab database mein koi user nahi hai. Iske through aap application ka '
    'first Super Admin account create karte hain. Setup page par aapko apna naam, email address, password, '
    'aur organization ka naam darna hota hai. Password kam se kam 8 characters ka hona chahiye, jismein '
    'ek uppercase letter, ek lowercase letter, aur ek number zaroori hai. Submit karne par aapka Super Admin '
    'account create ho jayega aur aap automatically login ho jayenge.'
))
story.append(bullet('<b>URL:</b> <font color="#3B82F6">/setup</font> — First-time setup wizard'))
story.append(bullet('<b>Fields:</b> Name, Email, Password, Confirm Password, Organization Name'))
story.append(bullet('<b>Post-Setup:</b> Auto-login with Super Admin privileges'))

story.append(heading2('1.2 Login'))
story.append(body(
    'Setup complete hone ke baad, aap login page se apne account mein sign in kar sakte hain. Login ke liye '
    'apna registered email aur password dalein. Agar 2FA (Two-Factor Authentication) enabled hai, toh login '
    'ke baad aapko OTP code bhi darna padega jo aapke authenticator app (jaise Google Authenticator) mein '
    'dikhayi dega. Login successful hone par access token 15 minutes ke liye valid hota hai, aur refresh token '
    '30 days ke liye valid rehta hai. Session expire hone- par automatically token refresh hota hai aur aapko '
    'dobara login nahi karna padta.'
))
story.append(bullet('<b>URL:</b> <font color="#3B82F6">/login</font> — Login page'))
story.append(bullet('<b>Rate Limit:</b> 10 login attempts per 15 minutes per IP'))
story.append(bullet('<b>2FA:</b> Agar enabled hai toh login ke baad OTP challenge aayega'))

story.append(heading2('1.3 Signup (Self-Registration)'))
story.append(body(
    'Naye users khud se account create kar sakte hain signup page par. Yeh feature tenant-based multi-tenancy '
    'support karta hai — naya user signup karta hai toh ek naya tenant (organization) bhi create hota hai. '
    'Signup ke liye naam, email, password, confirm password, aur organization name darna hota hai. Duplicate '
    'email address se signup nahi ho sakta. Password rules same hain jaise setup mein — minimum 8 characters, '
    'uppercase, lowercase, aur number zaroori hai.'
))
story.append(bullet('<b>URL:</b> <font color="#3B82F6">/signup</font> — Self-registration'))
story.append(bullet('<b>Post-Signup:</b> New user + new tenant automatically created'))

story.append(heading2('1.4 Password Management'))
story.append(body(
    'HubSphere V3 mein password management ke liye teen features hain. "Forgot Password" page par aap apna '
    'email daal kar password reset link bhejwa sakte hain. Yeh link email par aayega aur usse aap naya password '
    'set kar sakte hain. "Change Password" feature authenticated users ke liye hai — aap apna current password '
    'aur naya password daal kar password change kar sakte hain. Password change hone par saare refresh tokens '
    'revoke ho jayenge aur aapko dobara login karna padega, jo security ka best practice hai.'
))
story.append(bullet('<b>Forgot Password:</b> <font color="#3B82F6">/forgot-password</font> — Reset via email'))
story.append(bullet('<b>Reset Password:</b> <font color="#3B82F6">/reset-password</font> — Set new password with token'))
story.append(bullet('<b>Change Password:</b> API endpoint — requires current + new password'))

story.append(PageBreak())

# ========== SECTION 2: CRM ==========
story.append(heading1('2. CRM - Customer Relationship Management'))
story.append(section_divider())
story.append(spacer(4))

story.append(body(
    'CRM module HubSphere V3 ka sabse important feature hai. Yeh leads, contacts, companies, deals, tasks, '
    'follow-ups, calls, notes, aur tags ka complete management provide karta hai. CRM dashboard par aapko '
    'sabhi key metrics ka summary dikhayi deta hai — leads by status, deals by stage, recent activity, aur '
    'sales pipeline overview. Yeh module sales team ke liye designed hai jo daily basis par leads track karte '
    'hain, deals manage karte hain, aur customer relationships build karte hain.'
))

story.append(heading2('2.1 Leads Management'))
story.append(body(
    'Leads page par aap saare leads dekh sakte hain, naye leads create kar sakte hain, aur unka status manage '
    'kar sakte hain. Har lead ka first name, last name, email, mobile number, company name, source, status, '
    'aur priority hota hai. Leads ka pipeline yeh hai: NEW, CONTACTED, QUALIFIED, PROPOSAL, NEGOTIATION, WON, '
    'LOST. Jab ek lead "WON" ho jata hai, aap use "Convert to Contact" button se contact mein convert kar sakte '
    'hain. Lead detail page par saari information, activities, notes, aur timeline dikhayi deta hai.'
))
story.append(bullet('<b>URL:</b> <font color="#3B82F6">/crm/leads</font> — Leads list with filters & search'))
story.append(bullet('<b>Create:</b> "New Lead" button se form open hota hai'))
story.append(bullet('<b>Convert:</b> Lead detail page par "Convert to Contact" button'))

story.append(heading2('2.2 Contacts & Companies'))
story.append(body(
    'Contacts page par aap saare contact persons dekh sakte hain jo leads se convert hue hain ya directly '
    'create kiye gaye hain. Har contact ka naam, email, phone, title, aur linked company hota hai. Companies '
    'page par organization records hain jismein industry, website, address, aur contact persons ki information '
    'hoti hai. Contacts aur companies dono par notes, tags, aur activities add kar sakte hain. Detail pages '
    'par saari related information ek jagah dikhayi deti hai with activity timeline.'
))
story.append(bullet('<b>Contacts URL:</b> <font color="#3B82F6">/crm/contacts</font>'))
story.append(bullet('<b>Companies URL:</b> <font color="#3B82F6">/crm/companies</font>'))

story.append(heading2('2.3 Deals & Sales Pipeline'))
story.append(body(
    'Deals module aapka sales pipeline manage karta hai. Har deal ka title, value, currency, stage, probability, '
    'aur expected close date hota hai. Sales pipeline ke stages yeh hain: PROSPECTING, QUALIFICATION, PROPOSAL, '
    'NEGOTIATION, CLOSED_WON, CLOSED_LOST. Aap deals ko drag-and-drop se stages ke beech move kar sakte hain, '
    'ya API endpoint se stage update kar sakte hain. Har stage movement ka history record hota hai taaki aap '
    'track kar saken ki deal kab kis stage mein thi. Deals par notes aur activities bhi add kar sakte hain.'
))
story.append(bullet('<b>URL:</b> <font color="#3B82F6">/crm/deals</font> — Pipeline view with stage columns'))
story.append(bullet('<b>Stage Move:</b> PUT /api/v1/crm/deals/:id/stage with "toStage" field'))

story.append(heading2('2.4 Tasks, Follow-ups & Notes'))
story.append(body(
    'Tasks module aapke to-do items manage karta hai. Har task ka title, priority (HIGH/MEDIUM/LOW), status '
    '(TODO/IN_PROGRESS/COMPLETED), aur due date hota hai. Follow-ups scheduling ke liye hain — aap future mein '
    'kisi lead ya contact se follow-up karne ka schedule set kar sakte hain. Notes module aapko kisi bhi entity '
    '(lead, contact, company, deal) par notes add karne deta hai. Yeh notes activity timeline mein bhi dikhayi '
    'dete hain. Tags system aapko entities ko categorize karne deta hai custom labels ke saath.'
))
story.append(bullet('<b>Tasks:</b> <font color="#3B82F6">/crm/tasks</font> — Task list with status filters'))
story.append(bullet('<b>Follow-ups:</b> <font color="#3B82F6">/crm/follow-ups</font> — Scheduled follow-ups'))
story.append(bullet('<b>Notes:</b> Available on each entity detail page'))

story.append(heading2('2.5 Calls, Search, Import/Export'))
story.append(body(
    'Calls module telecalling team ke liye hai. Yeh call records, call details, aur call recordings manage '
    'karta hai. Outbound calls initiate karne ka feature bhi hai agar telephony provider configured hai. '
    'Global CRM search se aap leads, contacts, companies, aur deals mein se koi bhi record search kar sakte '
    'hain. Import feature se aap CSV file se bulk data import kar sakte hain, aur Export feature se CSV ya '
    'JSON format mein data download kar sakte hain. Timeline feature kisi bhi entity ka complete activity '
    'history dikhata hai — calls, emails, notes, stage changes, sab ek jagah.'
))
story.append(bullet('<b>Calls:</b> <font color="#3B82F6">/crm/calls</font> — Call history & recordings'))
story.append(bullet('<b>Telecaller:</b> <font color="#3B82F6">/crm/telecaller</font> — Telecaller dashboard'))
story.append(bullet('<b>Import:</b> <font color="#3B82F6">/crm/import</font> — CSV bulk import'))
story.append(bullet('<b>Export:</b> <font color="#3B82F6">/crm/export</font> — CSV/JSON export'))

story.append(PageBreak())

# ========== SECTION 3: HRMS ==========
story.append(heading1('3. HRMS - Human Resource Management'))
story.append(section_divider())
story.append(spacer(4))

story.append(body(
    'HRMS module employee management, attendance tracking, leave management, payroll processing, aur field sales '
    'tracking ka complete solution hai. Yeh module HR teams ke liye designed hai jo employee lifecycle manage '
    'karte hain — hiring se leke payroll tak. HR dashboard par key metrics dikhayi dete hain — total employees, '
    'attendance summary, pending leave requests, aur expense claims.'
))

story.append(heading2('3.1 Employees, Departments & Designations'))
story.append(body(
    'Employees page par aap saare employees ki directory dekh sakte hain. Har employee ka profile user account '
    'se linked hota hai, jismein employee ID, department, designation, manager, joining date, basic salary, '
    'aur employment status hota hai. Departments page par aap departments create aur manage kar sakte hain — '
    'jaise Engineering, Sales, HR, Finance. Designations page par job titles define kar sakte hain — jaise '
    'Software Engineer, Sales Manager, HR Executive. Departments aur designations dono hierarchial structure '
    'support karte hain taaki organization ka org chart properly represent ho sake.'
))
story.append(bullet('<b>Employees:</b> <font color="#3B82F6">/hrms/employees</font> — Employee directory'))
story.append(bullet('<b>Departments:</b> <font color="#3B82F6">/hrms/departments</font> — Department management'))
story.append(bullet('<b>Designations:</b> <font color="#3B82F6">/hrms/designations</font> — Job title management'))

story.append(heading2('3.2 Attendance & Leave Management'))
story.append(body(
    'Attendance module GPS-based check-in/check-out support karta hai. Employees apne mobile se check-in kar '
    'sakte hain aur unka GPS location record hota hai. Working hours, break time, aur overtime automatically '
    'calculate hote hain. Leave management mein leave types define kar sakte hain — Casual, Sick, Earned, etc. '
    'Leave requests submit kar sakte hain jinhein manager approve ya reject kar sakta hai. Leave balance '
    'automatically track hota hai aur carry-forward rules bhi configurable hain.'
))
story.append(bullet('<b>Attendance:</b> <font color="#3B82F6">/hrms/attendance</font> — GPS-based check-in/out'))
story.append(bullet('<b>Leave:</b> <font color="#3B82F6">/hrms/leave</font> — Leave requests & approvals'))

story.append(heading2('3.3 Field Sales, Expenses & Payroll'))
story.append(body(
    'Field Sales module field executives ke liye hai jo client visits par jaate hain. Field visit mein date, '
    'location, lead/contact reference, aur visit status track hota hai. GPS location bhi record hoti hai taaki '
    'verification ho sake. Expenses module mein employees expense claims submit kar sakte hain — travel, food, '
    'accommodation, etc. Manager inhe approve ya reject kar sakta hai. Payroll module mein salary processing '
    'hoti hai — basic salary, allowances (HRA, DA), deductions (PF, Tax), aur net salary calculation. Payroll '
    'records ke stages hain: DRAFT, PROCESSING, FINALIZED, PAID.'
))
story.append(bullet('<b>Field Sales:</b> <font color="#3B82F6">/hrms/field-sales</font> — Field visit tracking'))
story.append(bullet('<b>Expenses:</b> <font color="#3B82F6">/hrms/expenses</font> — Expense claims'))
story.append(bullet('<b>Payroll:</b> <font color="#3B82F6">/hrms/payroll</font> — Salary processing'))

story.append(PageBreak())

# ========== SECTION 4: COMMUNICATION ==========
story.append(heading1('4. Communication Hub'))
story.append(section_divider())
story.append(spacer(4))

story.append(body(
    'Communication Hub multi-channel messaging ka central point hai. Yeh WhatsApp, Email, SMS, aur In-App '
    'notifications support karta hai. Unified Inbox mein saare conversations ek jagah dikhayi dete hain chahe '
    'woh kis bhi channel se aaye hon. Message templates variable substitution support karte hain — aap ek '
    'template banate hain jismein {{firstName}} jaise placeholders hote hain, aur send karne par yeh '
    'automatically replace ho jate hain. Bulk messaging feature se aap ek saath kai recipients ko message '
    'bhej sakte hain — marketing campaigns ke liye useful. Provider settings page par aap communication '
    'providers configure kar sakte hain — Twilio, SendGrid, etc.'
))
story.append(bullet('<b>Dashboard:</b> <font color="#3B82F6">/communication</font> — Communication overview'))
story.append(bullet('<b>Inbox:</b> <font color="#3B82F6">/communication/inbox</font> — Unified multi-channel inbox'))
story.append(bullet('<b>Notifications:</b> <font color="#3B82F6">/communication/notifications</font> — In-app alerts'))
story.append(bullet('<b>Templates:</b> <font color="#3B82F6">/communication/templates</font> — Message templates'))
story.append(bullet('<b>Settings:</b> <font color="#3B82F6">/communication/settings</font> — Provider configuration'))

story.append(PageBreak())

# ========== SECTION 5: AUTOMATION ==========
story.append(heading1('5. Automation Engine'))
story.append(section_divider())
story.append(spacer(4))

story.append(body(
    'Automation Engine aapko workflow automation build karne deta hai — bina coding ke. Workflow ka structure '
    'yeh hai: Triggers + Conditions + Actions. Jab koi trigger event fire hota hai (jaise "new lead created" '
    'ya "deal won"), aur conditions match karti hain, toh actions automatically execute hote hain. '
    'Triggers 17 event types support karte hain — lead.created, deal.won, task.completed, leave.approved, '
    'etc. Actions 13 types ke hain — create_task, send_email, send_whatsapp, update_lead, webhook, ai_action, '
    'etc. Workflow lifecycle yeh hai: DRAFT, ACTIVE, PAUSED, ARCHIVED. Execution history mein har workflow run '
    'ka detail aur logs dikhayi dete hain, taaki debugging easy ho. Idempotency keys se duplicate executions '
    'prevent hote hain.'
))
story.append(bullet('<b>Dashboard:</b> <font color="#3B82F6">/automation</font> — Automation overview'))
story.append(bullet('<b>Workflows:</b> <font color="#3B82F6">/automation/workflows</font> — Workflow builder'))
story.append(bullet('<b>Executions:</b> <font color="#3B82F6">/automation/executions</font> — Run history & logs'))

story.append(PageBreak())

# ========== SECTION 6: AI HUB ==========
story.append(heading1('6. AI Hub - Intelligent Agents'))
story.append(section_divider())
story.append(spacer(4))

story.append(body(
    'AI Hub mein 5 specialized AI agents hain jo business operations mein help karte hain. Yeh agents real '
    'database data query karte hain aur meaningful insights dete hain — koi fake response nahi. AI Gateway '
    'priority-based provider routing use karta hai taaki best available AI provider se response aaye. Agar '
    'koi AI provider configured nahi hai, toh system gracefully error deta hai instead of fake data return '
    'karne ke. Usage tracking se tokens, costs, aur duration per agent/model track hota hai.'
))

# AI Agents table
ai_agents = [
    ['NOVA', 'Business Copilot', 'General CRM/HRMS/business questions answer karta hai'],
    ['VOX', 'Telecalling Intelligence', 'Call transcript analysis, sentiment, summary, follow-up suggestions'],
    ['SALESPRO', 'Sales Intelligence', 'Lead scoring (0-100), deal risk analysis, next-best-action, sales messages'],
    ['PEOPLEMIND', 'HR Intelligence', 'HR summaries, attendance analysis, leave trends, workforce planning'],
    ['INSIGHT', 'Analytics Intelligence', 'KPI explanation, trend detection, anomaly detection, cross-module insights'],
]
ai_table = Table(ai_agents, colWidths=[30*mm, 40*mm, 90*mm])
ai_table.setStyle(TableStyle([
    ('FONTNAME', (0,0), (-1,-1), CJK_FONT),
    ('FONTNAME', (0,0), (0,-1), CJK_FONT_BOLD),
    ('FONTSIZE', (0,0), (-1,-1), 9),
    ('TEXTCOLOR', (0,0), (0,-1), ACCENT),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ('TOPPADDING', (0,0), (-1,-1), 6),
    ('LINEBELOW', (0,0), (-1,-2), 0.5, BORDER),
    ('BACKGROUND', (0,0), (-1,0), ACCENT_LIGHT),
    ('FONTNAME', (0,0), (-1,0), CJK_FONT_BOLD),
]))
story.append(ai_table)
story.append(spacer(4))
story.append(bullet('<b>AI Hub:</b> <font color="#3B82F6">/ai</font> — Agents overview'))
story.append(bullet('<b>AI Chat:</b> <font color="#3B82F6">/ai/chat</font> — Interactive chat interface'))

story.append(PageBreak())

# ========== SECTION 7: ANALYTICS ==========
story.append(heading1('7. Analytics & Reports'))
story.append(section_divider())
story.append(spacer(4))

story.append(body(
    'Analytics module har functional area ka dedicated dashboard hai. Executive dashboard par high-level KPIs '
    'dikhayi dete hain — total revenue, active deals, conversion rates, employee count. CRM analytics mein '
    'pipeline analysis, lead conversion funnel, aur deal aging report hota hai. Telecaller analytics call '
    'volumes, outcomes, aur average call duration track karta hai. HR analytics headcount trends, attrition '
    'rates, aur leave patterns dikhata hai. Communication analytics channel usage aur deliverability metrics '
    'track karta hai. Automation analytics workflow success rates aur execution times dikhata hai. AI usage '
    'analytics tokens consumed aur costs per agent/model track karta hai.'
))

analytics_data = [
    ['Executive', '<font color="#3B82F6">/analytics/executive</font>', 'High-level KPIs, revenue, conversion rates'],
    ['CRM', '<font color="#3B82F6">/analytics/crm</font>', 'Pipeline analysis, lead funnel, deal aging'],
    ['Telecaller', '<font color="#3B82F6">/analytics/telecaller</font>', 'Call volumes, outcomes, durations'],
    ['HR', '<font color="#3B82F6">/analytics/hr</font>', 'Headcount, attrition, leave patterns'],
    ['Communication', '<font color="#3B82F6">/analytics/communication</font>', 'Channel usage, deliverability'],
    ['Automation', '<font color="#3B82F6">/analytics/automation</font>', 'Workflow runs, success rates'],
    ['AI Usage', '<font color="#3B82F6">/analytics/ai</font>', 'Tokens, costs, per agent/model'],
]
a_table = Table(analytics_data, colWidths=[30*mm, 50*mm, 80*mm])
a_table.setStyle(TableStyle([
    ('FONTNAME', (0,0), (-1,-1), CJK_FONT),
    ('FONTNAME', (0,0), (0,-1), CJK_FONT_BOLD),
    ('FONTSIZE', (0,0), (-1,-1), 9),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ('TOPPADDING', (0,0), (-1,-1), 5),
    ('LINEBELOW', (0,0), (-1,-2), 0.5, BORDER),
    ('BACKGROUND', (0,0), (-1,0), ACCENT_LIGHT),
    ('FONTNAME', (0,0), (-1,0), CJK_FONT_BOLD),
]))
story.append(a_table)

story.append(PageBreak())

# ========== SECTION 8: ADMIN ==========
story.append(heading1('8. Administration'))
story.append(section_divider())
story.append(spacer(4))

story.append(body(
    'Admin module tenant-level (organization-level) management hai. Yeh users, roles, memberships, settings, '
    'aur audit logs manage karta hai. Users page par aap tenant ke andar naye users create kar sakte hain, '
    'existing users ko edit kar sakte hain, aur users ko deactivate kar sakte hain. Roles page par custom '
    'roles define kar sakte hain aur permissions assign kar sakte hain. Memberships page par user-tenant '
    'relationships manage hoti hain — kaunsa user kis tenant mein kis role ke saath hai. Settings page par '
    'organization-level configuration hoti hai. Audit logs page par saare actions ka record dikhayi deta hai — '
    'kisne kya action kab kiya, with IP address aur user agent.'
))
story.append(bullet('<b>Dashboard:</b> <font color="#3B82F6">/admin</font> — Admin overview'))
story.append(bullet('<b>Users:</b> <font color="#3B82F6">/admin/users</font> — User CRUD within tenant'))
story.append(bullet('<b>Roles:</b> <font color="#3B82F6">/admin/roles</font> — Custom role & permission management'))
story.append(bullet('<b>Memberships:</b> <font color="#3B82F6">/admin/memberships</font> — User-tenant relationships'))
story.append(bullet('<b>Audit:</b> <font color="#3B82F6">/admin/audit</font> — Action audit trail'))
story.append(bullet('<b>Settings:</b> <font color="#3B82F6">/admin/settings</font> — Organization configuration'))

story.append(PageBreak())

# ========== SECTION 9: SUPER ADMIN ==========
story.append(heading1('9. Super Admin (Platform Management)'))
story.append(section_divider())
story.append(spacer(4))

story.append(body(
    'Super Admin module platform-level (cross-tenant) management hai. Yeh sirf SUPER_ADMIN role wale users '
    'ke liye accessible hai. Tenants page par aap saare organizations dekh sakte hain, naye tenants create '
    'kar sakte hain, aur existing tenants ko suspend kar sakte hain. Users page par platform-wide saare '
    'users dikhayi dete hain. Roles page par system roles aur saare tenant custom roles dikhayi dete hain. '
    'Audit logs platform-wide hain. Feature flags page par aap global feature toggles manage kar sakte hain — '
    'kisi feature ko selectively enable/disable kar sakte hain. System health page par database connection '
    'status, uptime, aur provider health checks dikhayi dete hain. Platform settings page par global '
    'configuration hoti hai.'
))
story.append(bullet('<b>Dashboard:</b> <font color="#3B82F6">/super-admin</font> — Platform overview'))
story.append(bullet('<b>Tenants:</b> <font color="#3B82F6">/super-admin/tenants</font> — Organization management'))
story.append(bullet('<b>Users:</b> <font color="#3B82F6">/super-admin/users</font> — Platform-wide user list'))
story.append(bullet('<b>Roles:</b> <font color="#3B82F6">/super-admin/roles</font> — All roles (system + custom)'))
story.append(bullet('<b>Audit:</b> <font color="#3B82F6">/super-admin/audit</font> — Platform-wide audit logs'))
story.append(bullet('<b>Features:</b> <font color="#3B82F6">/super-admin/features</font> — Feature flag management'))
story.append(bullet('<b>Health:</b> <font color="#3B82F6">/super-admin/health</font> — System health monitoring'))
story.append(bullet('<b>Settings:</b> <font color="#3B82F6">/super-admin/settings</font> — Platform configuration'))

story.append(PageBreak())

# ========== SECTION 10: SECURITY ==========
story.append(heading1('10. Security & Authentication'))
story.append(section_divider())
story.append(spacer(4))

story.append(heading2('10.1 JWT Authentication'))
story.append(body(
    'HubSphere V3 custom JWT (JSON Web Token) based authentication use karta hai — NextAuth ya koi third-party '
    'auth provider nahi. Access token 15 minutes ke liye valid hota hai aur refresh token 30 days ke liye. '
    'Password hashing PBKDF2-SHA256 algorithm se hoti hai jo OWASP (Open Web Application Security Project) '
    'ke minimum standards follow karti hai — 100,000 iterations, 32-byte salt, 256-bit output. Constant-time '
    'comparison use hota hai taaki timing attacks prevent hon. JWT payload mein userId, email, isSuperAdmin, '
    'tenantId, aur roleCode hote hain. Tokens localStorage mein bhi store hote hain aur httpOnly cookies mein bhi, '
    'taaki browser requests aur API calls dono support hon.'
))

story.append(heading2('10.2 Refresh Token Rotation'))
story.append(body(
    'Refresh token rotation ek security best practice hai jo token replay attacks prevent karta hai. Jab aap '
    'refresh token se naya access token request karte hain, toh purana refresh token immediately revoke ho '
    'jata hai aur naya refresh token issue hota hai. Yeh ek atomic database transaction mein hota hai — toh '
    'kabhi bhi aisa nahi hoga ki purana aur naya dono tokens ek saath valid hon. Agar koi attacker purana '
    'refresh token use karne ki koshish kare, toh system usko detect karega aur token reject ho jayega. Yeh '
    'mechanism OWASP recommendations follow karta hai aur production-grade security provide karta hai.'
))

story.append(heading2('10.3 Two-Factor Authentication (2FA)'))
story.append(body(
    'TOTP (Time-based One-Time Password) based 2FA support hai jo RFC 6238 standard follow karta hai. 2FA '
    'setup karne par aapko ek QR code milega jo aapke authenticator app (Google Authenticator, Authy, etc.) '
    'mein scan karna hai. Har login par aapko 6-digit OTP code darna padega. Recovery codes bhi generate '
    'hote hain — 10 single-use codes jo 2FA device lost hone par use kar sakte hain. 2FA mandatory hai '
    'SUPER_ADMIN, TENANT_OWNER, aur ADMIN roles ke liye. Disabling ke liye current 2FA code verify karna '
    'padta hai.'
))

story.append(heading2('10.4 Security Best Practices'))
story.append(bullet('Rate Limiting: Login 10/15min, Refresh 30/15min per IP'))
story.append(bullet('Audit Logging: Har sensitive action ka record with IP & user agent'))
story.append(bullet('CSRF Protection: Constant-time token verification'))
story.append(bullet('Sensitive Data: Passwords, tokens, API keys logs mein nahi aate'))
story.append(bullet('No Hardcoded Passwords: Production code mein koi default password nahi hai'))

story.append(PageBreak())

# ========== SECTION 11: ROLES ==========
story.append(heading1('11. User Roles & Permissions'))
story.append(section_divider())
story.append(spacer(4))

story.append(body(
    'HubSphere V3 mein Role-Based Access Control (RBAC) hai with 13 system roles aur 394 permissions. Har '
    'role ka pre-defined permission set hai jo uske access level ko determine karta hai. Permissions module-based '
    'hain (users, leads, deals, employees, etc.) aur action-based (view, create, edit, delete, manage, export, '
    'etc.). Custom roles bhi create kar sakte hain tenant level par, jismein aap specific permissions select '
    'kar sakte hain. SUPER_ADMIN ko saare 394 permissions milte hain automatically.'
))

roles_data = [
    ['SUPER_ADMIN', 'Full access — all 394 permissions'],
    ['TENANT_OWNER', 'Full access within organization (except tenant CRUD)'],
    ['ADMIN', 'Broad access (except tenant management & features)'],
    ['MANAGER', 'Team management — users, leads, deals, audit (no delete)'],
    ['SALES_MANAGER', 'Leads, contacts, companies, deals, calls'],
    ['SALES_EXECUTIVE', 'Sales modules (no delete permission)'],
    ['TELECALLER', 'Calls & contacts only (no delete)'],
    ['HR_MANAGER', 'Employees, departments, payroll, expenses, leave'],
    ['HR_EXECUTIVE', 'Day-to-day HR operations (no delete)'],
    ['FIELD_MANAGER', 'Leads, contacts, field visits, expenses (no delete)'],
    ['FIELD_EXECUTIVE', 'Field activities (limited, no approve/reject)'],
    ['ACCOUNTANT', 'Payroll & subscriptions only'],
    ['VIEWER', 'Read-only access — view permission on all modules'],
]
r_table = Table(roles_data, colWidths=[40*mm, 120*mm])
r_table.setStyle(TableStyle([
    ('FONTNAME', (0,0), (-1,-1), CJK_FONT),
    ('FONTNAME', (0,0), (0,-1), CJK_FONT_BOLD),
    ('FONTSIZE', (0,0), (-1,-1), 9),
    ('TEXTCOLOR', (0,0), (0,-1), PRIMARY),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ('TOPPADDING', (0,0), (-1,-1), 5),
    ('LINEBELOW', (0,0), (-1,-2), 0.5, BORDER),
    ('BACKGROUND', (0,0), (-1,0), ACCENT_LIGHT),
    ('FONTNAME', (0,0), (-1,0), CJK_FONT_BOLD),
]))
story.append(r_table)

story.append(PageBreak())

# ========== SECTION 12: TIPS ==========
story.append(heading1('12. Tips & Best Practices'))
story.append(section_divider())
story.append(spacer(4))

story.append(heading2('12.1 Navigation'))
story.append(body(
    'Application ka sidebar navigation role-based hai — aapko sirf wahi pages dikhayi denge jinhein aapke '
    'role ke paas access hai. Sidebar collapsible hai — icon mode mein minimize kar sakte hain taaki zyada '
    'screen space mile. Mobile par bottom navigation bar hai aur hamburger menu bhi hai. Theme toggle button '
    'se dark mode aur light mode ke beech switch kar sakte hain. Har page par breadcrumb navigation hai '
    'taaki aapko pata rahe ki aap app mein kahan hain.'
))

story.append(heading2('12.2 Data Management'))
story.append(bullet('Bulk Import: CRM data ko CSV file se import karein — proper headers zaroori hain'))
story.append(bullet('Export: Leads, contacts, companies, deals ko CSV mein download karein'))
story.append(bullet('Search: Global CRM search se quickly records find karein'))
story.append(bullet('Filters: Har list page par status, priority, source, aur date filters hain'))
story.append(bullet('Pagination: Saare list pages paginated hain — 20 records per page default'))

story.append(heading2('12.3 Workflow Automation Tips'))
story.append(bullet('Pehle workflow DRAFT mein save karein, test karein, phir ACTIVE karein'))
story.append(bullet('Idempotency keys se duplicate executions prevent hoti hain'))
story.append(bullet('Execution logs check karein agar workflow sahi run nahi ho raha'))
story.append(bullet('PAUSED status mein workflow rakh karein temporarily disable karne ke liye'))

story.append(heading2('12.4 Security Tips'))
story.append(bullet('2FA zaroor enable karein — especially admin accounts ke liye'))
story.append(bullet('Recovery codes ko safe jagah save karein — yeh ek baar dikhayi denge'))
story.append(bullet('Password regularly change karein — change-password feature use karein'))
story.append(bullet('Audit logs regularly review karein — suspicious activities detect karein'))
story.append(bullet('Koi bhi default ya hardcoded password use na karein'))

story.append(spacer(10))
story.append(section_divider())
story.append(spacer(5))
story.append(Paragraph(
    '<i>HubSphere V3 — Enterprise CRM, HRMS, Communication, Automation, AI & Analytics Platform</i>',
    ParagraphStyle('Footer', fontName=CJK_FONT, fontSize=9, textColor=GRAY, alignment=TA_CENTER)
))

# Build PDF
doc.build(story)
print(f'PDF generated: {OUTPUT_PATH}')
print(f'File size: {os.path.getsize(OUTPUT_PATH) / 1024:.1f} KB')
