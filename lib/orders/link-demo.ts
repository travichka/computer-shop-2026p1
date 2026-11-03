import type { PrismaClient } from "@/lib/generated/prisma/client";

// Local demonstration helper (no public form or API): moves the orders of a fictional demo user
// to a real account that has signed in with GitHub, so the history can be shown for real users.

export class LinkOrdersError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LinkOrdersError";
  }
}

/**
 * Reassigns all orders of `fixtureUserId` to the auth user with `email`. The target must exist and
 * have a GitHub account (created by Better Auth on login). One transaction; returns moved numbers.
 */
export async function linkDemoOrders(client: PrismaClient, fixtureUserId: string, email: string): Promise<string[]> {
  return client.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { email },
      select: { id: true, accounts: { where: { providerId: "github" }, select: { id: true } } },
    });
    if (target === null) throw new LinkOrdersError(`No user with e-mail ${email} — sign in with GitHub first.`);
    if (target.accounts.length === 0) throw new LinkOrdersError(`User ${email} has no GitHub account.`);
    if (target.id === fixtureUserId) throw new LinkOrdersError("The target is the fixture user itself.");

    const orders = await tx.order.findMany({ where: { userId: fixtureUserId }, select: { number: true } });
    await tx.order.updateMany({ where: { userId: fixtureUserId }, data: { userId: target.id } });
    return orders.map((order) => order.number);
  });
}
