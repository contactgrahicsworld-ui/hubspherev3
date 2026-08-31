import os
from pypdf import PdfReader, PdfWriter

A4_W, A4_H = 595.28, 841.89
cover_pdf_path = '/home/z/my-project/download/cover.pdf'
body_pdf_path = '/home/z/my-project/download/report_body.pdf'
output_path = '/home/z/my-project/download/HUBSPHERE_V3_PRODUCTION_READINESS_REPORT.pdf'

writer = PdfWriter()
cover_reader = PdfReader(cover_pdf_path)
body_reader = PdfReader(body_pdf_path)

for page in cover_reader.pages:
    box = page.mediabox
    w, h = float(box.width), float(box.height)
    if abs(w - A4_W) > 2 or abs(h - A4_H) > 2:
        page.scale_to(A4_W, A4_H)
    writer.add_page(page)

for page in body_reader.pages:
    writer.add_page(page)

writer.add_metadata({
    '/Title': 'HubSphere V3 - Production & Sales Readiness Report',
    '/Author': 'Quality Engineering Team',
    '/Subject': '18-Phase Production Verification',
    '/Creator': 'HubSphere QA System',
})

with open(output_path, 'wb') as f:
    writer.write(f)

print(f'Final PDF: {output_path}')
print(f'Pages: {len(writer.pages)}')
print('Done!')