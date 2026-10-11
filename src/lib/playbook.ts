export type Tip={h:string,b:string,src?:string};
export type Group={title:string,note:string,items:Tip[]};
export const PLAYBOOK: Group[] = [
 {title:"Fees and pricing", note:"Platform rules are solid. Everything else is seller experience.", items:[
  {h:"What Depop takes (US)", b:"No selling fee. Card processing is 3.3% of the buyer's total (item, shipping, tax) plus $0.45 flat per sale. Boost adds 12% of the item price if the buyer bought within 28 days of seeing the boosted listing. Her export matches these exactly.", src:"Depop fee policy via OneCart, Nifty"},
  {h:"The $0.45 flat fee punishes cheap items", b:"On a $4 item with $4 shipping, processing is about 18% of the price. On a $15 item it is about 7%. Add a boost and a $4 item gives up roughly 30% before packing and gas. Raise prices or bundle cheap items."},
  {h:"Price from sold comps", b:"Search what similar items actually sold for, not what they are listed at. One seller's rule: average of the last 5 comparable sales minus 10%, then drop 5% after 10 unsold days. Gentler than 40% markdowns in the first week.", src:"Closo, Woman & Home"},
  {h:"Decide your floor before offers arrive", b:"Know the lowest number you will accept on each item so offers get a quick yes or no. Likes are not intent: one Poshmark seller found only 22% of liked items ever sold.", src:"Woman & Home, Closo"},
 ]},
 {title:"Listings that sell", note:"Depop's own guidance plus the most repeated seller advice.", items:[
  {h:"Title and first line: brand, item, style, size", b:"Example: \"Levi's 501 straight leg jeans, 30x32\". Depop says keywords and standout features are what get a listing found in search. Her best listings already do this.", src:"Depop via Woman & Home, Nifty"},
  {h:"Use all 8 photo slots", b:"Front, back, brand tag, fabric label, any flaw, one detail shot. Natural daylight. Show flaws on purpose: Depop's spokesperson said nobody expects preloved items to be perfect, and hidden flaws cause disputes.", src:"Nifty, Woman & Home"},
  {h:"Flat measurements in inches", b:"Pit to pit, waist, inseam, length. Vintage and modern sizes differ, and measurements cut returns and the back-and-forth questions.", src:"Nifty"},
  {h:"3 to 5 hashtags, no more", b:"Depop caps tags at 5 and irrelevant tags risk suspension. Use 3 or 4 item tags (type, material, fit) and at most 2 style tags (#y2k, #cottagecore) only when the item really fits. Do not paste the same tag block on every listing.", src:"Nifty hashtags guide"},
  {h:"Reply within a couple of hours", b:"Fast answers with measurements close sales. Unsourced, but every guide repeats it.", src:"Nifty"},
 ]},
 {title:"Refreshing, boosting, timing", note:"Her own data agrees with the skeptical sellers.", items:[
  {h:"Refresh instead of relisting", b:"Open a listing, tap Edit, save. The date updates and likes stay. Deleting and relisting resets likes. Advice on how often ranges from daily to 2 to 4 times a week; one seller found daily bumping backfired, and some warn bulk edits can look automated.", src:"ExportYourStore, Closo"},
  {h:"Boost is a tax, not a strategy", b:"One seller tracked 18 months: 12% more views, flat profit. Her shop: boosted items sold in a median 4.5 days vs 4 for unboosted. Boost only higher-priced items that are already getting likes, if at all.", src:"Closo"},
  {h:"Evenings, and the start of the month", b:"7 to 10 pm is the window most guides name. One seller's 90 days: Monday 8 to 10 pm for likes, Friday 9 to 11 pm for sales. Her best days are Wednesday, Friday, Monday. Treat this as a test, not a fact.", src:"ExportYourStore, Closo"},
  {h:"Wait 30 days before relisting", b:"Depop recommends at least 30 days before deleting and relisting the same item. Change the price, photos, or description when you do.", src:"Nifty, ExportYourStore"},
 ]},
 {title:"Shipping and packing", note:"Shipping is the cost that quietly eats cheap items.", items:[
  {h:"Depop label vs your own", b:"The Depop label is prepaid USPS Ground Advantage, priced by the weight tier you pick. Weigh the packed item; underestimating the tier causes overage charges and account risk. Typical US labels run $5 to $15, heavier items $14 and up.", src:"Vendoo"},
  {h:"Free shipping sells more, but do the math", b:"Depop's own data (per Vendoo) says free shipping makes a sale 10% more likely. Build it into the price. Be careful on bundles: one seller paid $21 to ship a $13 coat plus a $10 top.", src:"Vendoo"},
  {h:"Skip the tissue paper", b:"Poly mailers for clothing, boxes for shoes. A handwritten thank-you note is the cheap personal touch. Ship within 3 days and always use tracking. Keep every payment inside the app.", src:"Nifty, Vendoo, Woman & Home"},
 ]},
 {title:"Other apps worth adding", note:"Each marketplace has its own buyer. Crosslisting the right items is the biggest lever after pricing.", items:[
  {h:"Which items go where", b:"Depop: Y2K, 90s, vintage, streetwear, buyers mostly under 26. Poshmark: brand-name women's casualwear, athleisure, shoes, bags. eBay: vintage, men's, jackets, anything odd or long-tail. Mercari: general goods, toys, home, quick cheap sales. Facebook Marketplace: bulky items and local pickup. Her kids clothes are a Mercari or local-bundle fit, not a Depop fit.", src:"Underpriced, Closo"},
  {h:"Fees by platform", b:"Poshmark 20% over $15, flat $2.95 at $14.99 and under. Mercari about 10%. eBay about 13.6% plus $0.40. Facebook Marketplace 10% on shipped orders, 0% local. Depop 0% plus processing. Poshmark is only worth it for items that sell fast and above $15.", src:"Underpriced, Closo"},
  {h:"Poshmark needs daily sharing", b:"Visibility depends on sharing your closet and others' listings, about 15 to 30 minutes a day. First like averaged 1.4 hours, first offer 2.8 days for one seller. Businesswear and fast-fashion basics sit.", src:"Closo"},
  {h:"Crosslisting rules", b:"Start with 2 or 3 platforms. One master SKU on every listing and on the item. Delist everywhere the moment something sells, before packing, or you will double-sell. Manual is fine under about 50 listings; tools like Vendoo, Crosslist, or List Perfectly pay off past 100.", src:"Underpriced"},
  {h:"Batch the work", b:"Photo day, listing day, shipping day. Review which platforms actually sell every two weeks and drop the noisy ones.", src:"Underpriced"},
 ]},
];

