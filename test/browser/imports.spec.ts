import {test,expect,type Page} from '@playwright/test';
import * as XLSX from 'xlsx';
async function confirm(page:Page,word:string){await page.getByLabel(`Type ${word} to confirm`).fill(word);await page.getByRole('button',{name:'Confirm data changes',exact:true}).click();await expect(page.getByRole('region',{name:'Confirm data changes'})).toHaveCount(0);}
async function emptyShop(page:Page){await page.goto('http://127.0.0.1:5173/#more');await page.getByRole('button',{name:'Reset shop data',exact:true}).click();await confirm(page,'RESET SHOP');}
async function csv(page:Page,body:string){await page.locator('input[type=file][accept=".xlsx,.xls,.csv"]').setInputFiles({name:'sales.csv',mimeType:'text/csv',buffer:Buffer.from(body)});await expect(page.getByRole('region',{name:'Review import'})).toBeVisible();}
async function apply(page:Page){await page.getByRole('button',{name:'Import these changes',exact:true}).click();await expect(page.getByRole('region',{name:'Review import'})).toHaveCount(0);}
async function tracker(page:Page,notes:string,tax?:number){const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['SKU','Date acquired','Description','Cost paid','Notes'],['TT-1','2026-09-01','Blue shirt',5,notes]]),'Inventory');if(tax!==undefined)XLSX.utils.book_append_sheet(wb,{B29:{t:'n',v:tax},'!ref':'A1:B29'},'Dashboard');await page.locator('input[type=file][accept=".xlsx"]').setInputFiles({name:'tracker.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:XLSX.write(wb,{type:'buffer',bookType:'xlsx'})});await expect(page.getByRole('region',{name:'Review import'})).toBeVisible();await apply(page);}
test('a full sales export updates financial fields and can be repeated without doubling totals',async({page})=>{
  await emptyShop(page);const header='Date of sale,Item price,Description,Sale ID,Payment fee,Refund\n';
  await csv(page,header+'2026-10-01,20,Blue shirt,tx-1,1,0\n');await apply(page);
  await csv(page,header+'2026-10-01,25,Blue shirt,tx-1,2,3\n');await expect(page.getByRole('region',{name:'Review import'})).toContainText('0 new; 1 updated');await apply(page);
  await csv(page,header+'2026-10-01,25,Blue shirt,tx-1,2,3\n');await expect(page.getByRole('region',{name:'Review import'})).toContainText('0 new; 0 updated; 1 unchanged');await apply(page);
  await expect(page.locator('.pillstat')).toContainText('1 sold');
});
test('ambiguous legacy matches require a choice which is remembered on repeat import',async({page})=>{
  await emptyShop(page);
  await csv(page,'Date of sale,Item price,Description,SKU,Brand\n2026-10-01,20,Blue shirt,TT-1,Acme\n');await apply(page);
  const thin='Date of sale,Item price,Description\n2026-10-01,20,Blue shirt\n';
  await csv(page,thin);await expect(page.getByRole('button',{name:'Import these changes'})).toBeDisabled();await page.getByLabel('Match for sales row 1').selectOption({index:1});await apply(page);
  await csv(page,thin);await expect(page.getByLabel('Match for sales row 1')).toHaveCount(0);await apply(page);await expect(page.locator('.pillstat')).toContainText('1 sold');
});
test('inventory imports preserve app notes and costs, and reset can be undone or restored from backup',async({page},testInfo)=>{
  await emptyShop(page);await tracker(page,'Imported note');
  await page.getByRole('navigation',{name:'Sections'}).getByRole('button',{name:'Closet',exact:true}).click();await page.getByRole('button',{name:/Inventory \(1\)/}).click();await page.getByRole('button',{name:/Blue shirt.*TT-1/}).click();
  await page.getByLabel('Notes',{exact:true}).fill('My permanent note');await page.getByLabel('Cost paid',{exact:true}).fill('9');await page.getByRole('button',{name:'Save changes'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('navigation',{name:'Sections'}).getByRole('button',{name:'More',exact:true}).click();await tracker(page,'Older spreadsheet note');
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download full backup'}).click();const download=await downloadPromise;const backup=testInfo.outputPath('backup.json');await download.saveAs(backup);
  await page.getByRole('button',{name:'Reset shop data'}).click();await confirm(page,'RESET SHOP');await expect(page.getByRole('row',{name:'inventory 0',exact:true})).toBeVisible();
  await page.locator('button:enabled').filter({hasText:'Undo this operation'}).click();await confirm(page,'UNDO');await expect(page.getByRole('row',{name:'inventory 1',exact:true})).toBeVisible();
  await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles(backup);await confirm(page,'RESTORE');
  await page.getByRole('navigation',{name:'Sections'}).getByRole('button',{name:'Closet',exact:true}).click();await page.getByRole('button',{name:/Inventory \(1\)/}).click();await page.getByRole('button',{name:/Blue shirt.*TT-1/}).click();await expect(page.getByLabel('Notes',{exact:true})).toHaveValue('My permanent note');await expect(page.getByLabel('Cost paid',{exact:true})).toHaveValue('9');
});
test('clear imported sales preserves manual sales and later edits disable undo',async({page})=>{
  await emptyShop(page);await csv(page,'Date of sale,Item price,Description,Sale ID\n2026-10-01,20,Imported shirt,tx-1\n');await apply(page);
  await page.getByRole('button',{name:'Add something'}).click();await page.getByRole('dialog').getByRole('button',{name:'Sale',exact:true}).click();await page.getByLabel('Description',{exact:true}).fill('Manual sale');await page.getByLabel('Item price',{exact:true}).fill('10');await page.getByRole('dialog').getByRole('button',{name:'Add',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('button:enabled').filter({hasText:'Undo this operation'})).toHaveCount(0);
  await page.getByRole('button',{name:'Clear imported sales',exact:true}).click();await confirm(page,'CLEAR SALES');await expect(page.locator('.pillstat')).toContainText('1 sold');
});
test('existing duplicate sales can be reviewed and consolidated with a recovery snapshot',async({page})=>{
  await emptyShop(page);const header='Date of sale,Item price,Description\n',row='2026-10-01,20,Blue shirt\n';
  await csv(page,header+row+row);await page.getByLabel('Match for sales row 2').selectOption('new');await apply(page);await expect(page.locator('.pillstat')).toContainText('2 sold');
  await page.getByRole('button',{name:'Consolidate these 2 sales'}).click();await confirm(page,'MERGE');await expect(page.locator('.pillstat')).toContainText('1 sold');
  await csv(page,header+row);await expect(page.getByRole('region',{name:'Review import'})).toContainText('0 new; 0 updated; 1 unchanged');await apply(page);await expect(page.locator('.pillstat')).toContainText('1 sold');
});
test('tracker settings do not silently replace tax settings entered in the app',async({page})=>{
  await emptyShop(page);await tracker(page,'Source note',0.4);await expect(page.getByLabel('Tax set-aside %',{exact:true})).toHaveValue('25');
});
