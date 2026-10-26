import "server-only";

import { cache } from "react";
import { findProductByRouteId } from "./product-id";
import { productRepository } from "./repository";

/**
 * Product for the raw [id] segment, shared by generateMetadata and the page.
 * React cache() deduplicates the call within one request, so both read the same data source once.
 * null → invalid or unknown id (the page calls notFound()); a repository failure rejects.
 */
export const getProductForRoute = cache((rawId: string) => findProductByRouteId(productRepository, rawId));
