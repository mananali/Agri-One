# Agri-One frontend structure

## Routes

- `/` public marketplace home
- `/about`, `/categories`, `/brands`, `/services`, `/retailers`, `/suppliers`, `/contact`, `/faq`, `/login`, `/register`, `/privacy`, `/terms`
- `/admin` dashboard with retailers, suppliers, manufacturers, products, categories, brands, approvals, pricing, commissions, orders, purchase orders, inventory, warehouses, delivery, payments, settlements, invoices, returns, offers, accounts, expenses, analytics, staff, roles, support, notifications, areas, settings and audit logs
- `/retailer` mobile-first buying workspace with catalogue, categories, brands, product details/search, cart, checkout, orders/tracking/reorder, wishlist, offers, payments, dues, invoices, returns, profile/GST/addresses, notifications, support, loyalty and settings
- `/supplier` seller workspace with company/KYC, products, product form/edit/approval, pricing, stock/batches/expiry, order queues, dispatch, invoice upload, settlements, reports, returns, notifications, support and settings
- `/delivery` delivery workspace with assigned orders, order/pickup/address details, shipment status, history, failed deliveries and profile
- `/warehouse` prototype with overview, stock, batches, expiry, transfers and goods receipt
- `/accounts` prototype with financial overview, sales, purchases, expenses, receivables, payables, P&L and GST reports
- `/farmer` prototype with home, membership, crop records, soil testing, crop advisory and support

## Code organization

- `app/`: App Router pages and root layout
- `components/`: reusable public, dashboard and interaction components
- `lib/`: typed local demo fixtures and route configuration
- `docs/`: product and implementation documentation

## Design system

- Primary green `#16803C`; secondary orange `#F28C28`; white `#FFFFFF`; canvas `#F3F5F4`; text `#202A24`.
- Enterprise layouts use a compact forest-green navigation rail, warm neutral canvas, white cards, clear labels and restrained orange accents.
- Public pages use an editorial marketplace layout with product discovery, clear source labels, and calls to action.
- Responsive behavior collapses navigation and grids for narrow screens; interactive demo controls are labeled as local previews.
- All sample prices, counts, products, statuses and actions are illustrative frontend state. No order, approval, payment or delivery is represented as real.
