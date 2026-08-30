#!/usr/bin/env python3
"""HubSphere CRM/HRM - User Instruction Guide PDF Generator"""

import os, sys, hashlib, subprocess, tempfile, platform
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, mm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    Paragraph, Spacer, PageBreak, Table, TableStyle,
    KeepTogether, CondPageBreak, HRFlowable,
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.platypus import SimpleDocTemplate
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
PDF_SKILL_DIR = os.path.join(PROJECT_DIR, 'skills', 'pdf')
OUTPUT_PATH = os.path.join(PROJECT_DIR, 'download', 'HubSphere_User_Guide.pdf')

_IS_MAC = platform.system() == 'Darwin'
FONT_DIR = os.path.expanduser('~/.openclaw/workspace/fonts') if _IS_MAC else '/usr/share/fonts'

pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
pdfmetrics.registerFont(TTFont('NotoSansSC', f'{FONT_DIR}/truetype/chinese/NotoSansSC[wght].ttf'))
pdfmetrics.registerFont(TTFont('SarasaMonoSC', f'{FONT_DIR}/truetype/chinese/SarasaMonoSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif', f'{FONT_DIR}/truetype/freefont/FreeSerif.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Bold', f'{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Italic', f'{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-BoldItalic', f'{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', f'{FONT_DIR}/truetype/dejavu/DejaVuSansMono.ttf'))

registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')
registerFontFamily('NotoSansSC', normal='NotoSansSC', bold='NotoSansSC')
registerFontFamily('FreeSerif', normal='FreeSerif', bold='FreeSerif-Bold', italic='FreeSerif-Italic', boldItalic='FreeSerif-BoldItalic')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans')

sys.path.insert(0, PDF_SKILL_DIR + '/scripts')
from pdf import install_font_fallback
install_font_fallback()

# ─── GREEN CASCADE PALETTE ───
PAGE_BG       = colors.HexColor('#f7faf7')
SECTION_BG    = colors.HexColor('#eff5ef')
CARD_BG       = colors.HexColor('#e8f0e8')
TABLE_STRIPE  = colors.HexColor('#edf4ed')
HEADER_FILL   = colors.HexColor('#2a5e3f')
COVER_BLOCK   = colors.HexColor('#1e4a30')
BORDER        = colors.HexColor('#c2d8c8')
ICON          = colors.HexColor('#3a8a58')
ACCENT        = colors.HexColor('#1a8a4a')
ACCENT_2      = colors.HexColor('#4a8aaa')
TEXT_PRIMARY  = colors.HexColor('#1a2e1f')
TEXT_MUTED    = colors.HexColor('#6a8070')
TABLE_HEADER_COLOR = HEADER_FILL
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = TABLE_STRIPE

# ─── STYLES ───
BF = 'FreeSerif'
HF = 'FreeSerif'

h1_style = ParagraphStyle(name='H1', fontName=HF, fontSize=20, leading=28, textColor=HEADER_FILL, spaceBefore=18, spaceAfter=10, alignment=TA_LEFT)
h2_style = ParagraphStyle(name='H2', fontName=HF, fontSize=15, leading=21, textColor=ICON, spaceBefore=14, spaceAfter=8, alignment=TA_LEFT)
h3_style = ParagraphStyle(name='H3', fontName=HF, fontSize=12.5, leading=18, textColor=TEXT_PRIMARY, spaceBefore=10, spaceAfter=6, alignment=TA_LEFT)
body_style = ParagraphStyle(name='Body', fontName=BF, fontSize=10.5, leading=17, textColor=TEXT_PRIMARY, spaceBefore=0, spaceAfter=6, alignment=TA_JUSTIFY)
body_left = ParagraphStyle(name='BodyLeft', fontName=BF, fontSize=10.5, leading=17, textColor=TEXT_PRIMARY, spaceBefore=0, spaceAfter=6, alignment=TA_LEFT)
bullet_style = ParagraphStyle(name='Bullet', fontName=BF, fontSize=10.5, leading=17, textColor=TEXT_PRIMARY, spaceBefore=2, spaceAfter=2, leftIndent=24, bulletIndent=10, alignment=TA_LEFT)
sub_bullet_style = ParagraphStyle(name='SubBullet', fontName=BF, fontSize=10, leading=16, textColor=TEXT_PRIMARY, spaceBefore=1, spaceAfter=1, leftIndent=44, bulletIndent=30, alignment=TA_LEFT)
tip_style = ParagraphStyle(name='Tip', fontName=BF, fontSize=10, leading=16, textColor=ICON, spaceBefore=4, spaceAfter=4, leftIndent=12, alignment=TA_LEFT)
caption_style = ParagraphStyle(name='Caption', fontName=BF, fontSize=9, leading=14, textColor=TEXT_MUTED, spaceBefore=3, spaceAfter=6, alignment=TA_CENTER)
toc_h1_style = ParagraphStyle(name='TOCH1', fontName=HF, fontSize=13, leading=22, leftIndent=20, textColor=TEXT_PRIMARY)
toc_h2_style = ParagraphStyle(name='TOCH2', fontName=BF, fontSize=11, leading=19, leftIndent=44, textColor=TEXT_PRIMARY)
title_toc_style = ParagraphStyle(name='TOCTitle', fontName=HF, fontSize=22, leading=30, textColor=HEADER_FILL, alignment=TA_LEFT, spaceBefore=12, spaceAfter=18)
header_cell_style = ParagraphStyle(name='HeaderCell', fontName=HF, fontSize=10, leading=14, textColor=TABLE_HEADER_TEXT, alignment=TA_CENTER)
cell_style = ParagraphStyle(name='Cell', fontName=BF, fontSize=9.5, leading=14, textColor=TEXT_PRIMARY, alignment=TA_LEFT)
cell_center = ParagraphStyle(name='CellCenter', fontName=BF, fontSize=9.5, leading=14, textColor=TEXT_PRIMARY, alignment=TA_CENTER)

# ─── TocDocTemplate ───
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

def add_heading(text, style, level=0):
    key = 'h_%s' % hashlib.md5(text.encode()).hexdigest()[:8]
    p = Paragraph('<a name="%s"/><b>%s</b>' % (key, text), style)
    p.bookmark_name = key
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

A4_W, A4_H = A4
MARGIN = 0.85 * inch
AVAIL_W = A4_W - 2 * MARGIN
H1_ORPHAN = (A4_H - 2 * MARGIN) * 0.15
MAX_KEEP = A4_H * 0.4

def safe_keep(elements):
    total = 0
    for el in elements:
        w, h = el.wrap(AVAIL_W, A4_H)
        total += h
    if total <= MAX_KEEP:
        return [KeepTogether(elements)]
    elif len(elements) >= 2:
        return [KeepTogether(elements[:2])] + list(elements[2:])
    return list(elements)

def make_table(headers, rows, col_ratios=None):
    ncols = len(headers)
    if col_ratios:
        col_widths = [r * AVAIL_W for r in col_ratios]
    else:
        col_widths = [AVAIL_W / ncols] * ncols
    data = [[Paragraph('<b>%s</b>' % h, header_cell_style) for h in headers]]
    for row in rows:
        data.append([Paragraph(str(c), cell_style) for c in row])
    t = Table(data, colWidths=col_widths, hAlign='CENTER')
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
    ]
    for i in range(1, len(data)):
        bg = TABLE_ROW_ODD if i % 2 == 0 else TABLE_ROW_EVEN
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_cmds))
    return t

def hr_line():
    return HRFlowable(width='100%', thickness=0.5, color=BORDER, spaceAfter=6, spaceBefore=6)

def bullet(text):
    return Paragraph('<bullet>&bull;</bullet> ' + text, bullet_style)

def sub_bullet(text):
    return Paragraph('<bullet>-</bullet> ' + text, sub_bullet_style)

def para(text):
    return Paragraph(text, body_style)

def para_left(text):
    return Paragraph(text, body_left)

def tip_box(text):
    return Paragraph('<b>Tip: </b>' + text, tip_style)

def page_template(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, 42, A4_W - MARGIN, 42)
    canvas.setFont('FreeSerif', 9)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawCentredString(A4_W / 2, 28, 'HubSphere CRM/HRM - User Instruction Guide')
    canvas.drawRightString(A4_W - MARGIN, 28, '%d' % doc.page)
    canvas.setStrokeColor(ACCENT)
    canvas.setLineWidth(2)
    canvas.line(MARGIN, A4_H - MARGIN + 8, MARGIN + 60, A4_H - MARGIN + 8)
    canvas.restoreState()

def first_page_template(canvas, doc):
    pass

# ─── COVER HTML ───
COVER_HTML = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @import url(\"https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&display=swap\");
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:794px; height:1123px; overflow:hidden; position:relative; background:#ffffff; font-family:\'Inter\',sans-serif; }
  .cover-layer-1 { position:absolute; inset:0; overflow:hidden; z-index:1; }
  .grid { position:absolute; inset:0; }
  .glh, .glv { position:absolute; background:#2a5e3f; opacity:0.04; }
  .glh { left:0; right:0; height:0.5px; }
  .glv { top:0; bottom:0; width:0.5px; }
  .cover-layer-2 { position:absolute; inset:0; z-index:2; }
  .anchor-line { position:absolute; left:95px; top:100px; bottom:100px; width:5px; background:#2a5e3f; }
  .accent-block { position:absolute; right:0; top:0; width:240px; height:1123px; background:#2a5e3f; opacity:0.06; }
  .cover-layer-3 { position:absolute; inset:0; z-index:3; }
  .ct { position:absolute; left:125px; top:0; width:560px; height:100%; }
  .kicker { position:absolute; top:170px; left:0; font-size:13pt; font-weight:400; letter-spacing:3px; color:#2a5e3f; opacity:0.7; text-transform:uppercase; }
  .hero { position:absolute; top:220px; left:0; width:520px; font-size:44pt; font-weight:800; line-height:1.15; color:#1a2e1f; }
  .subt { position:absolute; top:370px; left:0; width:480px; font-size:15pt; font-weight:300; line-height:1.6; color:#6a8070; opacity:0.9; }
  .md { position:absolute; top:560px; left:0; font-size:14pt; font-weight:400; color:#3a8a58; }
  .mi { position:absolute; top:590px; left:0; font-size:12pt; font-weight:300; color:#6a8070; }
  .ft { position:absolute; bottom:60px; left:0; font-size:10pt; font-weight:400; letter-spacing:2px; color:#2a5e3f; opacity:0.5; text-transform:uppercase; }
  .vb { position:absolute; bottom:60px; right:280px; font-size:10pt; font-weight:600; color:#1a8a4a; }
</style>
</head>
<body>
  <div class="cover-layer-1"><div class="grid" id="g"></div></div>
  <div class="cover-layer-2"><div class="anchor-line"></div><div class="accent-block"></div></div>
  <div class="cover-layer-3"><div class="ct">
    <div class="kicker">Complete Guide to Using HubSphere Platform</div>
    <div class="hero">HubSphere<br/>CRM/HRM<br/>User Guide</div>
    <div class="subt">Yeh guide aapko HubSphere platform ke saare modules ke baare mein step-by-step samjhayega. CRM, HRMS, Communication, AI aur Automation - sab kuch ek jagah covered hai.</div>
    <div class="md">30 August 2026</div>
    <div class="mi">Version 3.0 | SaaS Platform</div>
    <div class="ft">hubspherev3.vercel.app</div>
    <div class="vb">v3.0</div>
  </div></div>
  <script>
    const g=document.getElementById(\'g\');
    for(let y=50;y<1123;y+=50){const l=document.createElement(\'div\');l.className=\'glh\';l.style.top=y+\'px\';g.appendChild(l);}
    for(let x=50;x<794;x+=50){const l=document.createElement(\'div\');l.className=\'glv\';l.style.left=x+\'px\';g.appendChild(l);}
  </script>
</body>
</html>'''


# ═══════════════════════════════════════════════════════════
# CONTENT BUILDERS
# ═══════════════════════════════════════════════════════════

def build_ch1(story):
    story.extend([CondPageBreak(H1_ORPHAN), add_heading('1. Getting Started', h1_style, 0)])
    story.append(Spacer(1, 6))
    story.append(para(
        'HubSphere CRM/HRM ek powerful SaaS platform hai jo aapki sales, HR, communication aur automation needs ko '
        'ek hi jagah handle karta hai. Yeh guide aapko platform ke saare features aur modules ke baare mein detail mein '
        'samjhayega. Chahe aap sales team manage karna chahein ya employee payroll process karna ho, HubSphere '
        'aapke liye ready hai. Is guide ko dhyan se padhein aur step-by-step follow karein.'))

    story.append(add_heading('1.1 Platform Access', h2_style, 1))
    story.append(para('HubSphere ko access karne ke liye apna browser kholiye aur ye URL type karien:'))
    story.append(tip_box('https://hubspherev3.vercel.app'))
    story.append(Spacer(1, 4))
    story.append(para(
        'Agar yeh pehli baar hai ki aap platform use kar rahe hain, toh aapko ek Setup Wizard dikhega. Yeh wizard '
        'aapko platform configure karne mein help karega. Setup wizard mein aapko apni basic details fill karni hoti hain.'))

    story.append(add_heading('1.2 Setup Wizard', h2_style, 1))
    story.append(para(
        'Pehli baar platform open karne par setup wizard automatically appear hota hai. Isme aapko ye details fill karni '
        'hoti hain. Har field zaroori hai aur carefully fill karien:'))
    story.append(bullet('<b>Your Full Name</b> - Aapka poora naam enter karien'))
    story.append(bullet('<b>Email Address</b> - Aapki official email ID jo unique honi chahiye'))
    story.append(bullet('<b>Password</b> - Kam se kam 8 characters ka password banaien. Isme ek uppercase letter, ek lowercase letter, '
                        'aur ek number zaroor hona chahiye (jaise: Admin@123456)'))
    story.append(bullet('<b>Organization Name</b> - Apni company ya organization ka naam daalein'))
    story.append(Spacer(1, 6))
    story.append(para(
        'Setup complete hone ke baad, aap automatically <b>Super Admin</b> ke taur par logged in ho jaate hain. Aapko '
        'poora platform access mil jata hai aur aap apne team members ko invite kar sakte hain. Super Admin ko '
        'sabse zyada rights milte hain - poora platform control unke haath mein hota hai.'))

    story.append(add_heading('1.3 Login Credentials', h2_style, 1))
    story.append(para('Agar aap pehle se setup kar chuke hain aur dobara login karna hai, toh ye default credentials use karien:'))
    story.append(Spacer(1, 10))
    story.append(make_table(
        ['Field', 'Value'],
        [['Email', 'admin@hubsphere.com'], ['Password', 'Admin@123456']],
        col_ratios=[0.35, 0.65]))
    story.append(Paragraph('Table 1: Default Login Credentials', caption_style))
    story.append(Spacer(1, 10))

    story.append(add_heading('1.4 Role-Based Redirect', h2_style, 1))
    story.append(para(
        'Login ke baad, aapke role ke hisaab se automatically redirect hota hai. Har role ka apna dashboard aur access '
        'level hota hai. Yeh system hai ki koi bhi user sirf usi part ko dekhe jo uske liye relevant hai.'))
    story.append(Spacer(1, 10))
    story.append(make_table(
        ['Role', 'Redirect URL', 'Access Level'],
        [
            ['Super Admin', '/super-admin', 'Full platform access, all tenants'],
            ['Admin / Manager', '/admin', 'Organization management, users, roles'],
            ['Sales / Telecaller', '/crm/leads', 'CRM module - leads, deals, contacts'],
        ], col_ratios=[0.25, 0.30, 0.45]))
    story.append(Paragraph('Table 2: Role-Based URL Redirects', caption_style))
    story.append(Spacer(1, 8))
    story.append(para(
        'Agar aapko lagta hai ki galat page par redirect ho rahe hain, toh apne admin se contact karien taki '
        'aapka role sahi se set ho. Password reset ke liye Forgot Password option bhi available hai login page par.'))


def build_ch2(story):
    story.extend([CondPageBreak(H1_ORPHAN), add_heading('2. Super Admin Module', h1_style, 0)])
    story.append(Spacer(1, 6))
    story.append(para(
        'Super Admin module poore HubSphere platform ka top-level control center hai. Yahan se aap saari tenants, users, '
        'roles aur system settings manage kar sakte hain. Super Admin ko /super-admin path par redirect kiya jata hai '
        'login ke baad. Is module ko sirf Super Admin role wale users hi access kar sakte hain.'))

    story.append(add_heading('2.1 Dashboard', h2_style, 1))
    story.append(para(
        'Super Admin dashboard par aapko platform ka overall summary dikhta hai. Yahan aap dekh sakte hain ki kitne '
        'tenants registered hain, total active users kitne hain, kitni subscriptions active hain, aur recent audit '
        'events kya hain. Dashboard par key metrics cards mein display hote hain taki ek glance mein sab kuch '
        'samajh aa jaye. Yeh data real-time update hota hai aur platform ki health dikhata hai.'))
    story.append(bullet('<b>Total Tenants</b> - Platform par registered saari organizations ki count'))
    story.append(bullet('<b>Total Users</b> - Saare tenants ke saare users ka combined count'))
    story.append(bullet('<b>Active Subscriptions</b> - Kitni subscriptions abhi active hain'))
    story.append(bullet('<b>Audit Events</b> - Recent platform activities aur system changes'))

    story.append(add_heading('2.2 Tenants Management', h2_style, 1))
    story.append(para(
        'Tenants section mein aap nayi organizations create kar sakte hain aur existing ones manage kar sakte hain. Nayi '
        'tenant create karte waqt aapko organization ka naam, ek unique slug (URL-friendly identifier), subscription '
        'plan (FREE, STARTER, PRO, ENTERPRISE), aur maximum users limit fill karna hota hai. Aap kisi bhi tenant ka '
        'status update kar sakte hain - ACTIVE, SUSPENDED, ya TRIAL. Suspended tenant ka access temporarily block ho jata hai.'))
    story.append(Spacer(1, 10))
    story.append(make_table(
        ['Status', 'Description'],
        [
            ['ACTIVE', 'Tenant fully operational, users can access all features'],
            ['SUSPENDED', 'Tenant access blocked, data preserved but login disabled'],
            ['TRIAL', 'Tenant in trial period with limited features and time'],
        ], col_ratios=[0.20, 0.80]))
    story.append(Paragraph('Table 3: Tenant Status Options', caption_style))

    story.append(add_heading('2.3 System Roles', h2_style, 1))
    story.append(para(
        'HubSphere mein 13 built-in system roles hain. Yeh roles pre-defined hain aur unhe change nahi kiya ja sakta. '
        'Har role ka apna permission set hai. Yeh table mein saari roles listed hain:'
        ))
    story.append(Spacer(1, 10))
    story.append(make_table(
        ['Role Code', 'Description'],
        [
            ['SUPER_ADMIN', 'Full platform control, all tenants and system settings'],
            ['TENANT_OWNER', 'Organization owner with full org-level access'],
            ['ADMIN', 'Organization administrator with most org features'],
            ['MANAGER', 'Team manager with team-level access and oversight'],
            ['SALES_MANAGER', 'Sales team lead with CRM pipeline oversight'],
            ['SALES_EXECUTIVE', 'Sales team member managing deals and leads'],
            ['TELECALLER', 'Dedicated calling interface with quick actions'],
            ['HR_MANAGER', 'Full HR module access including approvals'],
            ['HR_EXECUTIVE', 'HR team member for data entry and reports'],
            ['FIELD_MANAGER', 'Field team supervisor with visit tracking'],
            ['FIELD_EXECUTIVE', 'Field sales representative for on-ground work'],
            ['ACCOUNTANT', 'Payroll, expenses, and financial management'],
            ['VIEWER', 'Read-only access across all modules'],
        ], col_ratios=[0.25, 0.75]))
    story.append(Paragraph('Table 4: System Roles (13 Built-in Roles)', caption_style))

    story.append(add_heading('2.4 Audit Logs', h2_style, 1))
    story.append(para(
        'Audit Logs section mein poore platform ki activity track hoti hai. Har action - chahe wo tenant creation ho, user '
        'invitation ho, ya koi setting change ho - sab recorded hota hai. Aap actor (kisne kiya), action (kya kiya), '
        'timestamp (kab kiya), aur IP address (kahan se kiya) dekh sakte hain. Yeh feature security aur compliance ke liye '
        'bahut zaroori hai.'))

    story.append(add_heading('2.5 System Settings', h2_style, 1))
    story.append(para(
        'System Settings mein aap AI providers configure kar sakte hain (OpenAI, Google, Anthropic, etc.), system-level '
        'settings adjust kar sakte hain, aur platform ke global configurations manage kar sakte hain. Yeh section sirf '
        'Super Admin ke liye accessible hai kyunki yahan ki koi bhi change poore platform ko affect karti hai.'))


def build_ch3(story):
    story.extend([CondPageBreak(H1_ORPHAN), add_heading('3. Admin Module', h1_style, 0)])
    story.append(Spacer(1, 6))
    story.append(para(
        'Admin module organization-level management ke liye hai. Yahan se aap apne team members ko manage karte hain, '
        'roles aur permissions set karte hain, aur organization settings configure karte hain. Admin aur Manager role '
        'wale users /admin path par redirect hote hain.'))

    story.append(add_heading('3.1 User Management', h2_style, 1))
    story.append(para(
        'User Management section mein aap nayi team members ko invite kar sakte hain. Email invitation bheji jaati hai '
        'aur user signup karke join kar leta hai. Aap kisi bhi user ko role assign kar sakte hain aur unka status manage '
        'kar sakte hain. Status options hain: ACTIVE (user can login), INACTIVE (user exists but cannot login), '
        'SUSPENDED (temporary block). User edit karke aap unka naam, email, aur role update kar sakte hain.'))

    story.append(add_heading('3.2 Role and Permission Management', h2_style, 1))
    story.append(para(
        'HubSphere mein 224+ permissions hain jo 32 modules ke across 7 actions mein divided hain. Actions hain: '
        'CREATE, READ, UPDATE, DELETE, EXPORT, IMPORT, aur MANAGE. Admin module se aap custom roles bana sakte hain '
        'aur unhe specific permissions assign kar sakte hain.'))
    story.append(Spacer(1, 10))
    story.append(make_table(
        ['Action', 'Description', 'Example'],
        [
            ['CREATE', 'Naya record banana', 'New lead create karna'],
            ['READ', 'Data dekhna', 'Dashboard aur lists view karna'],
            ['UPDATE', 'Existing data edit karna', 'Lead status update karna'],
            ['DELETE', 'Record delete karna', 'Purani deal delete karna'],
            ['EXPORT', 'Data export karna', 'Leads CSV export'],
            ['IMPORT', 'Data import karna', 'Contacts CSV import'],
            ['MANAGE', 'Full module control', 'Module settings configure'],
        ], col_ratios=[0.15, 0.35, 0.50]))
    story.append(Paragraph('Table 5: Permission Actions', caption_style))

    story.append(add_heading('3.3 Memberships', h2_style, 1))
    story.append(para(
        'Memberships section user-tenant associations manage karta hai. Multi-tenant setup mein ek user multiple tenants '
        'se associated ho sakta hai aur har tenant mein alag role ho sakta hai. Nayi membership add karne ke liye '
        'user select karein, tenant select karein, aur role assign karein.'))

    story.append(add_heading('3.4 Organization Settings', h2_style, 1))
    story.append(para(
        'Organization Settings mein aap apni organization ka naam, domain, aur logo configure kar sakte hain. Yeh '
        'details platform ke throughout use hote hain - emails, reports, aur UI mein. Logo upload karne ke liye '
        'recommended size hoti hai 512x512 pixels PNG format mein.'))

    story.append(add_heading('3.5 Audit Logs and Subscription', h2_style, 1))
    story.append(para(
        'Admin Audit Logs mein sirf aapki organization ki activities dikhti hain. Subscription section mein aap apna '
        'current plan dekh sakte hain aur upgrade kar sakte hain.'))
    story.append(Spacer(1, 10))
    story.append(make_table(
        ['Plan', 'Members', 'Key Features'],
        [
            ['FREE', 'Up to 5', 'Basic CRM and HR features'],
            ['STARTER', 'Up to 25', 'Advanced CRM, basic automation'],
            ['PRO', 'Up to 100', 'Full CRM, HR, AI, automation'],
            ['ENTERPRISE', 'Unlimited', 'All features + priority support'],
        ], col_ratios=[0.18, 0.22, 0.60]))
    story.append(Paragraph('Table 6: Subscription Plans', caption_style))



def build_ch4(story):
    story.extend([CondPageBreak(H1_ORPHAN), add_heading('4. CRM Module - Sales Pipeline', h1_style, 0)])
    story.append(Spacer(1, 6))
    story.append(para(
        'CRM (Customer Relationship Management) module HubSphere ka sabse powerful module hai. Yahan se aap apne '
        'saare leads, contacts, companies, deals aur tasks manage kar sakte hain. Sales pipeline ko track karna, '
        'follow-ups schedule karna, aur deals close karna - sab kuch yahan hota hai.'))

    story.append(add_heading('4.1 CRM Dashboard', h2_style, 1))
    story.append(para(
        'CRM Dashboard par aapko sales pipeline ka complete overview milta hai. Dashboard par dikhta hai: total pipeline '
        'value (saari active deals ki combined value), deals by stage ka chart, aaj ke follow-ups, aur recent activities. '
        'Yeh data real-time update hota hai aur aapko sales performance track karne mein madad karta hai.'))

    story.append(add_heading('4.2 Leads Management', h2_style, 1))
    story.append(para(
        'Leads CRM ka starting point hai. Nayi lead create karne ke liye "Create Lead" button par click karein aur '
        'following details fill karein:'))
    story.append(bullet('<b>Name</b> - Lead ka poora naam'))
    story.append(bullet('<b>Email</b> - Lead ki email address'))
    story.append(bullet('<b>Phone</b> - Contact number'))
    story.append(bullet('<b>Company</b> - Lead ki company naam (agar already exist karta hai toh select karein)'))
    story.append(bullet('<b>Source</b> - Lead kahan se aaya'))
    story.append(bullet('<b>Priority</b> - HIGH, MEDIUM, ya LOW'))
    story.append(bullet('<b>Value</b> - Estimated deal value (amount)'))
    story.append(bullet('<b>Status</b> - Lead ka current stage'))
    story.append(Spacer(1, 6))
    story.append(para(
        '<b>Lead Statuses (7 stages):</b> NEW jab lead abhi create hua ho, CONTACTED jab aap pehli baar connect '
        'kar chuke ho, QUALIFIED jab lead genuine buyer hai, PROPOSAL jab proposal bhej diya ho, NEGOTIATION jab '
        'pricing discuss ho rahi ho, WON jab deal close ho gayi ho, aur LOST jab lead convert na ho paya ho.'))
    story.append(Spacer(1, 10))
    story.append(make_table(
        ['Source', 'Description'],
        [
            ['WEBSITE', 'Website form se aaya hua lead'],
            ['REFERRAL', 'Kisi existing customer ya partner ki reference'],
            ['LINKEDIN', 'LinkedIn se inbound ya outbound connection'],
            ['COLD_CALL', 'Direct phone call se generate kiya gaya'],
            ['EMAIL_CAMPAIGN', 'Email marketing campaign se response'],
            ['ADVERTISEMENT', 'Paid ads - Google, Facebook, etc.'],
            ['TRADE_SHOW', 'Events aur trade shows se collected'],
            ['SOCIAL_MEDIA', 'Social media platforms se aaya'],
            ['OTHER', 'Kisi aur source se'],
        ], col_ratios=[0.25, 0.75]))
    story.append(Paragraph('Table 7: Lead Sources (9 Types)', caption_style))

    story.append(add_heading('4.3 Lead Conversion', h2_style, 1))
    story.append(para(
        'Jab ek lead qualified ho jata hai, toh aap use one-click mein Contact mein convert kar sakte hain. Lead detail '
        'page par "Convert to Contact" button dikhta hai. Click karte hi lead ka data automatically contact ban jata hai, '
        'company association maintain hoti hai, aur saare notes/tags bhi transfer ho jaate hain.'))

    story.append(add_heading('4.4 Contacts and Companies', h2_style, 1))
    story.append(para(
        'Contacts section mein saare converted leads aur manually added contacts dikhte hain. Har contact ka full '
        'profile hota hai jismein company association, tags (color-coded labels), notes, aur activity timeline '
        'included hai. Companies section mein company profiles hain jismein industry type, website URL, address, aur linked '
        'contacts aur deals dikhte hain.'))

    story.append(add_heading('4.5 Deals and Pipeline', h2_style, 1))
    story.append(para(
        'Deals section sales pipeline ka core hai. Deal create karte waqt aap deal value, stage, aur probability '
        'assign karte hain. Aap deals ko List view ya Kanban board view mein dekh sakte hain. Kanban view mein deals '
        'columns mein dikhte hain aur drag-and-drop se stage change ho jata hai.'))
    story.append(Spacer(1, 10))
    story.append(make_table(
        ['Stage', 'Description', 'Typical Action'],
        [
            ['PROSPECTING', 'Initial contact, requirements gathering', 'Discovery call, demo request'],
            ['QUALIFICATION', 'Validating lead quality and budget', 'BANT analysis, needs assessment'],
            ['PROPOSAL', 'Sending commercial proposal', 'Prepare and send proposal document'],
            ['NEGOTIATION', 'Price and terms discussion', 'Negotiate pricing, contract terms'],
            ['CLOSED_WON', 'Deal successfully closed', 'Generate invoice, celebrate win'],
            ['CLOSED_LOST', 'Deal lost to competitor or no-go', 'Loss reason analysis, follow-up later'],
        ], col_ratios=[0.22, 0.40, 0.38]))
    story.append(Paragraph('Table 8: Deal Pipeline Stages', caption_style))

    story.append(add_heading('4.6 Tasks, Follow-ups, and Notes', h2_style, 1))
    story.append(para(
        'Tasks create karke daily activities track kar sakte hain. Koi bhi task ko lead, contact, ya deal se link kiya '
        'ja sakta hai. Priority (HIGH/MEDIUM/LOW) aur due date set kiya ja sakta hai. Follow-ups scheduled interactions '
        'hain jo PENDING, COMPLETED, MISSED, ya CANCELLED ho sakte hain. Notes kisi bhi entity par add kiye ja sakte hain.'))

    story.append(add_heading('4.7 Telecaller Interface', h2_style, 1))
    story.append(para(
        'Telecaller module specially phone-based sales team ke liye designed hai. Split-panel view hota hai - '
        'left side mein lead list aur right side mein lead details. Quick-call buttons se directly call initiate '
        'ho jata hai. Call history automatically track hoti hai.'))

    story.append(add_heading('4.8 Import and Export', h2_style, 1))
    story.append(para(
        'Bulk data ke liye CSV import aur export features available hain. Import karte waqt system automatically data '
        'validate karta hai - agar koi row mein required field missing hai toh error dikhata hai. Export mein aap '
        'filters apply kar ke sirf wo data download kar sakte hain jo chahiye. Template CSV download kar ke format '
        'samajh sakte hain.'))


def build_ch5(story):
    story.extend([CondPageBreak(H1_ORPHAN), add_heading('5. HRMS Module - HR Management', h1_style, 0)])
    story.append(Spacer(1, 6))
    story.append(para(
        'HRMS (Human Resource Management System) module aapke HR operations ko digitize karta hai. Departments se lekar
        'payroll tak, attendance se lekar leave management tak - sab kuch yahan handle hota hai. Yeh module specially
        'Indian businesses ke requirements ko keep in mind design kiya gaya hai.'))

    story.append(add_heading('5.1 HR Dashboard', h2_style, 1))
    story.append(para(
        'HR Dashboard par aapko organization ki HR health dikhti hai. Employee count, aaj ki attendance summary,
        'pending leave requests, aur payroll overview cards mein dikhte hain. Yeh data HR manager ko ek glance mein
        'sab important information deta hai.'))

    story.append(add_heading('5.2 Departments and Designations', h2_style, 1))
    story.append(para(
        'Departments section mein aap company ke departments create aur manage kar sakte hain. Har department ka ek
        'head hota hai jo us department ke employees ko supervise karta hai. Designations section mein job titles
        'hain jo departments ke saath linked hain. Jaise ki "Software Engineer" designation "Engineering" department
        'ke saath linked ho sakta hai.'))

    story.append(add_heading('5.3 Employees', h2_style, 1))
    story.append(para(
        'Employees section mein saari employee profiles hain. Har employee ke liye aap department, designation, salary,
        'reporting manager, aur status (ACTIVE/INACTIVE) set kar sakte hain. Employee profile mein personal info,
        'employment history, aur linked records (attendance, leaves, payroll) bhi dikhte hain.'))

    story.append(add_heading('5.4 Attendance', h2_style, 1))
    story.append(para(
        'Attendance system GPS-enabled check-in/check-out ke saath kaam karta hai. Employee apne mobile se check-in karta
        'hai aur system automatically location capture karta hai. Working minutes auto-calculate hote hain, overtime
        'aur late minutes bhi track hote hain. Attendance statuses:'))
    story.append(Spacer(1, 10))
    story.append(make_table(
        ['Status', 'Description'],
        [
            ['PRESENT', 'Employee checked in on time, full day'],
            ['ABSENT', 'Employee did not check in'],
            ['HALF_DAY', 'Employee worked half day'],
            ['LATE', 'Employee checked in after allowed time'],
            ['ON_LEAVE', 'Employee is on approved leave'],
            ['HOLIDAY', 'Public or company holiday'],
            ['WEEK_OFF', 'Weekly off day (Sunday or Saturday)'],
        ], col_ratios=[0.22, 0.78]))
    story.append(Paragraph('Table 9: Attendance Statuses', caption_style))

    story.append(add_heading('5.5 Leave Management', h2_style, 1))
    story.append(para(
        'HubSphere mein 7 leave types supported hain. Leave request submit karne par approval workflow trigger hota hai.
        'Manager approve ya reject kar sakta hai. Carry-forward settings se previous year ka unused leave current
        'year mein transfer ho sakta hai.'))
    story.append(Spacer(1, 10))
    story.append(make_table(
        ['Leave Type', 'Description', 'Typical Balance'],
        [
            ['Casual Leave', 'Short notice leaves for personal work', '12 per year'],
            ['Sick Leave', 'Medical emergencies and illness', '10 per year'],
            ['Earned Leave', 'Accumulated based on working days', '15 per year'],
            ['Maternity Leave', 'For female employees', '26 weeks'],
            ['Paternity Leave', 'For male employees on child birth', '15 days'],
            ['Compensatory', 'Off for extra work done on holidays', 'As earned'],
            ['Loss of Pay', 'Unpaid leave when balance exhausted', 'No limit'],
        ], col_ratios=[0.22, 0.50, 0.28]))
    story.append(Paragraph('Table 10: Leave Types', caption_style))

    story.append(add_heading('5.6 Payroll', h2_style, 1))
    story.append(para(
        'Payroll module monthly salary processing ko automate karta hai. Isme allowances (HRA, DA, etc.), deductions
        '(PF, ESI, Tax, etc.), overtime calculation, aur bonus tracking included hai. Payroll ka status flow:
        'DRAFT (initial) > PROCESSING (calculations running) > FINALIZED (ready for payment) > PAID (salary
        'disbursed) > CANCELLED (if needed). Bank transfer tracking bhi available hai.'))

    story.append(add_heading('5.7 Expenses', h2_style, 1))
    story.append(para(
        'Employees expenses submit kar sakte hain with receipt upload. 7 expense categories hain (Travel, Food, Office
        'Supplies, etc.). Approval workflow mein manager review karta hai aur approve/reject karta hai. Approved
        'expenses reimbursement queue mein jaate hain.'))

    story.append(add_heading('5.8 Field Visits', h2_style, 1))
    story.append(para(
        'Field Visits module field team ke liye hai. Visits plan kar sakte hain aur GPS se track kar sakte hain.
        'Dashboard par aaj ki scheduled visits, completed visits, aur team location dikhta hai. Yeh feature
        'specially field sales aur service teams ke liye useful hai.'))


def build_ch6(story):
    story.extend([CondPageBreak(H1_ORPHAN), add_heading('6. Communication Module', h1_style, 0)])
    story.append(Spacer(1, 6))
    story.append(para(
        'Communication module aapke saare messaging channels ko ek jagah laata hai. WhatsApp, Email, SMS, aur
        'In-App messages - sab kuch Unified Inbox mein. Templates bana kar bulk messages bhej sakte hain aur
        'real-time notifications se connected rah sakte hain.'))

    story.append(add_heading('6.1 Unified Inbox', h2_style, 1))
    story.append(para(
        'Unified Inbox mein saari channels ki messages ek jagah dikhti hain. Aap filter laga kar specific channel
        'dekh sakte hain (sirf WhatsApp, sirf Email, etc.). Conversations mein full thread dikhti hai - message
        'history, attachments, aur contact info. Inbox real-time update hota hai aur unread count bhi dikhta hai.'))

    story.append(add_heading('6.2 Message Templates', h2_style, 1))
    story.append(para(
        'Reusable templates bana kar aap time bacha sakte hain. Templates mein {{variable}} placeholders use
        'hote hain jo dynamically replace hote hain. Jaise ki {{customer_name}} lead ka naam se, {{company_name}}
        'company ke naam se replace ho jayega. Templates sabhi channels ke liye available hain - WhatsApp,
        'Email, SMS, aur In-App.'))
    story.append(tip_box('Template example: "Hello {{customer_name}}, aapka inquiry for {{product}} receive ho gaya hai. Hum 24 hours mein respond karenge."'))

    story.append(add_heading('6.3 Notifications', h2_style, 1))
    story.append(para(
        'Real-time in-app notifications aapko har important event ke baare mein inform karte hain. Notification types:
        'INFO (general updates), WARNING (attention needed), ERROR (something failed), SUCCESS (action completed),
        'MENTION (someone mentioned you), ASSIGNMENT (task assigned to you). Notification bell icon par
        'unread count dikhta hai.'))

    story.append(add_heading('6.4 Provider Settings', h2_style, 1))
    story.append(para(
        'Communication providers configure karne ke liye yeh section use karien. WhatsApp aur SMS ke liye Twilio
        'account setup karna hota hai (Account SID, Auth Token, Phone Number). Email ke liye SendGrid ya AWS SES
        'configure kar sakte hain. Setup ke baad test message bhej kar verify karein ki sab kaam kar raha hai.'))


def build_ch7(story):
    story.extend([CondPageBreak(H1_ORPHAN), add_heading('7. AI Module', h1_style, 0)])
    story.append(Spacer(1, 6))
    story.append(para(
        'AI module HubSphere ka intelligent assistant hai. 5 specialized AI agents hain jo different business
        'functions ke liye designed hain. Aap in agents se chat kar ke insights, suggestions, aur analysis
        'pa sakte hain.'))

    story.append(add_heading('7.1 AI Agents', h2_style, 1))
    story.append(para('HubSphere mein 5 AI agents hain, har ek ka apna specialization:'))
    story.append(Spacer(1, 10))
    story.append(make_table(
        ['Agent', 'Purpose', 'Key Capabilities'],
        [
            ['NOVA', 'General business assistant', 'Q&A, summaries, general advice'],
            ['VOX', 'Call intelligence', 'Call scripts, sentiment analysis'],
            ['SALESPRO', 'Sales insights', 'Pipeline analysis, deal strategies'],
            ['PEOPLEMIND', 'HR analytics', 'Attendance patterns, attrition risk'],
            ['INSIGHT', 'KPI and trend analysis', 'Performance metrics, forecasting'],
        ], col_ratios=[0.18, 0.30, 0.52]))
    story.append(Paragraph('Table 11: AI Agents', caption_style))

    story.append(add_heading('7.2 Chat Interface', h2_style, 1))
    story.append(para(
        'AI Chat interface simple hai - agent select karein, message type karein, aur response paayein. Context
        'maintain hota hai toh aap baatein continue kar sakte hain. Agents aapke HubSphere data ko bhi access
        'kar sakte hain (jaise NOVA aapke deals ka analysis kar sakta hai).'))

    story.append(add_heading('7.3 Usage Tracking', h2_style, 1))
    story.append(para(
        'AI usage dashboard par aap dekh sakte hain ki kaunsa agent kitna use hua, kitne tokens consume hue,
        'aur per-agent ka average response time. Yeh data cost optimization ke liye useful hai.'))


def build_ch8(story):
    story.extend([CondPageBreak(H1_ORPHAN), add_heading('8. Automation Module', h1_style, 0)])
    story.append(Spacer(1, 6))
    story.append(para(
        'Automation module se aap repetitive tasks ko automate kar sakte hain. Workflows create karke aap
        'define kar sakte hain ki "jab X event ho, toh Y condition check karo, aur Z action karo." Isse
        'manual work kam hota hai aur human errors bhi reduce hote hain.'))

    story.append(add_heading('8.1 Workflow Builder', h2_style, 1))
    story.append(para(
        'Workflow builder visual interface hai jahan aap triggers, conditions, aur actions add kar sakte hain.
        'Workflow activate hone ke baad automatically run hota hai jab trigger event occur hota hai.'))

    story.append(add_heading('8.2 Trigger Events (18 types)', h2_style, 1))
    story.append(para(
        '18 trigger events hain jo workflow ko kick kar sakte hain. Common triggers include:'))
    story.append(bullet('<b>lead.created</b> - Jab nayi lead banti hai'))
    story.append(bullet('<b>deal.stage_changed</b> - Jab deal ka stage change hota hai'))
    story.append(bullet('<b>lead.status_changed</b> - Jab lead ka status update hota hai'))
    story.append(bullet('<b>task.created</b> - Jab nayi task banti hai'))
    story.append(bullet('<b>employee.attendance</b> - Jab attendance record create hota hai'))
    story.append(bullet('<b>leave.submitted</b> - Jab leave request submit hoti hai'))
    story.append(para('Aur bhi triggers hain for expenses, calls, follow-ups, etc.'))

    story.append(add_heading('8.3 Action Types (13 types)', h2_style, 1))
    story.append(para('Trigger ke baad execute hone wale actions:'))
    story.append(bullet('<b>create_task</b> - Automatically nayi task create karo'))
    story.append(bullet('<b>send_email</b> - Email bhejo (template ke saath)'))
    story.append(bullet('<b>assign_user</b> - Kisi user ko assign karo'))
    story.append(bullet('<b>webhook</b> - External API call karo'))
    story.append(bullet('<b>update_field</b> - Kisi record ka field update karo'))
    story.append(para('Aur actions: send_whatsapp, send_sms, create_followup, create_note, change_status, notify, delay, condition.'))

    story.append(add_heading('8.4 Execution History', h2_style, 1))
    story.append(para(
        'Har workflow run ka record execution history mein save hota hai. Aap dekh sakte hain ki kis workflow ne
        'kab run kiya, kaunse steps execute hue, aur kya result aaya. Failed executions bhi dikhti hain taki
        'aap debug kar sakein.'))


def build_ch9(story):
    story.extend([CondPageBreak(H1_ORPHAN), add_heading('9. Analytics', h1_style, 0)])
    story.append(Spacer(1, 6))
    story.append(para(
        'Analytics module poore HubSphere data ko visual insights mein convert karta hai. 7 specialized dashboards
        'hain jo different aspects cover karte hain. Leadership ko cross-module insights milte hain.'))
    story.append(Spacer(1, 10))
    story.append(make_table(
        ['Dashboard', 'Focus Area', 'Key Metrics'],
        [
            ['Executive', 'Overall business health', 'Revenue, users, growth rate'],
            ['CRM', 'Sales performance', 'Pipeline value, conversion rate, win rate'],
            ['Telecaller', 'Calling efficiency', 'Calls made, connected, conversion'],
            ['HR', 'Workforce analytics', 'Attendance %, attrition, leave balance'],
            ['Communication', 'Messaging analytics', 'Messages sent, delivery rate, response time'],
            ['Automation', 'Workflow efficiency', 'Runs, success rate, time saved'],
            ['AI Usage', 'AI adoption and cost', 'Tokens used, per-agent usage, cost'],
        ], col_ratios=[0.18, 0.32, 0.50]))
    story.append(Paragraph('Table 12: Analytics Dashboards', caption_style))


def build_ch10(story):
    story.extend([CondPageBreak(H1_ORPHAN), add_heading('10. Mobile and PWA', h1_style, 0)])
    story.append(Spacer(1, 6))
    story.append(para(
        'HubSphere fully responsive hai - mobile, tablet, aur desktop sab par smoothly kaam karta hai.'))
    story.append(bullet('<b>Card View on Mobile:</b> Mobile par data cards mein dikhta hai jo thumb-friendly touch targets hain.'))
    story.append(bullet('<b>Table View on Desktop:</b> Desktop par traditional table layout dikhta hai with sorting and filtering.'))
    story.append(bullet('<b>Bottom Navigation:</b> Mobile par bottom navigation bar hota hai for easy one-hand access.'))
    story.append(bullet('<b>Dark/Light Theme:</b> Header mein theme toggle hai. Dark mode low-light mein comfortable hai.'))
    story.append(bullet('<b>PWA Support:</b> HubSphere installable hai as Progressive Web App. Mobile browser mein "Add to Home Screen" option se install karein - aapko app icon banti hai aur offline support bhi milta hai.'))
    story.append(Spacer(1, 10))
    story.append(para(
        'PWA install karne ke liye Chrome/Edge mein HubSphere kholiye, browser menu (three dots) par click karein,
        'aur "Install App" ya "Add to Home Screen" option select karein. Ek baar install hone ke baad aapko
        'native app jaisa experience milta hai - full screen, fast loading, aur push notification support.'))



# ═══════════════════════════════════════════════════════════
# MAIN BUILD
# ═══════════════════════════════════════════════════════════

def build_body_pdf(output_path):
    """Build the body PDF (TOC + all chapters), no cover."""
    doc = TocDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN, bottomMargin=0.7 * inch,
    )

    # TOC
    toc = TableOfContents()
    toc.levelStyles = [toc_h1_style, toc_h2_style]

    story = []
    story.append(Paragraph('<b>Table of Contents</b>', title_toc_style))
    story.append(Spacer(1, 12))
    story.append(toc)
    story.append(PageBreak())

    # Chapters
    build_ch1(story)
    build_ch2(story)
    build_ch3(story)
    build_ch4(story)
    build_ch5(story)
    build_ch6(story)
    build_ch7(story)
    build_ch8(story)
    build_ch9(story)
    build_ch10(story)

    doc.multiBuild(story, onLaterPages=page_template, onFirstPage=first_page_template)
    print(f'Body PDF written: {output_path}')
    return output_path


def build_cover_pdf(html_content, output_path):
    """Render cover HTML to PDF via html2poster.js."""
    html_path = output_path + '.cover.html'
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html_content)

    scripts_dir = os.path.join(PDF_SKILL_DIR, 'scripts')
    result = subprocess.run(
        ['node', os.path.join(scripts_dir, 'html2poster.js'), html_path,
         '--output', output_path, '--width', '794px'],
        capture_output=True, text=True, timeout=60,
    )
    if result.returncode != 0:
        print(f'Cover render stderr: {result.stderr[:500]}')
        raise RuntimeError(f'Cover render failed (exit {result.returncode})')
    print(f'Cover PDF written: {output_path}')
    os.unlink(html_path)
    return output_path


def merge_pdfs(cover_pdf, body_pdf, output_pdf):
    """Merge cover + body into single PDF."""
    from pypdf import PdfReader, PdfWriter
    A4_W_PT, A4_H_PT = 595.28, 841.89

    def normalize(page):
        box = page.mediabox
        w, h = float(box.width), float(box.height)
        if abs(w - A4_W_PT) > 2 or abs(h - A4_H_PT) > 2:
            page.scale_to(A4_W_PT, A4_H_PT)
        return page

    writer = PdfWriter()
    # Cover page first
    writer.add_page(normalize(PdfReader(cover_pdf).pages[0]))
    # Body pages
    for page in PdfReader(body_pdf).pages:
        writer.add_page(normalize(page))
    writer.add_metadata({
        '/Title': 'HubSphere CRM/HRM - User Instruction Guide',
        '/Author': 'HubSphere',
        '/Creator': 'HubSphere PDF Generator',
    })
    with open(output_pdf, 'wb') as f:
        writer.write(f)
    print(f'Merged PDF written: {output_pdf}')


def main():
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        body_pdf = os.path.join(tmp, 'body.pdf')
        cover_pdf = os.path.join(tmp, 'cover.pdf')

        print('Step 1: Building body PDF...')
        build_body_pdf(body_pdf)

        print('Step 2: Rendering cover...')
        build_cover_pdf(COVER_HTML, cover_pdf)

        print('Step 3: Merging...')
        merge_pdfs(cover_pdf, body_pdf, OUTPUT_PATH)

    # Verify
    from pypdf import PdfReader
    reader = PdfReader(OUTPUT_PATH)
    print(f'\nFinal PDF: {OUTPUT_PATH}')
    print(f'Total pages: {len(reader.pages)}')
    if len(reader.pages) >= 15:
        print('PASS: 15+ pages achieved.')
    else:
        print(f'WARN: Only {len(reader.pages)} pages (target: 15+)')


if __name__ == '__main__':
    main()
