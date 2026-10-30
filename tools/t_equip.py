"""Biblioteca e "Adicionar exercício" com filtro de equipamento (Halteres, Barra, Máquina…) e foto animada."""
import asyncio
from playwright.async_api import async_playwright
S='/home/claude/shots3'
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch();ctx=await b.new_context(viewport={'width':390,'height':844},device_scale_factor=2)
    await ctx.add_init_script("window.__semTour=true;")
    pg=await ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    await pg.route('**/*',lambda r:r.abort() if any(k in r.request.url for k in ['googleapis','gstatic','accounts.google','wger.de','fonts.g']) else r.continue_())
    await pg.goto('http://localhost:8766/index.html');await pg.wait_for_timeout(2500)
    await pg.evaluate("switchTab('biblioteca')");await pg.wait_for_timeout(600)
    await pg.click('#tab-biblioteca .filter-chip[data-lib-filter="Peito"]');await pg.wait_for_timeout(800)
    print('chips:',await pg.evaluate("[...document.querySelectorAll('#lib-equip-row .eq-chip')].map(b=>b.textContent.trim())"))
    print('seções:',await pg.evaluate("[...document.querySelectorAll('#lib-catalog-list .eq-sec')].map(b=>b.textContent.trim())"))
    await pg.evaluate("document.querySelector('#lib-equip-row').scrollIntoView()");await pg.wait_for_timeout(300)
    await pg.screenshot(path=f'{S}/eq1-peito.png')
    await pg.click('#lib-equip-row .eq-chip:has-text("Halteres")');await pg.wait_for_timeout(800)
    print('halteres:',await pg.evaluate("document.getElementById('lib-catalog-hint').textContent"),await pg.evaluate("[...document.querySelectorAll('#lib-catalog-list .ex-chip .lbl')].slice(0,6).map(e=>e.textContent)"))
    await pg.evaluate("document.querySelector('#lib-equip-row').scrollIntoView()");await pg.wait_for_timeout(1500)
    await pg.screenshot(path=f'{S}/eq2-halteres.png')
    await pg.click('#lib-catalog-list .ex-chip >> nth=0');await pg.wait_for_timeout(1500)
    print('detalhe animado:',await pg.evaluate("!!document.querySelector('#lib-detail-card .mov')"),await pg.evaluate("document.querySelector('#lib-detail-card .calc-formula-note:nth-of-type(2)')?.textContent||''"))
    await (await pg.query_selector('#lib-detail-card')).screenshot(path=f'{S}/eq3-detalhe.png')
    # no treino
    await pg.evaluate("switchTab('academia')");await pg.wait_for_timeout(600)
    await pg.evaluate("ForjaGymUI.startFreeWorkout?ForjaGymUI.startFreeWorkout():ForjaGymUI.startWorkoutSession()");await pg.wait_for_timeout(800)
    await pg.evaluate("ForjaGymUI.openPickerForAdd()");await pg.wait_for_timeout(800)
    btn=await pg.query_selector('#picker-card .filter-chip[data-filter="Costas"]')
    if btn:
      await btn.click();await pg.wait_for_timeout(800)
      print('picker chips:',await pg.evaluate("[...document.querySelectorAll('#picker-equip-row .eq-chip')].map(b=>b.textContent.trim())"))
      await pg.click('#picker-equip-row .eq-chip:has-text("Barra")');await pg.wait_for_timeout(500)
      print('picker barra:',await pg.evaluate("document.querySelectorAll('#picker-catalog-list .ex-chip').length"))
    else: print('sem filtro Costas no picker')
    print('erros:',errs);await b.close()
asyncio.run(main())
