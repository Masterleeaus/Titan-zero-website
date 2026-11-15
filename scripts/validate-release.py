#!/usr/bin/env python3
"""No-network static release sanity check; never changes deployment targets."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit
import sys
root=Path(__file__).resolve().parents[1]
required=("index.html","pricing/index.html","tools/index.html","frontdeskpro/index.html","frontdeskai/index.html","frontdeskagent/index.html","sitemap.xml")
errors=[]
for rel in required:
    if not (root/rel).is_file(): errors.append(f"missing {rel}")
class Links(HTMLParser):
    def __init__(self): super().__init__(); self.urls=[]
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        if tag in ("a","link","script","img","source"):
            for k in ("href","src"):
                if d.get(k): self.urls.append(d[k])
checked=0
for page in list(root.rglob("index.html"))+list((root/"pages").glob("*.html")):
    if ".git" in page.parts or "node_modules" in page.parts: continue
    try: content=page.read_text(encoding="utf-8")
    except UnicodeDecodeError: errors.append(f"invalid UTF-8: {page}"); continue
    if "<main" not in content or "</main>" not in content: errors.append(f"missing main: {page.relative_to(root)}")
    p=Links();p.feed(content)
    for url in p.urls:
        s=urlsplit(url)
        if s.scheme or s.netloc or not s.path.startswith("/") or s.path.startswith("//"): continue
        path=unquote(s.path).lstrip("/")
        target=root/path
        if path.endswith("/") or not target.suffix: target=target/"index.html"
        if not target.is_file(): errors.append(f"{page.relative_to(root)}: broken local {url}")
        checked+=1
print(f"Validated {len(list(root.rglob('index.html')))} clean-URL pages, {checked} internal references")
for e in errors[:60]: print("ERROR:",e,file=sys.stderr)
if len(errors)>60: print(f"... {len(errors)-60} more errors",file=sys.stderr)
sys.exit(bool(errors))
