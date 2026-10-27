-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Order" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT NOT NULL,
    "total" BIGINT NOT NULL,
    "placedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER,
    "productCode" VARCHAR(10) NOT NULL,
    "productName" TEXT NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lineTotal" BIGINT NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_number_key" ON "Order"("number");

-- CreateIndex
CREATE INDEX "Order_userId_placedAt_idx" ON "Order"("userId", "placedAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Custom SQL (extension "Historia zamówień"). Prices in whole grosze; line totals and order
-- totals are int8, so unitPrice (int4) × quantity and their sum cannot overflow.
-- ---------------------------------------------------------------------------
ALTER TABLE "OrderItem"
  ADD CONSTRAINT "order_item_quantity_positive"
  CHECK ("quantity" > 0);

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "order_item_unit_price_nonnegative"
  CHECK ("unitPrice" >= 0);

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "order_item_line_total_consistent"
  CHECK ("lineTotal" = "unitPrice"::BIGINT * "quantity");

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "order_item_code_format"
  CHECK ("productCode" ~ '^[A-Z0-9]{10}$');

ALTER TABLE "Order"
  ADD CONSTRAINT "order_total_nonnegative"
  CHECK ("total" >= 0);

ALTER TABLE "Order"
  ADD CONSTRAINT "order_number_format"
  CHECK ("number" ~ '^ZAM-[0-9]{4}-[0-9]{4}$');
