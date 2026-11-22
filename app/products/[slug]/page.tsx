import { Suspense } from "react";
import { ProductDetailsPage } from "@/components/AgriSite";

type ProductPageProps = { params: Promise<{ slug: string }> };

async function ProductDetails({ params }: ProductPageProps) {
  const { slug } = await params;
  return <ProductDetailsPage slug={slug} />;
}

export default function Page({ params }: ProductPageProps) {
  return (
    <Suspense
      fallback={
        <main className="agri-container agri-details-page">
          <div className="agri-breadcrumb">Home › Products › Loading product</div>
          <section className="agri-detail-card" aria-label="Loading product details">
            <div className="agri-detail-visual">
              <div className="agri-product-art" />
            </div>
            <div className="agri-detail-copy">
              <span className="agri-product-badge">AGRI-ONE MARKETPLACE</span>
              <h1>Product details</h1>
              <p>Loading product information…</p>
            </div>
          </section>
        </main>
      }
    >
      <ProductDetails params={params} />
    </Suspense>
  );
}
