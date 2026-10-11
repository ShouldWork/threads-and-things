import { describe, it, expect } from "vitest";
import { net, median, days, weekOf, newSku, isKids, isPlus, money } from "../src/lib/calc";
import type { Sale } from "../src/types";

const sale = (o: Partial<Sale>): Sale => ({ date: "", listed: "", brand: "", cat: "", size: "", desc: "", price: 0, ship: 0, depopFee: 0, payFee: 0, boost: 0, usps: 0, refund: 0, feeBack: 0, cogs: 0, state: "", sku: "", platform: "Depop", tax: 0, ...o });

describe("calc", () => {
  it("net payout ignores buyer-paid shipping (pass-through to the label) and subtracts fees, label, refunds", () => {
    expect(net(sale({ price: 25.5, ship: 3.99, payFee: 1.51 }))).toBeCloseTo(23.99, 10);
    expect(net(sale({ price: 20, payFee: 1, boost: 2.4, usps: 4, refund: 5, feeBack: 1 }))).toBeCloseTo(8.6, 10);
  });
  it("median", () => { expect(median([3, 1, 2])).toBe(2); expect(median([4, 1, 2, 3])).toBe(2.5); expect(median([])).toBeNaN(); });
  it("days between ISO dates", () => { expect(days("2026-10-01", "2026-10-10")).toBe(9); });
  it("weekOf returns the Monday", () => { expect(weekOf("2026-10-10")).toBe("2026-10-05"); expect(weekOf("2026-10-05")).toBe("2026-10-05"); });
  it("newSku skips taken numbers", () => { expect(newSku([])).toBe("TT-0001"); expect(newSku(["TT-0001", "TT-0002"])).toBe("TT-0003"); expect(newSku(["TT-0002"])).toBe("TT-0003"); });
  it("size helpers", () => { expect(isKids("Kids")).toBe(true); expect(isKids("6 years")).toBe(true); expect(isKids("M")).toBe(false); expect(isPlus("XL")).toBe(true); expect(isPlus("L")).toBe(false); });
  it("money", () => { expect(money(1234.5)).toBe("$1,234.50"); expect(money(-3)).toBe("-$3.00"); expect(money(10, 0)).toBe("$10"); });
});
