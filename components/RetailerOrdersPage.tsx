"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AgriSite } from "@/components/AgriSite";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

type RetailerOrder = {
  id: string;
  orderNumber: string;
  status: string;
  total: number | string;
  createdAt: string;
  deliveryName: string;
  deliveryDistrict: string;
  deliveryPinCode: string;
  fulfillments: Array<{
    status: string;
    lines: Array<{ id: string; productNameSnapshot: string; quantity: number; unitPriceSnapshot: number | string }>;
  }>;
};

export function RetailerOrdersPage() {
  const [token, setToken] = useState("");
  const [orders, setOrders] = useState<RetailerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async (accessToken: string) => {
    try {
      const response = await fetch(`${API_BASE}/orders`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(Array.isArray(payload.message) ? payload.message.join(" ") : payload.message ?? `Request failed (${response.status})`);
      setOrders(payload as RetailerOrder[]);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load your orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const accessToken = window.sessionStorage.getItem("agri-one-access-token") ?? "";
    queueMicrotask(() => {
      setToken(accessToken);
      if (!accessToken) setLoading(false);
    });
    if (!accessToken) return;
    queueMicrotask(() => { void refresh(accessToken); });
    const poll = () => { if (document.visibilityState === "visible") void refresh(accessToken); };
    const timer = window.setInterval(poll, 30_000);
    window.addEventListener("focus", poll);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", poll); };
  }, [refresh]);

  return <AgriSite><main className="agri-container agri-listing-page"><section className="agri-page-banner"><div><span>RETAILER ACCOUNT</span><h1>My Orders</h1><p>Orders from the website and mobile app appear together here.</p></div></section>{!token && !loading && <section className="agri-checkout-panel"><p>Sign in to view your Agri-One orders.</p><Link className="agri-primary-button" href="/login?next=%2Fretailer%2Fmy-orders">Sign in</Link></section>}{error && <div className="admin-error" role="alert">{error}<button onClick={() => { if (token) { setLoading(true); void refresh(token); } }}>Retry</button></div>}{loading && <div className="admin-loading">Loading your orders…</div>}{!loading && token && !error && orders.length === 0 && <div className="agri-empty"><h2>No orders yet</h2><p>Orders placed from this website or the Agri-One app will show here.</p><Link className="agri-primary-button" href="/products">Browse products</Link></div>}{orders.map((order) => <article key={order.id} className="agri-checkout-panel" style={{ marginTop: 14 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><strong>{order.orderNumber}</strong><p>{new Date(order.createdAt).toLocaleString("en-IN")} · {order.deliveryDistrict} {order.deliveryPinCode}</p></div><span className="admin-status">{order.status.replaceAll("_", " ")}</span></div>{order.fulfillments.flatMap((fulfillment) => fulfillment.lines).map((line) => <div key={line.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderTop: "1px solid #edf1ed" }}><span>{line.productNameSnapshot} × {line.quantity}</span><strong>₹{(Number(line.unitPriceSnapshot) * line.quantity).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong></div>)}<div style={{ borderTop: "1px solid #edf1ed", paddingTop: 10, display: "flex", justifyContent: "space-between" }}><span>Order total</span><strong>₹{Number(order.total).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong></div></article>)}</main></AgriSite>;
}
