-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" INTEGER NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" TEXT NOT NULL,
    "nameSortKey" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" TIMESTAMPTZ(3) NOT NULL,
    "categoryId" INTEGER NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_code_key" ON "Category"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Custom SQL (not expressible in the Prisma 7 schema). Part of the migration history,
-- so it is recreated on an empty database and by `prisma migrate deploy`.
-- ---------------------------------------------------------------------------

-- Byte-wise UTF-8 order of the shared name key, identical to Buffer.compare in Lab 06;
-- independent of the database/system collation.
ALTER TABLE "Product"
  ALTER COLUMN "nameSortKey" TYPE TEXT COLLATE "C";

-- Contract of Lab 06 enforced by the database itself, also for writes outside the app.
ALTER TABLE "Product"
  ADD CONSTRAINT "product_id_positive"
  CHECK ("id" > 0);

ALTER TABLE "Product"
  ADD CONSTRAINT "product_price_nonnegative"
  CHECK ("price" >= 0);

ALTER TABLE "Product"
  ADD CONSTRAINT "product_amount_nonnegative"
  CHECK ("amount" >= 0);

ALTER TABLE "Product"
  ADD CONSTRAINT "product_code_format"
  CHECK ("code" ~ '^[A-Z0-9]{10}$');

ALTER TABLE "Product"
  ADD CONSTRAINT "product_name_not_blank"
  CHECK ("name" ~ '[^[:space:]]');

ALTER TABLE "Category"
  ADD CONSTRAINT "category_code_format"
  CHECK ("code" ~ '^[a-z]+$');
