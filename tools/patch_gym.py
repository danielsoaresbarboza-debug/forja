import re,sys
p='gym-ui.js'; s=open(p).read()

def find_func(name):
    m=re.search(r'^(async )?function '+re.escape(name)+r'\(',s,re.M)
    if not m: raise SystemExit('nao achei '+name)
    start=m.start()
    # fim: próxima linha que começa em coluna 0 com function/async function/let/const/// ===/if(root
    nxt=re.compile(r'^(async function |function |let |const |// =|if\(root|return\{)',re.M)
    m2=nxt.search(s,m.end())
    return start,(m2.start() if m2 else len(s))

def replace_func(name,code):
    global s
    a,b=find_func(name)
    s=s[:a]+code.rstrip()+'\n'+s[b:]

def remove_func(name):
    replace_func(name,'')

def sub(old,new,count=1):
    global s
    if old not in s: raise SystemExit('trecho ausente: '+old[:80])
    s=s.replace(old,new,count)

new_funcs=open('tools/gym3.js').read()
for name in re.findall(r'^(?:async )?function (\w+)\(',new_funcs,re.M):
    if re.search(r'^(async )?function '+name+r'\(',s,re.M):
        remove_func(name)
# insere o bloco novo antes do REST TIMER antigo (que foi removido parcialmente) -> antes do RPE
anchor='// ================= RPE MODAL ================='
sub(anchor,new_funcs+'\n'+anchor)
open(p,'w').write(s)
print('ok')
