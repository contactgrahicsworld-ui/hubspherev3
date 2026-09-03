#!/usr/bin/env python3
"""Generate HubSphere Hindi Guide HTML"""
import sys

def w(f, text):
    f.write(text)

def P(t): return f'<p>{t}</p>'
def ST(t): return f'<div class="sub-title">{t}</div>'
def STS(t): return f'<div class="sub-title-sm">{t}</div>'
def IB(title, content, cls=""):
    c = f' {cls}' if cls else ''
    return f'<div class="info-box{c}"><div class="info-box-title">{title}</div><p>{content}</p></div>'
def SL(items):
    lis = ''.join(f'<li>{i}</li>' for i in items)
    return f'<ol class="step-list">{lis}</ol>'
def UL(items):
    lis = ''.join(f'<li>{i}</li>' for i in items)
    return f'<ul>{lis}</ul>'
def FG(items):
    cards = ''.join(f'<div class="feature-item"><div class="fi-title">{t}</div><div class="fi-desc">{d}</div></div>' for t,d in items)
    return f'<div class="feature-grid">{cards}</div>'
def PAGE(num, content):
    return f'<div class="page">{content}<div class="page-footer">HubSphere V3 Nirdeshika</div><div class="page-num">{num}</div></div>'
def SEC(num, title, content):
    return f'<div class="section-num">Adhyay {num:02d}</div><div class="section-title">{title}</div><div class="section-divider"></div>{content}'
def PIPE(items):
    s = ''.join(f'<div class="pipeline-stage active">{i}</div>' for i in items)
    return f'<div class="pipeline">{s}</div>'

with open('/home/z/my-project/scripts/hubsphere-guide.html', 'w', encoding='utf-8') as f:
    w(f, '<!DOCTYPE html>\n<html lang="hi">\n<head>\n<meta charset="UTF-8">\n')
    w(f, '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n')
    w(f, '<title>HubSphere V3 - Samagra Nirdeshika</title>\n')
    w(f, '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">\n')
    w(f, '<style>\n')
    w(f, '@page { size: 720px 1020px; margin: 0; }\n')
    w(f, ':root { --bg: #0f172a; --bg-card: #1e293b; --text: #e2e8f0; --text-muted: #94a3b8; --accent: #3b82f6; --accent-light: #60a5fa; --green: #10b981; --orange: #f59e0b; --red: #ef4444; --border: #334155; --font: "Inter", sans-serif; }\n')
    w(f, '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }\n')
    w(f, 'html, body { width: 720px; background: var(--bg); color: var(--text); font-family: var(--font); font-size: 13px; line-height: 1.7; -webkit-font-smoothing: antialiased; }\n')
    w(f, '@media screen { html { height: auto; display: flex; justify-content: center; background: #0b1120; } body { transform-origin: top center; margin: 20px auto; box-shadow: 0 10px 60px rgba(0,0,0,0.5); } }\n')
    w(f, '.cover { width: 720px; height: 1020px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 80px 60px; position: relative; overflow: hidden; background: linear-gradient(160deg, #0f172a 0%, #162032 40%, #1a2744 70%, #0f172a 100%); break-after: page; }\n')
    w(f, '.cover::before { content: \'\'; position: absolute; top: -80px; right: -80px; width: 400px; height: 400px; border-radius: 50%; background: radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%); }\n')
    w(f, '.cover::after { content: \'\'; position: absolute; bottom: -60px; left: -60px; width: 350px; height: 350px; border-radius: 50%; background: radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%); }\n')
    w(f, '.cover-badge { display: inline-block; background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.4); color: var(--accent-light); font-size: 10px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; padding: 8px 24px; border-radius: 20px; margin-bottom: 36px; position: relative; z-index: 1; }\n')
    w(f, '.cover-logo { width: 72px; height: 72px; background: linear-gradient(135deg, var(--accent), var(--green)); border-radius: 18px; display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: 900; color: #fff; margin-bottom: 32px; position: relative; z-index: 1; }\n')
    w(f, '.cover h1 { font-size: 48px; font-weight: 900; color: #f1f5f9; margin-bottom: 16px; line-height: 1.1; position: relative; z-index: 1; }\n')
    w(f, '.cover h1 span { color: var(--accent-light); }\n')
    w(f, '.cover-subtitle { font-size: 15px; color: var(--text-muted); font-weight: 400; margin-bottom: 40px; position: relative; z-index: 1; line-height: 1.7; }\n')
    w(f, '.cover-meta { position: relative; z-index: 1; display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; margin-bottom: 48px; }\n')
    w(f, '.cover-meta-item { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px 22px; text-align: center; }\n')
    w(f, '.cover-meta-item .val { font-size: 22px; font-weight: 800; color: #f1f5f9; display: block; }\n')
    w(f, '.cover-meta-item .lbl { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; display: block; }\n')
    w(f, '.cover-url { position: relative; z-index: 1; font-size: 13px; color: var(--accent-light); background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.25); padding: 10px 28px; border-radius: 8px; font-weight: 500; }\n')
    w(f, '.cover-line { width: 60px; height: 3px; background: linear-gradient(90deg, var(--accent), var(--green)); border-radius: 2px; margin: 0 auto 20px auto; position: relative; z-index: 1; }\n')
    w(f, '.page { width: 720px; min-height: 1020px; padding: 48px 52px 56px 52px; background: var(--bg); position: relative; break-after: page; }\n')
    w(f, '.page-num { position: absolute; bottom: 24px; right: 52px; font-size: 10px; color: var(--text-muted); font-weight: 500; }\n')
    w(f, '.page-footer { position: absolute; bottom: 24px; left: 52px; font-size: 9px; color: #475569; letter-spacing: 1px; text-transform: uppercase; }\n')
    w(f, '.section-num { font-size: 11px; font-weight: 700; color: var(--accent); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px; }\n')
    w(f, '.section-title { font-size: 26px; font-weight: 800; color: #f1f5f9; margin-bottom: 8px; line-height: 1.25; }\n')
    w(f, '.section-divider { width: 48px; height: 3px; background: var(--accent); border-radius: 2px; margin-bottom: 20px; }\n')
    w(f, '.sub-title { font-size: 16px; font-weight: 700; color: #f1f5f9; margin-top: 22px; margin-bottom: 10px; padding-left: 14px; border-left: 3px solid var(--accent); }\n')
    w(f, '.sub-title-sm { font-size: 13px; font-weight: 600; color: var(--accent-light); margin-top: 16px; margin-bottom: 8px; }\n')
    w(f, 'p { margin-bottom: 12px; color: var(--text); text-align: justify; }\n')
    w(f, 'ul, ol { margin: 0 0 14px 0; padding-left: 22px; }\n')
    w(f, 'li { margin-bottom: 5px; color: var(--text); }\n')
    w(f, 'li strong, strong { color: #f1f5f9; font-weight: 600; }\n')
    w(f, '.info-box { background: var(--bg-card); border: 1px solid var(--border); border-left: 4px solid var(--accent); border-radius: 8px; padding: 14px 16px; margin: 12px 0; }\n')
    w(f, '.info-box.green { border-left-color: var(--green); }\n')
    w(f, '.info-box.orange { border-left-color: var(--orange); }\n')
    w(f, '.info-box.red { border-left-color: var(--red); }\n')
    w(f, '.info-box-title { font-size: 11px; font-weight: 700; color: #f1f5f9; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px; }\n')
    w(f, '.info-box p { margin-bottom: 4px; font-size: 12px; }\n')
    w(f, '.step-list { counter-reset: step; list-style: none; padding-left: 0; margin: 12px 0; }\n')
    w(f, '.step-list li { counter-increment: step; padding: 7px 0 7px 40px; position: relative; border-bottom: 1px solid rgba(51,65,85,0.5); min-height: 24px; }\n')
    w(f, '.step-list li:last-child { border-bottom: none; }\n')
    w(f, '.step-list li::before { content: counter(step); position: absolute; left: 0; top: 7px; width: 24px; height: 24px; background: var(--accent); color: #fff; border-radius: 50%; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; }\n')
    w(f, '.feature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 12px 0; }\n')
    w(f, '.feature-item { background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px; }\n')
    w(f, '.feature-item .fi-title { font-size: 11px; font-weight: 700; color: #f1f5f9; margin-bottom: 4px; }\n')
    w(f, '.feature-item .fi-desc { font-size: 10.5px; color: var(--text-muted); line-height: 1.5; }\n')
    w(f, '.toc-item { display: flex; align-items: baseline; padding: 7px 0; border-bottom: 1px solid rgba(51,65,85,0.3); font-size: 12.5px; }\n')
    w(f, '.toc-num { font-weight: 700; color: var(--accent); min-width: 36px; font-size: 13px; }\n')
    w(f, '.toc-text { color: var(--text); }\n')
    w(f, '.pipeline { display: flex; gap: 4px; margin: 10px 0; flex-wrap: wrap; }\n')
    w(f, '.pipeline-stage { background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; padding: 5px 8px; font-size: 9.5px; font-weight: 600; color: var(--text); text-align: center; flex: 1; min-width: 65px; }\n')
    w(f, '.pipeline-stage.active { border-color: var(--accent); color: var(--accent-light); }\n')
    w(f, '.info-box, .feature-grid, .pipeline, .step-list li { break-inside: avoid; }\n')
    w(f, '</style>\n</head>\n<body>\n')
    
    print("CSS written")
    
    # Now write content sections one by one
    # COVER
    w(f, '<div class="cover">\n')
    w(f, '<div class="cover-badge">AI-Powered Business OS</div>\n')
    w(f, '<div class="cover-logo">HS</div>\n')
    w(f, '<div class="cover-line"></div>\n')
    w(f, '<h1>HubSphere <span>V3</span></h1>\n')
    w(f, '<div class="cover-subtitle">Samagra Nirdeshika -- Prayog Karne Ka Purna Guide<br>AI Adhisthit Vyavsay Pranali ka Step-by-Step Upyog Margdarshan</div>\n')
    w(f, '<div class="cover-meta">\n')
    w(f, '<div class="cover-meta-item"><span class="val">35</span><span class="lbl">Modules</span></div>\n')
    w(f, '<div class="cover-meta-item"><span class="val">13</span><span class="lbl">Roles</span></div>\n')
    w(f, '<div class="cover-meta-item"><span class="val">5</span><span class="lbl">AI Agents</span></div>\n')
    w(f, '<div class="cover-meta-item"><span class="val">396</span><span class="lbl">Permissions</span></div>\n')
    w(f, '</div>\n')
    w(f, '<div class="cover-url">hubspherev3.vercel.app</div>\n')
    w(f, '</div>\n')
    print("Cover written")
    
    # TOC
    w(f, PAGE(2, '<div class="section-num">Sarvangin Suchi</div><div class="section-title">Vishay-Suchi</div><div class="section-divider"></div>' + 
    ''.join(f'<div class="toc-item"><span class="toc-num">{n}</span><span class="toc-text">{t}</span></div>' for n,t in [
        ("01","HubSphere Parichaya -- Platform Ka Introduction"),
        ("02","Shuru Karne Ka Tareeqa -- Setup Wizard aur Super Admin"),
        ("03","Login aur Authentication -- 2FA, Password Change, Reset"),
        ("04","Dashboard Overview -- Main Dashboard aur Navigation"),
        ("05","CRM Module -- Leads, Contacts, Companies, Deals, Tasks"),
        ("06","CRM Bhag 2 -- Follow-ups, Telecaller, Tags, Import/Export"),
        ("07","HRMS Module -- Employees, Departments, Attendance, Leave"),
        ("08","HRMS Bhag 2 -- Field Sales, Expenses, Payroll"),
        ("09","Communication Module -- Inbox, Templates, Notifications"),
        ("10","Automation Module -- Workflows, Triggers, Actions"),
        ("11","Analytics Module -- CRM, HR, Executive, AI Analytics"),
        ("12","AI Module -- 5 AI Agents aur Chat Interface"),
        ("13","Admin Panel -- Settings, Users, Roles, Audit, Security"),
        ("14","Super Admin Panel -- Multi-tenant, Features, Health"),
        ("15","Security -- 2FA, RBAC, Rate Limiting, Audit Logging"),
    ])))
    print("TOC written")
    
    # Content will be appended in next step
    w(f, '<!-- CONTENT_PLACEHOLDER -->\n')
    w(f, '</body>\n</html>\n')
    print("Base file complete")

print("Done building base HTML")
