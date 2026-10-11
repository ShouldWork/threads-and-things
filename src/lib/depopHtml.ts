import type { Listing } from "../types";
// Parses a saved "Selling hub > Active" page from depop.com (Save as "Webpage, Complete").
export function parseDepopListingsHtml(html: string, shopStart: string): Listing[] {
  const start = Date.parse(shopStart);
  const parts = html.split('<li class="styles-module__r33SmW__container">').slice(1);
  const seen = new Set<string>(); const out: Listing[] = [];
  const dec = (s: string) => { const t = document.createElement("textarea"); t.innerHTML = s; return t.value; };
  for (const li of parts) {
    const slug = /products\/([^/"]+)\/manage/.exec(li); if (!slug || seen.has(slug[1])) continue; seen.add(slug[1]);
    const lab = /<input[^>]*aria-label="([^"]*)"/.exec(li); const label = lab ? dec(lab[1]) : "";
    const cat = /r33SmW__category">([^<]*)</.exec(li); const size = /r33SmW__overflowText">([^<]*)</.exec(li);
    const prices = [...li.matchAll(/US\$([\d.,]+)/g)].map(m => parseFloat(m[1].replace(/,/g, "")));
    const dt = /(Listed|Last updated) on (\d{1,2} \w{3} \d{4})/.exec(li);
    let posted = shopStart, exact = false;
    if (dt) { const d = Date.parse(dt[2]); if (dt[1] === "Listed") { posted = new Date(d).toISOString().slice(0, 10); exact = true; } else { posted = new Date(start + (d - start) / 2).toISOString().slice(0, 10); } }
    out.push({ cat: cat ? dec(cat[1]) : "", size: size ? dec(size[1]) : "", desc: label.includes(" - ") ? label.split(" - ").slice(1).join(" - ") : label, orig: prices.length > 1 ? prices[0] : null, price: prices.length ? prices[prices.length - 1] : 0, posted, exact, boosted: li.includes("boostViewsText"), link: `https://www.depop.com/products/${slug[1]}/`, status: "Active" });
  }
  return out.map(row=>({...row,sourceData:JSON.stringify(Object.fromEntries(Object.entries(row).filter(([key])=>row.exact || !['posted','exact'].includes(key))))}));
}
