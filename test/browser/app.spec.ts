import {test,expect} from '@playwright/test';
test('all pages load and expense logs can be added, edited and deleted',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173');await expect(page.getByRole('heading',{name:/^Hi /})).toBeVisible();
  for(const name of ['Sales','Closet','Plan','Learn','More']){await page.getByRole('navigation',{name:'Sections'}).getByRole('button',{name,exact:true}).click();await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();}
  await page.getByRole('button',{name:'Add something'}).click();await page.getByRole('dialog').getByRole('button',{name:'Expense',exact:true}).click();
  await page.getByLabel('Amount',{exact:true}).fill('8');await page.getByLabel('What was it',{exact:true}).fill('Test mailers');await page.getByRole('dialog').getByRole('button',{name:'Add',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);await page.getByRole('button',{name:/Test mailers/}).click();
  await page.getByLabel('Amount',{exact:true}).fill('9');await page.getByRole('button',{name:'Save changes'}).click();await expect(page.getByRole('button',{name:/Test mailers.*\$9.00/})).toBeVisible();
  await page.getByRole('button',{name:/Test mailers/}).click();await page.getByRole('button',{name:'Delete',exact:true}).click();await page.getByRole('button',{name:'Yes, delete'}).click();await expect(page.getByRole('button',{name:/Test mailers/})).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('lists can show all records through pagination',async({page})=>{
  await page.goto('http://127.0.0.1:5173/#closet');await expect(page.getByRole('button',{name:/Show more/})).toBeVisible();await page.getByRole('button',{name:/Show more/}).click();await expect(page.getByRole('button',{name:/Show more/})).toHaveCount(0);
  await expect(page.locator('.card .row')).toHaveCount(175);
});
test('form labels work, negative values are rejected, and modal focus is contained',async({page})=>{
  await page.goto('http://127.0.0.1:5173');await page.getByRole('button',{name:'Add something'}).click();await page.getByRole('dialog').getByRole('button',{name:'Mileage',exact:true}).click();
  await page.getByLabel('Miles (round trip)').fill('-5');await page.getByRole('button',{name:'Add',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
  const last=page.getByRole('dialog').getByRole('button',{name:'Cancel'});await last.focus();await page.keyboard.press('Tab');await expect(page.getByRole('dialog').getByRole('button',{name:'Close'})).toBeFocused();
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('an installed production app shell reloads while offline',async({page,context})=>{
  // No login or production writes. Only the cached login shell is exercised.
  await page.goto('http://127.0.0.1:4173');await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.reload();await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();
  await context.setOffline(true);await page.reload();await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();
});
