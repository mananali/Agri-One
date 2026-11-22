# Agri-One Software Requirements Specification

**Status:** Draft for business review (v0.1)  
**Source:** Agri-One project brief supplied by the business owner  
**Initial service area:** Cooch Behar and Alipurduar, West Bengal  
**Primary language:** Bengali and English

## 1. Purpose and scope

Agri-One is a B2B agriculture input marketplace with a second supply channel for products bought and owned by Agri-One. It connects manufacturers, distributors, wholesalers, agricultural retailers, farmers and logistics partners. The first release should support retailer sourcing and order fulfilment in the two launch districts. It must preserve separate operational and financial records for marketplace and Agri-One-owned stock.

The solution is expected to include a public website, retailer mobile application, supplier portal/application, admin web dashboard, and delivery/operations system. This specification describes intended production capabilities. The current repository is only a website prototype and does not yet implement those services.

## 2. User classes

| User class | Goals | Restricted data/actions |
| --- | --- | --- |
| Public visitor | Learn about Agri-One, view public product information, apply | Cannot see account prices, private stock, KYC or orders |
| Retailer | Verify business, discover products, order, pay, track, return and review ledger | Can access only its organization, orders and documents |
| Supplier/manufacturer | Complete verification, manage approved offers and stock, accept orders, dispatch, reconcile settlement | Can access only its own listings, orders and settlement data |
| Warehouse operator | Pick, pack, scan lots, adjust permitted stock, hand over shipments | Cannot approve suppliers, change commercial terms or issue settlements |
| Logistics partner | Receive assigned shipment details and update delivery events/proof | Can access only assigned shipments and required contact data |
| Admin and operations staff | Manage catalogue, users, orders, inventory and operations | Permissions must be role-scoped and auditable |
| Finance staff | Reconcile payments, refunds, invoices, ledger and settlements | Financial actions require appropriate permission and audit trail |
| Support staff | View permitted account/order context and manage support cases | No unrestricted KYC, payment credential or settlement access |

## 3. Functional requirements

### Identity, organization and verification

- **FR-001** The system shall support distinct accounts for retailers, suppliers/manufacturers, logistics partners and staff.
- **FR-002** Users shall verify their mobile number before using protected account functions.
- **FR-003** A business organization shall be able to submit KYC and business documents with a visible review status.
- **FR-004** Authorized staff shall approve, reject or request corrections to verification and record a reason and audit event.
- **FR-005** Role-based access control shall apply both to user role and organization scope.

### Catalogue, pricing and stock

- **FR-006** Administrators shall manage categories, brands and product master data for fertilizers, seeds, insecticides, fungicides, herbicides, biofertilizers, micronutrients, plant growth products, agricultural equipment and irrigation products.
- **FR-007** A product shall support multiple supplier offers, including supplier SKU, price, tax classification, pack size, MOQ, quantity slabs, available stock, lead time and supported PIN codes.
- **FR-008** Marketplace offers and Agri-One-owned stock offers shall display distinct source labels and use separate accounting paths.
- **FR-009** Suppliers shall submit new product content for approval before it becomes available to retailers.
- **FR-010** Authorized users shall maintain multi-warehouse stock and record inventory movements with reason, warehouse and, where applicable, batch and expiry.
- **FR-011** Retailer-facing price visibility shall follow account verification and any agreed customer-specific terms.
- **FR-012** Catalogue search shall support category, brand, supplier, source, product text and service area filters.

### Cart, order and payment

- **FR-013** Retailers shall be able to add eligible offers to a cart, subject to MOQ, available stock and delivery feasibility.
- **FR-014** Checkout shall create a customer-facing order and partition fulfilment into supplier/warehouse-specific child orders.
- **FR-015** The system shall reserve stock transactionally during checkout and release it if checkout fails or expires.
- **FR-016** Suppliers shall accept or reject assigned orders within a configurable response window; the system shall record the outcome and reason.
- **FR-017** Payment gateway operations shall support idempotent initiation, callback verification, reconciliation and refund status.
- **FR-018** The system shall produce order history and applicable GST invoice/credit note records. The legal invoicing entity must be configured per supply model.
- **FR-019** Approved retailer credit terms shall be represented explicitly; the system shall not infer credit eligibility from registration alone.

### Fulfilment, returns and settlement

- **FR-020** Operations users shall create purchase orders or supplier fulfilment requests for marketplace supply.
- **FR-021** Warehouse users shall record pick/pack, batch/expiry and dispatch events for Agri-One-owned inventory.
- **FR-022** The system shall track shipment milestones, delivery proof, failed delivery and exception resolution.
- **FR-023** Retailers shall be able to request eligible returns/refunds against delivered order lines.
- **FR-024** Finance users shall reconcile collections, refunds, platform fees/commission and supplier settlements.
- **FR-025** Marketplace settlement records shall be distinct from Agri-One inventory purchase, COGS and wholesale sales records.
- **FR-026** Retailers shall see complete order/payment history and an itemized ledger when credit or balance features are enabled.

### Administration, communication and reporting

- **FR-027** Authorized administrators shall manage users, suppliers, retailers, catalogue, orders, warehouses, logistics, commission settings and staff roles.
- **FR-028** Material actions shall produce an audit record with actor, timestamp, affected record and before/after values where appropriate.
- **FR-029** The system shall send status notifications for verification, order acceptance, payment, shipment, returns and settlement events.
- **FR-030** Support staff shall be able to create and track support cases linked to an organization and relevant order.
- **FR-031** Reporting shall distinguish marketplace GMV/fees from Agri-One wholesale revenue, stock value and margin.
- **FR-032** Public and signed-in user interfaces shall support English and Bengali.

## 4. Business rules

1. A listing must identify the legal seller and fulfilment source.
2. Supplier-specific price, MOQ, stock and serviceability are evaluated per offer; one product may have different values for different suppliers.
3. A mixed cart is represented as one retailer order with separate fulfilment orders. The retailer must see relevant supplier, delivery, fee and payment details before confirming.
4. Order lines snapshot product name, offer, source, price, quantity, tax, commission rule, seller and delivery terms at purchase time.
5. Inventory cannot be reduced below available-to-promise by concurrent orders; reservations and movements must be traceable.
6. Batch/expiry capture is mandatory for product categories designated by business policy and applicable law.
7. A return or refund must refer to an original order line and the responsible seller/source.
8. Credit, margins, commissions, settlement timing, shipping subsidy, taxes and cancellation/return windows are configurable commercial policies, not hard-coded assumptions.

## 5. Non-functional requirements

- **NFR-001 Availability:** production availability target and support hours are to be agreed in the service contract.
- **NFR-002 Performance:** common catalogue/search pages should render quickly on low-bandwidth mobile connections; specific p95 targets must be agreed after expected traffic is known.
- **NFR-003 Security:** use HTTPS, secure authentication/session management, input validation, rate limits, least privilege, secret management and security monitoring.
- **NFR-004 Privacy:** KYC and contact information must have limited access, encryption, access auditing, retention rules and deletion/export processes.
- **NFR-005 Reliability:** order, payment and stock mutations must be transactional or idempotent; external callbacks must tolerate retries.
- **NFR-006 Auditability:** catalogue approvals, price/stock edits, KYC decisions, refunds, settlements and role changes must be attributable.
- **NFR-007 Recovery:** backups, retention, recovery time and recovery point targets must be agreed and tested before launch.
- **NFR-008 Localization:** Bengali and English must cover navigation, forms, statuses, validation and transactional messages; product labels/documents may retain legally required source language.
- **NFR-009 Scalability:** support multiple suppliers, warehouses and districts without cross-organization data leakage or a redesign of the order model.
- **NFR-010 Accessibility:** responsive layouts, keyboard access, readable contrast, field labels and clear validation should be maintained across web flows.

## 6. External interfaces and integrations

Provider selection remains open. Required integration categories include:

- Payment gateway and settlement/reconciliation reports.
- Mobile OTP, SMS and transactional email.
- Logistics carrier or owned-fleet dispatch and tracking.
- PIN-code/serviceability and delivery-feasibility data.
- Private document storage, malware scanning and invoice/PDF generation.
- Analytics, monitoring and error reporting.

The API should isolate providers behind adapters and use signed callbacks, replay protection and idempotency keys for external state changes.

## 7. MVP acceptance criteria

- An admin can verify a supplier and retailer and record a review reason.
- An approved supplier offer and Agri-One-owned offer are both visible with unambiguous source labels.
- A verified retailer can search/filter offers, see eligible MOQ/pricing, check supported PIN-code delivery and create a mixed-source cart.
- Checkout partitions the order by fulfilment owner and prevents overselling under concurrent stock reservations.
- Each fulfilment party can accept/dispatch its own order and the retailer can see the combined parent order status.
- Payment/refund and supplier settlement records reconcile to the correct supply model.
- Batch/expiry, delivery evidence and return status are traceable for applicable items.
- English and Bengali user-facing critical flows are usable on common mobile screen sizes.
- Admin actions, payment events and inventory adjustments are auditable and backups can be restored in a documented environment.

## 8. Open decisions before implementation estimates

- Which entity contracts with retailers and suppliers, and who is the seller of record in each model?
- Who collects customer payment and issues each GST invoice?
- Which payment provider, shipping providers and initial PIN-code list will be used?
- What are the supplier commission/fee, settlement cycle, return/cancellation and dispute policies?
- What retailer credit product, if any, is offered and who bears the credit risk?
- Which products require batch/expiry capture and which licenses/documents are mandatory per seller/category?
- Are warehouses owned, supplier-operated or both at launch?
- What are target order volume, catalogue size, uptime, response times and launch date?

## 9. Related design artifacts

See [Project Blueprint](./PROJECT_BLUEPRINT.md) for proposed application architecture, core workflows, data boundaries, ER sketch and delivery phases. Requirements and commercial policies should be reviewed with business, finance, operations and qualified compliance advisors before production development.
