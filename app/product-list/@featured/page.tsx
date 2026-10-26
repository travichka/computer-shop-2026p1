import FeaturedPanel from "@/components/products/FeaturedPanel";

// @featured slot for /product-list. A slot is not a URL segment: @featured never appears in the address.
export default function FeaturedSlot() {
  return <FeaturedPanel />;
}
