import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createCartService } from "@/lib/cart/cart-service";
import { createPrismaClient } from "@/lib/prisma-client";
import { makeProduct } from "../fixtures";
import { insertProducts } from "./helpers";
import { cartServiceFor, createTestAuth, signIn, USER_A, USER_B } from "./test-auth";
import { createTestClient, resetDatabase } from "./test-db";

// Protected layer: the service gets only request headers, exactly like the app. The owner is what
// auth.api.getSession verifies in the Session table — not a userId passed by the test.
const client = createTestClient();
const auth = createTestAuth(client);
afterAll(() => client.$disconnect());

let headersA: Headers;
let headersB: Headers;

beforeEach(async () => {
  await resetDatabase(client);
  await client.user.createMany({ data: [USER_A, USER_B] });
  await insertProducts(client, [makeProduct({ id: 1, amount: 10 }), makeProduct({ id: 2, amount: 10 })]);
  headersA = await signIn(auth, USER_A.id);
  headersB = await signIn(auth, USER_B.id);
});

const cartRows = () =>
  client.cartItem.findMany({ orderBy: { id: "asc" }, include: { cart: { select: { userId: true } } } });

const itemIdOf = async (userId: string, productId: number) =>
  (await client.cartItem.findFirstOrThrow({ where: { productId, cart: { userId } } })).id;

describe("login and an empty cart", () => {
  it("a fresh session sees an empty cart with total 0", async () => {
    expect(await cartServiceFor(auth, client, headersA).getMyCart()).toEqual({
      signedIn: true,
      cart: { lines: [], total: BigInt(0), units: 0 },
    });
  });

  it("the owner is taken from the session: the same call with B's cookie writes into B's cart", async () => {
    await cartServiceFor(auth, client, headersA).addProduct(1);
    await cartServiceFor(auth, client, headersB).addProduct("2");
    expect((await cartRows()).map((r) => [r.cart.userId, r.productId])).toEqual([
      [USER_A.id, 1],
      [USER_B.id, 2],
    ]);
  });
});

describe("no session, fake cookie, revoked or expired session", () => {
  const mutations = async (service: ReturnType<typeof cartServiceFor>, itemId: number) => [
    await service.addProduct(1),
    await service.setQuantity(itemId, 5),
    await service.removeItem(itemId),
  ];

  async function expectDenied(headers: Headers) {
    const itemId = await itemIdOf(USER_A.id, 1);
    const before = await cartRows();
    const service = cartServiceFor(auth, client, headers);
    for (const result of await mutations(service, itemId)) {
      expect(result).toMatchObject({ ok: false, error: "unauthenticated" });
    }
    expect(await service.getMyCart()).toEqual({ signedIn: false });
    expect(await cartRows()).toEqual(before); // nothing changed in the database
  }

  beforeEach(async () => {
    await cartServiceFor(auth, client, headersA).addProduct(1);
  });

  it("rejects a direct call without any cookie", async () => {
    await expectDenied(new Headers());
  });

  it("rejects a fake (unsigned / wrongly signed) session cookie", async () => {
    const [name] = (headersA.get("cookie") ?? "").split("=");
    await expectDenied(new Headers({ cookie: `${name}=forged-token.forged-signature` }));
    const token = (await client.session.findFirstOrThrow({ where: { userId: USER_A.id } })).token;
    await expectDenied(new Headers({ cookie: `${name}=${token}` })); // a real token without the signature
  });

  it("rejects a session revoked in the database (cookie still present)", async () => {
    await client.session.deleteMany({ where: { userId: USER_A.id } });
    await expectDenied(headersA);
  });

  it("rejects an expired session", async () => {
    await client.session.updateMany({ where: { userId: USER_A.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expectDenied(headersA);
  });

  it("rejects the old cookie after sign-out, but keeps the cart; a new login restores it", async () => {
    await auth.api.signOut({ headers: headersA });
    await expectDenied(headersA);

    const again = cartServiceFor(auth, client, await signIn(auth, USER_A.id));
    const my = await again.getMyCart();
    expect(my.signedIn && my.cart.lines.map((l) => [l.productId, l.quantity])).toEqual([[1, 1]]);
  });
});

describe("user A and the data of user B", () => {
  it("swapping in B's item id gives A the same refusal as a missing id; B's cart stays unchanged", async () => {
    const serviceA = cartServiceFor(auth, client, headersA);
    await serviceA.addProduct(1);
    await cartServiceFor(auth, client, headersB).addProduct(2);
    const itemOfB = await itemIdOf(USER_B.id, 2);
    const before = await cartRows();

    const foreign = [await serviceA.setQuantity(itemOfB, 7), await serviceA.removeItem(itemOfB)];
    const missing = [await serviceA.setQuantity(2_000_000, 7), await serviceA.removeItem(2_000_000)];
    expect(foreign).toEqual(missing);
    for (const result of foreign) expect(result).toMatchObject({ ok: false, error: "item_not_found" });

    expect(await cartRows()).toEqual(before);
    const my = await serviceA.getMyCart();
    expect(my.signedIn && my.cart.lines.map((l) => l.productId)).toEqual([1]); // A never reads B's lines
  });

  it("ignores any owner, cart id, price or total smuggled into the input", async () => {
    const serviceA = cartServiceFor(auth, client, headersA);
    const smuggled = { productId: 2, userId: USER_B.id, cartId: 1, price: 1, total: 1 };
    expect(await serviceA.addProduct(smuggled)).toMatchObject({ ok: false, error: "invalid_product_id" });
    expect(await client.cartItem.count()).toBe(0);
  });
});

describe("invalid data does not change the cart", () => {
  it.each([0, -1, 1.5, 100, "0", "abc", "", null])("setQuantity(%j) is rejected", async (quantity) => {
    const service = cartServiceFor(auth, client, headersA);
    await service.addProduct(1);
    const before = await cartRows();
    expect(await service.setQuantity(await itemIdOf(USER_A.id, 1), quantity)).toMatchObject({
      ok: false,
      error: "invalid_quantity",
      field: "quantity",
    });
    expect(await cartRows()).toEqual(before);
  });

  it.each([0, -5, 1.5, "1e3", "x", 2147483648])("addProduct(%j) is rejected", async (productId) => {
    expect(await cartServiceFor(auth, client, headersA).addProduct(productId)).toMatchObject({
      ok: false,
      error: "invalid_product_id",
    });
    expect(await client.cart.count()).toBe(0);
  });

  it("quantity above the stock is rejected with a field error", async () => {
    const service = cartServiceFor(auth, client, headersA);
    await service.addProduct(1);
    expect(await service.setQuantity(await itemIdOf(USER_A.id, 1), 11)).toMatchObject({
      ok: false,
      error: "insufficient_stock",
      field: "quantity",
    });
  });
});

describe("persistence and failure", () => {
  it("keeps the cart across a new client (restart) and a new session", async () => {
    await cartServiceFor(auth, client, headersA).addProduct(1);
    const restarted = createTestClient();
    try {
      const service = cartServiceFor(createTestAuth(restarted), restarted, await signIn(auth, USER_A.id));
      const my = await service.getMyCart();
      expect(my.signedIn && my.cart.units).toBe(1);
    } finally {
      await restarted.$disconnect();
    }
  });

  it("an unreachable database gives a safe error, never an empty cart or a raw ORM message", async () => {
    const down = createPrismaClient("postgresql://shop:x@127.0.0.1:1/unreachable_test");
    const logError = vi.fn();
    try {
      const service = createCartService({
        getSession: async () => ({ user: { id: USER_A.id } }),
        getClient: () => down,
        logError,
      });
      const result = await service.addProduct(1);
      expect(result).toEqual({ ok: false, error: "unavailable", message: expect.not.stringMatching(/prisma|ECONN|127/i) });
      expect(logError).toHaveBeenCalledOnce();
      expect(logError).toHaveBeenCalledWith("cart.addProduct", expect.anything());
      await expect(service.getMyCart()).rejects.toThrow();
    } finally {
      await down.$disconnect();
    }
  });
});
