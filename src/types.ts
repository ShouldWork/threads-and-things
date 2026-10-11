export type Sale = { id?: string; date: string; listed: string; brand: string; cat: string; size: string; desc: string; price: number; ship: number; depopFee: number; payFee: number; boost: number; usps: number; refund: number; feeBack: number; cogs: number; state: string; sku: string; platform: string; tax: number; buyer?: string };
export type Listing = { id?: string; cat: string; size: string; desc: string; orig: number | null; price: number; posted: string; exact: boolean; boosted: boolean; link: string; status: string };
export type Item = { id?: string; sku: string; acquired: string; source: string; cost: number; cat: string; size: string; brand: string; desc: string; platform: string; listed: string; status: string; outcome: string; notes: string };
export type Expense = { id?: string; date: string; cat: string; vendor: string; desc: string; amount: number; paidWith: string; receipt: boolean; notes: string };
export type Trip = { id?: string; date: string; purpose: string; miles: number };
export type TimeRow = { id?: string; date: string; activity: string; minutes: number; notes: string };
export type Issue = { id?: string; date: string; sku: string; platform: string; type: string; lost: number; resolved: boolean; what: string; next: string };
// Settings live on the shop document itself: shops/{shopId}
export type Settings = { name: string; mileageRate: number; taxPct: number; snapshot: string; shopStart: string; goalMonthly: number };

export type Data = { sales: Sale[]; listings: Listing[]; inventory: Item[]; expenses: Expense[]; mileage: Trip[]; time: TimeRow[]; issues: Issue[]; settings: Settings };

export const DEFAULT_SETTINGS: Settings = { name: "Sierra", mileageRate: 0.7, taxPct: 0.25, snapshot: new Date().toISOString().slice(0, 10), shopStart: "2026-08-01", goalMonthly: 0 };

export const LISTS = {
  categories: ["Bottoms","Tops","Dresses","Accessories","Footwear","Coats and jackets","Home","Fancy dress","Nightwear","Suits","Jumpsuits and playsuits","Clothing bundles","Bags","Jewelry","Swimwear","Other"],
  sizes: ["XXS","XS","S","M","L","XL","XXL","3XL","One size","0","2","4","6","8","10","12","14","16","24","25","26","27","28","29","30","31","32","Kids","Other"],
  sources: ["Own closet","Friends/family (free)","Thrift store","Garage/estate sale","Online lot","Retail clearance","Other"],
  platforms: ["Depop","Poshmark","Mercari","eBay","Facebook Marketplace","Local/in person","Other"],
  itemStatus: ["Unlisted","Listed","Sold","Bundled","Donated","Kept","Returned to me","Lost/damaged"],
  activities: ["Sourcing","Photographing","Listing","Messaging buyers","Packing/shipping","Post office run","Admin/bookkeeping","Other"],
  issueTypes: ["Refund issued","Return","Case opened","Lost package","Damaged in transit","Buyer complaint","Cancelled order","Other"],
  expenseCats: ["Inventory (COGS)","Packing supplies","Shipping/postage","Gas/mileage","Platform fees (other)","Business formation/LLC","Software/apps","Equipment","Photography/props","Other"],
  paidWith: ["Business checking","Business card","Personal (reimburse)","Cash"],
};
