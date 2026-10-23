"""Monta as duas versões para o Netlify a partir do mesmo código.
   dist/forja-treino-3.0.0/      -> versão completa (Daniel)
   dist/forja-essencial-3.0.0/   -> variante Essencial (Pietra)
Uso: python3 tools/build.py"""
import json, os, shutil, re, zipfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VER = re.search(r"CURRENT_VERSION='([^']+)'", open(os.path.join(ROOT, 'changelog.js')).read()).group(1)
SKIP = {'tools', 'dist', '.git', 'index-ess.html'}
NETLIFY = """[[headers]]
  for = "/index.html"
  [headers.values]
    Cache-Control = "no-cache"
[[headers]]
  for = "/service-worker.js"
  [headers.values]
    Cache-Control = "no-cache"
[[headers]]
  for = "/"
  [headers.values]
    Cache-Control = "no-cache"
"""

def copy_tree(dst):
    if os.path.exists(dst): shutil.rmtree(dst)
    os.makedirs(dst)
    for name in os.listdir(ROOT):
        if name in SKIP or name.startswith('.'): continue
        src = os.path.join(ROOT, name)
        if os.path.isdir(src): shutil.copytree(src, os.path.join(dst, name))
        else: shutil.copy2(src, os.path.join(dst, name))
    open(os.path.join(dst, 'netlify.toml'), 'w').write(NETLIFY)

def zipdir(folder):
    z = folder + '.zip'
    with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as zf:
        for base, _, files in os.walk(folder):
            for f in files:
                p = os.path.join(base, f)
                zf.write(p, os.path.relpath(p, folder))
    return z

dist = os.path.join(ROOT, 'dist'); os.makedirs(dist, exist_ok=True)
full = os.path.join(dist, f'forja-treino-{VER}')
copy_tree(full)

ess = os.path.join(dist, f'forja-essencial-{VER}')
copy_tree(ess)
idx = open(os.path.join(ess, 'index.html')).read()
idx = idx.replace('<body data-forja-variant="shared">', '<body data-forja-variant="essencial">', 1)
idx = idx.replace('<title>Forja.Treino</title>', '<title>Forja.Essencial</title>', 1)
idx = idx.replace('content="Forja.Treino"', 'content="Forja.Essencial"', 1)
assert 'data-forja-variant="essencial"' in idx
open(os.path.join(ess, 'index.html'), 'w').write(idx)
# Mesmo endereço base no GitHub Pages (usuario.github.io): a variante guarda os dados num espaço próprio.
def troca(arq, pares):
    caminho = os.path.join(ess, arq); txt = open(caminho).read()
    for a, b in pares:
        assert a in txt, (arq, a); txt = txt.replace(a, b)
    open(caminho, 'w').write(txt)
troca('local-db.js', [("indexedDB.open('forja-treino',1)", "indexedDB.open('forja-essencial',1)")])
troca('app.js', [("'forjatreino:'", "'forjaessencial:'"), ("'forjatreino-mirror:'", "'forjaessencial-mirror:'"), ("'forja-reminders-db'", "'forja-essencial-reminders-db'")])
troca('service-worker.js', [("'forja-reminders-db'", "'forja-essencial-reminders-db'"), ("const CACHE_PREFIX = 'forja-shell-';", "const CACHE_PREFIX = 'forja-essencial-shell-';")])
man = json.load(open(os.path.join(ess, 'manifest.webmanifest')))
man.update({'id': '/essencial', 'name': 'Forja.Essencial', 'short_name': 'Forja', 'description': 'Comida, água, atividade e peso: o panorama das calorias do dia.'})
json.dump(man, open(os.path.join(ess, 'manifest.webmanifest'), 'w'), ensure_ascii=False, indent=1)

for f in (full, ess): print(zipdir(f), round(os.path.getsize(f + '.zip') / 1e6, 1), 'MB')
