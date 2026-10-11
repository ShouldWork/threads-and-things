// Phone-focused checks. Runs on Chromium and, via the iphone-webkit project, on WebKit with iPhone 14 emulation.
// Ask AI uses the demo stand-in (test/ai.mock.ts): no network, no AI allowance.
import {test,expect,type Page} from '@playwright/test';
const go=async(page:Page,tab:string)=>page.getByRole('navigation',{name:'Sections'}).getByRole('button',{name:tab,exact:true}).click();

test('Ask AI answers from the summary and shows an honest error',async({page})=>{
  await page.goto('http://127.0.0.1:5173');
  await page.getByRole('button',{name:'Help me refresh my oldest listing'}).click();
  await expect(page.locator('.answer .asked')).toHaveText('Help me refresh my oldest listing');
  await expect(page.locator('.answer-body')).toContainText('Demo answer');
  await expect(page.locator('.answer-body .ans-label')).toHaveText('Suggested Title:');
  await page.getByLabel('Your question').fill('fail demo');await page.getByRole('button',{name:'Ask',exact:true}).click();
  await expect(page.locator('.answer .err')).toHaveText(/on its end/);
});

// The demo AI holds a "slow demo" answer until the test releases it, so these do not depend on machine speed.
const askSlow=async(page:Page)=>{await page.getByLabel('Your question').fill('slow demo');await page.getByRole('button',{name:'Ask',exact:true}).click();await page.waitForFunction(()=>typeof (window as unknown as {__releaseAsk?:unknown}).__releaseAsk==='function');};
const releaseAnswer=(page:Page)=>page.evaluate(()=>(window as unknown as {__releaseAsk:()=>void}).__releaseAsk());

test('an AI question keeps going when she switches tabs, and the answer is waiting on Home',async({page})=>{
  await page.goto('http://127.0.0.1:5173');await askSlow(page);
  await expect(page.locator('.thinking')).toBeVisible();
  await go(page,'Sales');await expect(page.getByRole('heading',{name:'Sales',exact:true})).toBeVisible();
  await releaseAnswer(page);
  await expect(page.locator('.toast')).toHaveText('Your AI answer is ready on Home.');
  await go(page,'Home');
  await expect(page.locator('.answer .asked')).toHaveText('slow demo');
  await expect(page.locator('.answer-body')).toContainText('Demo answer');
});

test('switching back to Home mid-question still shows it is working',async({page})=>{
  await page.goto('http://127.0.0.1:5173');await askSlow(page);
  await go(page,'Closet');await go(page,'Home');
  await expect(page.locator('.thinking')).toBeVisible();
  await releaseAnswer(page);
  await expect(page.locator('.answer-body')).toContainText('Demo answer');
});

test('Home shortcuts open the right form directly, without the picker',async({page})=>{
  await page.goto('http://127.0.0.1:5173');
  await page.locator('.quick').getByRole('button',{name:'Log a sale'}).click();
  await expect(page.getByRole('dialog',{name:'Add sale'})).toBeVisible();
  await expect(page.getByRole('dialog',{name:'What happened?'})).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.locator('.todo',{hasText:'No time logged yet'}).getByRole('button',{name:'Go'}).click();
  await expect(page.getByRole('dialog',{name:'Add time'})).toBeVisible();
});

test('a Depop listing can be given a storage spot, then found by chip or search',async({page})=>{
  await page.goto('http://127.0.0.1:5173');await go(page,'Closet');
  const first=page.locator('.card .row').first();const desc=(await first.locator('.desc').innerText()).trim();
  await first.locator('.rowbtn').click();
  await page.getByRole('dialog').getByLabel("Where it's stored").fill('Bin 1');
  await page.getByRole('dialog').getByRole('button',{name:'Save changes'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('group',{name:"Where it's stored"}).getByRole('button',{name:'Bin 1'}).click();
  await expect(page.locator('.card .row')).toHaveCount(1);
  await expect(page.locator('.card .row')).toContainText(desc.slice(0,20));
  await expect(page.locator('.card .row .pill.spot')).toHaveText('Bin 1');
  await page.getByRole('group',{name:"Where it's stored"}).getByRole('button',{name:'Anywhere'}).click();
  await page.getByLabel('Search').fill('bin 1');await expect(page.locator('.card .row')).toHaveCount(1);
});

test('marking a listing sold logs the sale, shows it under Sold and in Sales with its bin, and deleting the sale restores it',async({page})=>{
  await page.goto('http://127.0.0.1:5173');await go(page,'Closet');
  const before=await page.getByRole('button',{name:/^On Depop \(/}).innerText();
  const first=page.locator('.card .row').first();const desc=(await first.locator('.desc').innerText()).trim();
  await first.locator('.rowbtn').click();
  const dlg=page.getByRole('dialog');
  await dlg.getByLabel("Where it's stored").fill('Bin 7');
  await dlg.getByLabel('Status').selectOption('Sold');
  await dlg.getByRole('button',{name:'Save changes'}).click();
  // The sale form opens prefilled and linked.
  await expect(page.getByRole('dialog',{name:'Add sale'})).toBeVisible();
  await expect(page.getByRole('dialog').getByLabel('Description')).toHaveValue(desc.split('\n')[0].length>5?new RegExp(desc.slice(0,15).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')):/./);
  await expect(page.getByRole('dialog').locator('.linknote')).toContainText('Bin 7');
  await page.getByRole('dialog').getByRole('button',{name:'Add',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.getByRole('button',{name:/^On Depop \(/}).innerText()).not.toBe(before);
  await page.getByRole('button',{name:/^Sold \(/}).click();
  await expect(page.locator('.card .row').first()).toContainText(desc.slice(0,20));
  await expect(page.locator('.card .row').first().locator('.pill.spot')).toHaveText('Bin 7');
  await expect(page.locator('.card .row').first().locator('.pill.good')).toContainText('Sold');
  await go(page,'Sales');
  const saleRow=page.locator('.rowbtn',{hasText:desc.slice(0,20)}).first();
  await expect(saleRow.locator('.pill.spot')).toHaveText('Bin 7');
  await saleRow.click();await page.getByRole('button',{name:'Delete',exact:true}).click();await page.getByRole('button',{name:'Yes, delete'}).click();
  await go(page,'Closet');
  expect(await page.getByRole('button',{name:/^On Depop \(/}).innerText()).toBe(before);
});

test('Log sale keeps an unsaved bin, saves the sale and links it to the listing',async({page})=>{
  await page.goto('http://127.0.0.1:5173');await go(page,'Closet');
  const first=page.locator('.card .row').first();const desc=(await first.locator('.desc').innerText()).trim();
  await first.locator('.rowbtn').click();
  const dlg=page.getByRole('dialog');
  const btn=dlg.getByRole('button',{name:'Log sale',exact:true}),save=dlg.getByRole('button',{name:'Save changes'});
  const [b,s]=[await btn.boundingBox(),await save.boundingBox()];
  expect(b && s && Math.abs(b.height-s.height)).toBeLessThanOrEqual(2); // same size as Save changes
  expect(b && s && Math.abs(b.y-s.y)).toBeLessThanOrEqual(4);           // same row
  await dlg.getByLabel("Where it's stored").fill('Bin 9');                // typed, NOT saved
  await btn.click();
  await expect(page.getByRole('dialog',{name:'Add sale'})).toBeVisible();
  await expect(dlg.getByLabel('Description')).toHaveValue(new RegExp('^'+desc.slice(0,15).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  await expect(dlg.locator('.linknote')).toContainText('Bin 9');          // the draft was saved before the hand-off
  await dlg.getByRole('button',{name:'Add',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:/^Sold \(/}).click();
  const sold=page.locator('.card .row',{hasText:desc.slice(0,20)}).first();
  await expect(sold.locator('.pill.spot')).toHaveText('Bin 9');await expect(sold.locator('.pill.good')).toContainText('Sold');
  await go(page,'Sales');
  await expect(page.locator('.rowbtn',{hasText:desc.slice(0,20)}).first().locator('.pill.spot')).toHaveText('Bin 9');
});

test('Sales can be narrowed to Today, This month or All sales, and future-dated sales stay out',async({page})=>{
  await page.goto('http://127.0.0.1:5173');
  const [today,tomorrow,lastMonth]=await page.evaluate(()=>{const f=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;const n=new Date();return [f(n),f(new Date(n.getFullYear(),n.getMonth(),n.getDate()+1)),f(new Date(n.getFullYear(),n.getMonth()-1,1))];});
  for(const [desc,price,date] of [['Sold today tee','12',today],['Future dated tee','99',tomorrow],['Last month tee','7',lastMonth]]){
    await page.locator('.quick').getByRole('button',{name:'Log a sale'}).click();
    const dlg=page.getByRole('dialog');
    await dlg.getByLabel('Date sold').fill(date);await dlg.getByLabel('Description').fill(desc);await dlg.getByLabel('Item price').fill(price);
    await dlg.getByRole('button',{name:'Add',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await go(page,'Sales');
  const period=page.getByRole('group',{name:'Sales period'}),rows=page.locator('.card .rowbtn');
  const gross=page.locator('.kpi',{hasText:'Gross'}).locator('.v');
  await period.getByRole('button',{name:'Today'}).click();
  await expect(period.getByRole('button',{name:'Today'})).toHaveAttribute('aria-pressed','true');
  await expect(rows).toHaveCount(1);await expect(rows.first()).toContainText('Sold today tee');await expect(gross).toHaveText('$12');
  await period.getByRole('button',{name:'This month'}).click();
  await expect(rows.filter({hasText:'Sold today tee'})).toHaveCount(1);
  await expect(rows.filter({hasText:'Last month tee'})).toHaveCount(0);await expect(rows.filter({hasText:'Future dated tee'})).toHaveCount(0);
  await period.getByRole('button',{name:'All sales'}).click();
  await page.getByLabel('Search sales').fill('tee');
  await expect(rows.filter({hasText:'Last month tee'})).toHaveCount(1);await expect(rows.filter({hasText:'Sold today tee'})).toHaveCount(1);
  await expect(rows.filter({hasText:'Future dated tee'})).toHaveCount(0);  // same rule as Home and the AI
});

test('cancelling the sale form after marking a listing Sold still leaves a Log sale button on it',async({page})=>{
  await page.goto('http://127.0.0.1:5173');await go(page,'Closet');
  const first=page.locator('.card .row').first();const desc=(await first.locator('.desc').innerText()).trim();
  await first.locator('.rowbtn').click();
  await page.getByRole('dialog').getByLabel('Status').selectOption('Sold');
  await page.getByRole('dialog').getByRole('button',{name:'Save changes'}).click();
  await expect(page.getByRole('dialog',{name:'Add sale'})).toBeVisible();
  await page.getByRole('dialog').getByRole('button',{name:'Cancel'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:/^Sold \(/}).click();
  await page.locator('.card .row',{hasText:desc.slice(0,20)}).first().locator('.rowbtn').click();
  await page.getByRole('dialog').getByRole('button',{name:'Log sale',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Add sale'})).toBeVisible();
});

test('a listing set to Removed can be found and put back on the rack',async({page})=>{
  await page.goto('http://127.0.0.1:5173');await go(page,'Closet');
  const first=page.locator('.card .row').first();const desc=(await first.locator('.desc').innerText()).trim();
  await first.locator('.rowbtn').click();
  await page.getByRole('dialog').getByLabel('Status').selectOption('Removed');
  await page.getByRole('dialog').getByRole('button',{name:'Save changes'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:/^Removed \(/}).click();
  await page.locator('.card .row',{hasText:desc.slice(0,20)}).first().locator('.rowbtn').click();
  await page.getByRole('dialog').getByLabel('Status').selectOption('Active');
  await page.getByRole('dialog').getByRole('button',{name:'Save changes'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:/^On Depop \(/}).click();
  await expect(page.locator('.card .row',{hasText:desc.slice(0,20)})).toHaveCount(1);
});

test('inventory location can be set and filtered',async({page})=>{
  await page.goto('http://127.0.0.1:5173');
  for(const [desc,spot] of [['Lace cami','Bin 3'],['Levi jeans','Closet shelf']]){
    await page.getByRole('button',{name:'Add something'}).click();
    await page.getByRole('dialog').getByRole('button',{name:'Inventory item',exact:true}).click();
    await page.getByRole('dialog').getByLabel('Description').fill(desc);
    await page.getByRole('dialog').getByLabel("Where it's stored").fill(spot);
    await page.getByRole('dialog').getByRole('button',{name:'Add',exact:true}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await go(page,'Closet');await page.getByRole('button',{name:/^Inventory/}).click();
  await expect(page.locator('.card .row')).toHaveCount(2);
  await page.getByRole('group',{name:"Where it's stored"}).getByRole('button',{name:'Bin 3'}).click();
  await expect(page.locator('.card .row')).toHaveCount(1);
  await expect(page.locator('.card .row')).toContainText('Lace cami');
});

test('appearance choice applies and survives a reload',async({page})=>{
  await page.emulateMedia({colorScheme:'dark'});
  await page.goto('http://127.0.0.1:5173');
  await go(page,'More');
  await page.getByRole('group',{name:'Appearance'}).getByRole('button',{name:'Light'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  expect(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor)).toBe('rgb(255, 251, 252)');
  await go(page,'More');await page.getByRole('group',{name:'Appearance'}).getByRole('button',{name:'Match phone'}).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme',/./);
});

test('import buttons are real buttons a keyboard can reach',async({page})=>{
  await page.goto('http://127.0.0.1:5173');await go(page,'More');
  const button=page.getByRole('button',{name:'Choose export file'});
  await button.focus();await expect(button).toBeFocused();
});

test('the profit help tip opens, is not clipped, and closes with Escape',async({page})=>{
  await page.goto('http://127.0.0.1:5173');
  const hero=page.locator('.kpi.hero');await hero.getByRole('button',{name:'What does this mean?'}).click();
  const pop=hero.locator('.pop');await expect(pop).toBeVisible();
  expect(await hero.evaluate(el=>getComputedStyle(el).overflow)).toBe('visible');
  await page.keyboard.press('Escape');await expect(pop).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(0);
});
