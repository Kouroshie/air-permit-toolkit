"""Build the guide PDFs in docs/ from the HTML sources in docs/src/.

Usage (from anywhere):  python tools/build_docs_pdf.py
Needs Google Chrome or Microsoft Edge. Fonts load from Google Fonts, so stay online.
"""
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_methods_pdf import find_browser  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'docs' / 'src'
DOCS = ['Guided_Tour', 'Worked_Example_Checks', 'Sources', 'Project_Anatomy']


def main():
    browser = find_browser()
    for name in DOCS:
        out = ROOT / 'docs' / f'{name}.pdf'
        subprocess.run([browser, '--headless=new', '--disable-gpu', '--no-pdf-header-footer',
                        '--virtual-time-budget=8000', f'--print-to-pdf={out}', (SRC / f'{name}.html').as_uri()],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(f'Wrote {out.name} ({out.stat().st_size:,} bytes)')


if __name__ == '__main__':
    main()
