import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { linkDemoOrders } from "@/lib/orders/link-demo";
import { createOrderService } from "@/lib/orders/order-service";
import { seedCatalog } from "@/prisma/seed-catalog";
import { DEMO_ORDERS, DEMO_USER, DEMO_USER_B, seedDemoData } from "@/prisma/seed-demo";
import { readCatalogJson } from "./helpers";
import { createTestAuth, signIn } from "./test-auth";
import { createTestClient, resetDatabase } from "./test-db";

// Extension "Historia użytkownika": fixture orders of two fictional users, read through real sessions.
const client = createTestClient();
const auth = createTestAuth(client);
afterAll(() => client.$disconnect());

const serviceFor = (headers: Headers) =>
  createOrderService({ getSession: () => auth.api.getSession({ headers }), getClient: () => client });

let historyA: ReturnType<typeof serviceFor>;
let historyB: ReturnType<typeof serviceFor>;

beforeEach(async () => {
  await resetDatabase(client);
  await seedCatalog(client, readCatalogJson());
  await seedDemoData(client);
  historyA = serviceFor(await signIn(auth, DEMO_USER.id));
  historyB = serviceFor(await signIn(auth, DEMO_USER_B.id));
});

const numbersOf = (userId: string) =>
  DEMO_ORDERS.filter((o) => o.userId === userId)
    .sort((x, y) => y.placedAt.localeCompare(x.placedAt))
    .map((o) => o.number);

describe("own orders only", () => {
  it("each user sees only their own orders, newest first", async () => {
    const a = await historyA.getMyOrders();
    const b = await historyB.getMyOrders();
    expect(a.signedIn && a.orders.map((o) => o.number)).toEqual(numbersOf(DEMO_USER.id));
    expect(b.signedIn && b.orders.map((o) => o.number)).toEqual(numbersOf(DEMO_USER_B.id));
  });

  it("swapping in B's order number gives A the same answer as a missing number", async () => {
    expect(await historyA.getMyOrder("ZAM-2026-0005")).toEqual({ signedIn: true, order: null });
    expect(await historyA.getMyOrder("ZAM-2026-9999")).toEqual({ signedIn: true, order: null });
    expect(await historyA.getMyOrder("../ZAM-2026-0005")).toEqual({ signedIn: true, order: null });
    expect((await historyB.getMyOrder("ZAM-2026-0005")).signedIn).toBe(true);
    const own = await historyB.getMyOrder("ZAM-2026-0005");
    expect(own.signedIn && own.order?.number).toBe("ZAM-2026-0005");
  });

  it("without a session there is no history at all", async () => {
    const anonymous = serviceFor(new Headers());
    expect(await anonymous.getMyOrders()).toEqual({ signedIn: false });
    expect(await anonymous.getMyOrder("ZAM-2026-0001")).toEqual({ signedIn: false });
  });
});

describe("history does not change with the catalog", () => {
  it("keeps stored names and prices after a product price/name change", async () => {
    const before = await historyB.getMyOrder("ZAM-2026-0006");
    await client.product.update({ where: { id: 60 }, data: { price: 1, name: "Nowa nazwa" } });
    expect(await historyB.getMyOrder("ZAM-2026-0006")).toEqual(before);
  });

  it("keeps the line after the product is deleted (SetNull + snapshot)", async () => {
    const before = await historyB.getMyOrder("ZAM-2026-0005");
    await client.product.delete({ where: { id: 40 } });
    const after = await historyB.getMyOrder("ZAM-2026-0005");
    expect(after.signedIn && after.order?.lines[0]).toMatchObject({ productId: null });
    const snapshot = (o: typeof before) =>
      o.signedIn && o.order?.lines.map((l) => [l.productCode, l.productName, l.unitPrice, l.quantity, l.lineTotal]);
    expect(snapshot(after)).toEqual(snapshot(before));
  });
});

describe("linkDemoOrders (local script)", () => {
  it("moves fixture orders to a real GitHub user, only in a controlled way", async () => {
    await client.user.create({ data: { id: "real", name: "Real", email: "real@example.com" } });
    await expect(linkDemoOrders(client, DEMO_USER_B.id, "real@example.com")).rejects.toThrow(/no GitHub account/);
    await expect(linkDemoOrders(client, DEMO_USER_B.id, "missing@example.com")).rejects.toThrow(/No user/);

    await client.account.create({
      data: { id: "acc", accountId: "42", providerId: "github", userId: "real", updatedAt: new Date() },
    });
    expect(await linkDemoOrders(client, DEMO_USER_B.id, "real@example.com")).toEqual(["ZAM-2026-0005", "ZAM-2026-0006"]);

    const real = serviceFor(await signIn(auth, "real"));
    const mine = await real.getMyOrders();
    expect(mine.signedIn && mine.orders).toHaveLength(2);
    const b = await historyB.getMyOrders();
    expect(b.signedIn && b.orders).toEqual([]);
  });
});
