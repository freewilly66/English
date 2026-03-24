from __future__ import annotations
import os
import re


files: list[str] = [
    'js/state.js',
    'js/utils.js',
    'js/api.js',
    'js/price_api.js',
    'js/portfolio.js',
    'js/dashboard.js',
    'js/app.js',
    'js/main.js'
]

bundle_parts: list[str] = ["// Standalone Bundle to avoid Chrome file:// CORS issues\n\n"]


for f in files:
    with open(f, 'r') as fp:
        lines: list[str] = fp.read().split('\n')
        out_lines: list[str] = []

        in_import = False
        for line in lines:
            stripped = line.strip()
            if stripped.startswith('import '):
                if 'from ' not in stripped:
                    in_import = True
                continue
            if in_import:
                if 'from ' in stripped:
                    in_import = False
                continue
            
            if line.startswith('export default '):
                line = line.replace('export default ', '', 1)
            elif line.startswith('export '):
                line = line.replace('export ', '', 1)
                
            out_lines.append(line)
        
        bundle_parts.append(f"\n// --- {f} ---\n")
        bundle_parts.append('\n'.join(out_lines) + '\n')


bundle: str = "".join(bundle_parts)

with open('js/bundle.js', 'w') as fp:
    fp.write(bundle)

with open('index.html', 'r') as fp:
    html = fp.read()

html = re.sub(r'<script type="module" src="js/main.js.*?></script>', '<script src="js/bundle.js"></script>', html)

with open('index.html', 'w') as fp:
    fp.write(html)
