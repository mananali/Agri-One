import { Suspense } from "react";
import { ProductsListingPage } from "@/components/AgriSite";

type ProductsPageProps = {
  searchParams: Promise<{ category?: string; search?: string }>;
};

async function ProductResults({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  return (
    <ProductsListingPage
      initialCategory={params.category}
      initialSearch={params.search}
    />
  );
}

export default function Page({ searchParams }: ProductsPageProps) {
  return (
    <Suspense
      fallback={
        <main className="agri-container agri-listing-page">
          <div className="agri-page-banner banner-products">
            <div>
              <span>AGRI-ONE MARKETPLACE</span>
              <h1>Our Products</h1>
              <p>Premium quality agricultural products for every farm</p>
            </div>
          </div>
        </main>
      }
    >
      <ProductResults searchParams={searchParams} />
    </Suspense>
  );
}
