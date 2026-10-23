"""Testa a planilha sem script com um Google falso (Sheets + Drive + login) em memória.
Dois "celulares" (contextos separados) usam a mesma conta: o segundo acha a planilha e puxa os dados."""
import asyncio, json, re, urllib.parse
from playwright.async_api import async_playwright

FILES = {}   # id -> {name, mime, parents, sheets:{title:{'id':n,'rows':[[...]],'cols':8,'rowsN':1000}}}
SEQ = [0]
def nid(p): SEQ[0]+=1; return f'{p}{SEQ[0]}'

def col2n(c):
    n=0
    for ch in c: n=n*26+(ord(ch)-64)
    return n-1
def parse_range(r):
    r=urllib.parse.unquote(r)
    if '!' in r: t,a=r.split('!',1)
    else: t,a=r,None
    if a is None: return t,0,0,None,None
    m=re.match(r'([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?$',a)
    c1,r1,c2,r2=m.groups()
    r1=int(r1)-1 if r1 else 0
    r2=(int(r2)-1) if r2 else None
    return t,r1,col2n(c1),r2,(col2n(c2) if c2 else None)
def get_vals(sh,r1,c1,r2,c2):
    rows=sh['rows']; out=[]
    last=len(rows)-1 if r2 is None else r2
    for i in range(r1,last+1):
        row=rows[i] if i<len(rows) else []
        seg=row[c1:(c2+1 if c2 is not None else None)]
        while seg and seg[-1]=='' : seg=seg[:-1]
        out.append(seg)
    while out and not out[-1]: out.pop()
    return out
def set_vals(sh,r1,c1,values):
    rows=sh['rows']
    for i,v in enumerate(values):
        while len(rows)<=r1+i: rows.append([])
        row=rows[r1+i]
        while len(row)<c1+len(v): row.append('')
        for j,x in enumerate(v): row[c1+j]=x

async def handle(route):
    req=route.request; url=urllib.parse.urlparse(req.url); path=url.path; qs=urllib.parse.parse_qs(url.query); m=req.method
    body=json.loads(req.post_data) if req.post_data else {}
    def ok(o,status=200): return route.fulfill(status=status,content_type='application/json',body=json.dumps(o))
    if url.netloc=='sheets.googleapis.com':
        p=path[len('/v4/spreadsheets'):]
        if p=='' and m=='POST':
            sid=nid('S'); sheets={}
            for s in body.get('sheets',[]): sheets[s['properties']['title']]={'id':len(sheets),'rows':[],'cols':s['properties'].get('gridProperties',{}).get('columnCount',26),'rowsN':1000}
            FILES[sid]={'name':body['properties']['title'],'mime':'application/vnd.google-apps.spreadsheet','parents':[],'sheets':sheets}
            return await ok({'spreadsheetId':sid})
        mm=re.match(r'/([^/:]+)(.*)$',p); sid,rest=mm.groups(); f=FILES[sid]
        if rest=='' and m=='GET':
            return await ok({'sheets':[{'properties':{'sheetId':s['id'],'title':t,'gridProperties':{'rowCount':s['rowsN'],'columnCount':s['cols']}}} for t,s in f['sheets'].items()]})
        if rest==':batchUpdate':
            for rq in body['requests']:
                if 'addSheet' in rq: t=rq['addSheet']['properties']['title']; f['sheets'][t]={'id':len(f['sheets']),'rows':[],'cols':26,'rowsN':1000}
                if 'appendDimension' in rq:
                    d=rq['appendDimension']; s=[x for x in f['sheets'].values() if x['id']==d['sheetId']][0]
                    if d['dimension']=='COLUMNS': s['cols']+=d['length']
                    else: s['rowsN']+=d['length']
            return await ok({})
        if rest=='/values:batchGet':
            out=[]
            for r in qs.get('ranges',[]):
                t,r1,c1,r2,c2=parse_range(r); out.append({'range':r,'values':get_vals(f['sheets'][t],r1,c1,r2,c2)})
            return await ok({'valueRanges':out})
        if rest=='/values:batchUpdate':
            for d in body['data']:
                t,r1,c1,_,c2=parse_range(d['range']); s=f['sheets'][t]
                assert c2 is None or c2<s['cols'], ('coluna além da grade',d['range'],s['cols'])
                set_vals(s,r1,c1,d['values'])
            return await ok({})
        mm=re.match(r'/values/([^:]+)(:clear)?$',rest)
        if mm:
            t,r1,c1,r2,c2=parse_range(mm.group(1)); s=f['sheets'][t]
            if mm.group(2): s['rows']=[]; return await ok({})
            if m=='PUT': set_vals(s,r1,c1,body['values']); return await ok({})
            return await ok({'values':get_vals(s,r1,c1,r2,c2)})
        return await route.fulfill(status=404,body='?')
    if url.netloc=='www.googleapis.com' and path.startswith('/drive/v3/files'):
        p=path[len('/drive/v3/files'):]
        if p=='' and m=='GET':
            q=qs['q'][0]; res=[]
            for fid,f in FILES.items():
                if f.get('trashed'): continue
                nm=re.search(r"name='([^']*)'",q); mt=re.search(r"mimeType='([^']*)'",q); par=re.search(r"'([^']+)' in parents",q)
                if nm and f['name']!=nm.group(1): continue
                if mt and f['mime']!=mt.group(1): continue
                if par and par.group(1) not in f['parents']: continue
                res.append({'id':fid,'name':f['name'],'createdTime':f.get('created','2026-10-23T12:00:00Z'),'_o':SEQ[0] if False else fid})
            res.sort(key=lambda x:x['createdTime'],reverse=True)
            return await ok({'files':res})
        if p=='' and m=='POST':
            fid=nid('F'); FILES[fid]={'name':body['name'],'mime':body.get('mimeType'),'parents':body.get('parents',[])}; return await ok({'id':fid})
        mm=re.match(r'/([^/]+)/copy$',p)
        if mm:
            src=FILES[mm.group(1)]; fid=nid('C'); import datetime;FILES[fid]={'name':body['name'],'mime':src['mime'],'parents':body.get('parents',[]),'sheets':json.loads(json.dumps(src['sheets'])),'created':datetime.datetime.utcnow().isoformat()+'Z'}; return await ok({'id':fid})
        mm=re.match(r'/([^/]+)$',p)
        if mm and m=='DELETE': FILES.pop(mm.group(1),None); return await route.fulfill(status=204,body='')
    return await route.fulfill(status=404,body='nao simulado')

FAKE_GIS="""window.FORJA_GOOGLE_CLIENT_ID='teste.apps.googleusercontent.com';window.__semTour=true;
window.google={accounts:{oauth2:{initTokenClient:(o)=>({requestAccessToken:()=>setTimeout(()=>o.callback({access_token:'tok-'+Date.now(),expires_in:3600}),50)}),revoke:()=>{}}}};"""

async def device(p,page='index.html'):
    b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':390,'height':844}); await ctx.add_init_script(FAKE_GIS)
    pg=await ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    async def router(route):
        u=route.request.url
        if 'googleapis.com' in u and ('sheets.' in u or '/drive/' in u): return await handle(route)
        if any(k in u for k in ['fonts.g','gstatic','accounts.google','wger.de','githubusercontent']): return await route.abort()
        return await route.continue_()
    await pg.route('**/*',router)
    await pg.goto('http://localhost:8766/'+page); await pg.wait_for_timeout(2500)
    return b,pg,errs

async def main():
    async with async_playwright() as p:
        b1,a,e1=await device(p)
        await a.evaluate("Forja3.addWater(500)"); await a.wait_for_timeout(400)
        await a.evaluate("(async()=>{const arr=await loadBody();arr.push({id:'w1',date:todayKey(),time:'08:00',type:'weight',period:'manha',value:'82,4'});await saveBody(arr);})()")
        await a.evaluate("switchTab('mais')"); await a.wait_for_timeout(500)
        await a.screenshot(path='/home/claude/shots3/gs-0.png')
        btn=await a.query_selector('#gsync-box .f3-cta'); await btn.scroll_into_view_if_needed(); await btn.click(); await a.wait_for_timeout(4000)
        st=await a.evaluate("document.getElementById('sheet-sync-status').textContent")
        print('A status:',st)
        await (await a.query_selector('#sheet-sync-card')).screenshot(path='/home/claude/shots3/gs-1.png')
        sheets=[f for f in FILES.values() if f['mime']=='application/vnd.google-apps.spreadsheet']
        print('planilhas:',[(f['name'],list(f['sheets'].keys()),len(f['sheets']['dados']['rows'])) for f in sheets])
        print('pastas/backups:',[(k,v['name']) for k,v in FILES.items() if v['mime']!='application/vnd.google-apps.spreadsheet' or v['parents']])
        # segundo celular
        b2,c,e2=await device(p)
        await c.evaluate("switchTab('mais')"); await c.wait_for_timeout(400)
        await c.click('#gsync-box .f3-cta'); await c.wait_for_timeout(4000)
        print('B status:',await c.evaluate("document.getElementById('sheet-sync-status').textContent"))
        print('B banner:',await c.evaluate("!!document.getElementById('sheet-sync-banner')"))
        await c.reload(); await c.wait_for_timeout(2500)
        water=await c.evaluate("(async()=>{const a=await loadBody();return [a.filter(e=>e.type==='water').reduce((s,e)=>s+waterMl(e),0),a.filter(e=>e.type==='weight').map(e=>e.value)]})()")
        print('B recebeu (água ml, pesos):',water)
        # B lança comida e sincroniza; A puxa
        await c.evaluate("ForjaDietBridge.saveQuick({description:'Iogurte',kcal:150,protein_g:10,mealType:'lanche',mealNumber:1})"); await c.wait_for_timeout(500)
        await c.evaluate("ForjaSheetSync.syncNow({interactive:true})"); await c.wait_for_timeout(3000)
        await a.evaluate("ForjaSheetSync.syncNow({interactive:true})"); await a.wait_for_timeout(3000)
        await a.reload(); await a.wait_for_timeout(2500)
        diet=await a.evaluate("(async()=>{await loadDietCache();return dietCache.map(e=>e.description)})()")
        print('A recebeu comida:',diet)
        # sem token (simula 1h depois): auto-sync pede toque
        await a.evaluate("ForjaGoogleDirect.signOut()"); r=await a.evaluate("ForjaSheetSync.syncNow({auto:true})")
        chip=await a.evaluate("!!document.getElementById('sync-tap-chip')")
        print('sem token ->',r,'chip:',chip)
        peso=[f for f in FILES.values() if f['mime']=='application/vnd.google-apps.spreadsheet' and 'Peso' in f['sheets']]
        print('aba Peso legível:',peso[0]['sheets']['Peso']['rows'][:2] if peso else None)
        print('erros:',e1,e2)
        await b1.close(); await b2.close()
asyncio.run(main())
