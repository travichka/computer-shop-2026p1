import FeaturedBoundary from "@/components/products/FeaturedBoundary";
import FeaturedPanel from "@/components/products/FeaturedPanel";

// Fallback after a hard navigation (direct entry, refresh) to /product-list/<id> or …/image,
// where the slot has no matching page. Without it Next.js would render 404 for those URLs.
export default function FeaturedDefault() {
  return (
    <FeaturedBoundary>
      <FeaturedPanel />
    </FeaturedBoundary>
  );
}
