with open('/home/z/my-project/scripts/pdf-gen-v2/report.py', 'rb') as f:
    content = f.read()
lines = content.split('\n')
new_lines = []
i = 0
merge_next = False
while i < len(lines):
    line = lines[i]
    if merge_next:
        new_lines[-1] = new_lines[-1].rstrip() + ' ' + line.lstrip()
        merge_next = False
        continue
    stripped = line.rstrip()
    if stripped.endswith('s_body)'):
        new_lines.append(stripped)
        merge_next = True
    else:
        new_lines.append(line)
    i += 1
with open('/home/z/my-project/scripts/pdf-gen-v2/report.py', 'w') as f:
    f.write('\n'.join(new_lines))
print('Fixed')
