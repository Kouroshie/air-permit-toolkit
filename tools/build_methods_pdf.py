"""Build docs/Air_Permit_Toolkit_Methods.pdf from METHODS.md.

Usage (from anywhere):  python tools/build_methods_pdf.py
Needs Python 3 and Google Chrome or Microsoft Edge (headless print to PDF). No other packages.
The Markdown converter handles only what METHODS.md uses: headings, paragraphs, pipe tables,
bulleted and numbered lists (with indented continuation), **bold** and `code`.
"""
import html
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'METHODS.md'
OUT = ROOT / 'docs' / 'Air_Permit_Toolkit_Methods.pdf'
LIST_RE = re.compile(r'(- |\d+\. )')
CSS = ('body{font:11pt/1.5 Georgia,serif;max-width:7in;margin:auto}'
       'table{border-collapse:collapse;margin:8px 0;font-size:9.5pt}'
       'td,th{border:1px solid #999;padding:3px 6px;text-align:left}'
       'h1{font-size:18pt}h2{font-size:14pt;margin-top:18pt}h3{font-size:12pt}'
       'code{font-size:9.5pt}li{margin-bottom:4px}')


def inline(text):
    text = html.escape(text, quote=False)
    text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
    return re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', text)


def list_item(parts):
    paras = [p for p in '\n'.join(parts).split('\n\n') if p.strip()]
    first = inline(paras[0].replace('\n', ' ').strip())
    rest = ''.join(f'<p>{inline(p.replace(chr(10), " ").strip())}</p>' for p in paras[1:])
    return first + rest


def to_html(md_text):
    lines = md_text.split('\n')
    out, title, i = [], '', 0
    while i < len(lines):
        s = lines[i].strip()
        if not s:
            i += 1
            continue
        m = re.match(r'(#{1,3}) (.*)', s)
        if m:
            n = len(m.group(1))
            out.append(f'<h{n}>{inline(m.group(2))}</h{n}>')
            title = title or m.group(2)
            i += 1
            continue
        if s.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                rows.append([c.strip() for c in lines[i].strip().strip('|').split('|')])
                i += 1
            head = rows[0]
            body = [r for r in rows[1:] if not re.fullmatch(r'[-:]+', r[0])]
            out.append('<table><tr>' + ''.join(f'<th>{inline(c)}</th>' for c in head) + '</tr>'
                       + ''.join('<tr>' + ''.join(f'<td>{inline(c)}</td>' for c in r) + '</tr>' for r in body)
                       + '</table>')
            continue
        if LIST_RE.match(s):
            tag = 'ol' if s[0].isdigit() else 'ul'
            items = []
            while i < len(lines):
                t = lines[i]
                if LIST_RE.match(t.strip()) and not t.startswith('   '):
                    items.append([LIST_RE.sub('', t.strip(), count=1)])
                elif t.startswith('   ') and items:
                    items[-1].append(t.strip())
                elif not t.strip() and i + 1 < len(lines) and (
                        lines[i + 1].startswith('   ') or LIST_RE.match(lines[i + 1].strip())):
                    items[-1].append('')
                else:
                    break
                i += 1
            out.append(f'<{tag}>' + ''.join(f'<li>{list_item(p)}</li>' for p in items) + f'</{tag}>')
            continue
        para = []
        while i < len(lines) and lines[i].strip() and not re.match(r'(#|\||- |\d+\. )', lines[i].strip()):
            para.append(lines[i].strip())
            i += 1
        out.append(f'<p>{inline(" ".join(para))}</p>')
    return (f'<!doctype html><meta charset="utf-8"><title>{html.escape(title)}</title>'
            f'<style>{CSS}</style>' + '\n'.join(out))


def find_browser():
    candidates = [
        os.environ.get('CHROME'),
        r'C:\Program Files\Google\Chrome\Application\chrome.exe',
        r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
        r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ] + [shutil.which(n) for n in ('google-chrome', 'chromium', 'chromium-browser', 'chrome', 'msedge')]
    for c in candidates:
        if c and Path(c).exists():
            return c
    sys.exit('Chrome or Edge not found. Set the CHROME environment variable to its path.')


def main():
    page = to_html(SRC.read_text(encoding='utf-8'))
    OUT.parent.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        src_html = Path(tmp) / 'methods.html'
        src_html.write_text(page, encoding='utf-8')
        before = OUT.stat().st_mtime if OUT.exists() else 0
        subprocess.run([find_browser(), '--headless=new', '--disable-gpu', '--no-pdf-header-footer',
                        f'--print-to-pdf={OUT}', src_html.as_uri()],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if not OUT.exists() or OUT.stat().st_mtime == before:
        sys.exit('PDF was not written.')
    print(f'Wrote {OUT} ({OUT.stat().st_size:,} bytes)')


if __name__ == '__main__':
    main()
