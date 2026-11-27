# Agri-One API

NestJS REST API with PostgreSQL and Prisma. The API includes local JWT authentication, organization roles, public approved catalogue reads, supplier product submissions and stock updates, admin platform controls, and transactional retailer checkout that reserves inventory and splits fulfillment by seller/source.

## Local setup

1. Install Node.js 20.20+ and Docker Desktop.
2. Copy `.env.example` to `.env` and replace `JWT_SECRET` with a random secret of at least 32 characters.
3. Run `docker compose up -d postgres` from this folder.
4. Run `npm install`.
5. Run `npm run db:migrate -- --name init` and `npm run db:seed`.
6. In development, run `npm run admin:create` to create the `CodeEnv` admin account (`decoder` password; login is case-insensitive). For production, set `ADMIN_EMAIL`, a strong `ADMIN_PASSWORD` (12+ characters), and optional `ADMIN_NAME` before running the command.
7. Start with `npm run start:dev`.

The API runs on `http://localhost:3001/api/v1`; Swagger UI is at `http://localhost:3001/api/docs`. Liveness is `/health`; readiness, including PostgreSQL connectivity, is `/health/ready`.

## Core routes

- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- `GET /catalog/categories`, `/catalog/brands`, `/catalog/products`, `/catalog/products/:slug`
- `POST /supplier/products`, `PATCH /supplier/offers/:offerId/stock`
- `GET /admin/organizations`, `PATCH /admin/organizations/:id/verification`
- `GET /admin/overview`, `GET /admin/products`, `POST /admin/products`, `PATCH /admin/products/:id`, `POST /admin/products/image`
- `PATCH /admin/offers/:id`, `GET /admin/users`, `PATCH /admin/users/:id/status`, `GET /admin/orders`, `PATCH /admin/orders/:id/status`
- `GET /admin/catalog-structure`, `POST /admin/categories`, `POST /admin/brands`, plus category/brand status controls
- `GET /admin/products/pending`, `PATCH /admin/products/:id/review`
- `POST /orders/checkout`, `GET /orders`, `GET /orders/:orderNumber`, `PATCH /orders/fulfillments/:id/decision`
- `GET /admin/business-dashboard`, `/admin/purchases`, `/admin/finance`, `/admin/staff`, `/admin/activity`, `/admin/errors`, `/admin/returns`
- `POST /admin/purchases`, purchase approval/receipt routes, finance collection/supplier payment/expense routes, and `POST /admin/inventory/:id/adjustment`
- `POST /admin/backups` creates a PostgreSQL custom-format backup in private server storage; `GET /admin/backups` lists backup metadata.

Send `Authorization: Bearer <accessToken>` to protected routes. Registration supports retailer and supplier accounts only; admin accounts are created with the local CLI command. Checkout requires an approved retailer organization, serviceable PIN code, eligible offer, minimum quantity, and `Idempotency-Key` header. It creates one parent order and separate seller/source fulfillments inside a serializable transaction and reserves stock. Admin order cancellation releases reservations; delivery completion finalizes stock and COD collections. Purchase receipts increase shared stock and are idempotent. Finance collection and supplier payment operations use immutable transaction rows, account balance checks and idempotency keys.

Admin roles are controlled by `AdminPermission` values; super admins retain full access. Unexpected API errors are stored without request bodies or stack traces. Database backups require `pg_dump` on the API host (or `PG_DUMP_PATH`) and write to `DATABASE_BACKUP_DIR` (default `backend/private-backups/`); keep that directory on private, access-controlled storage and copy backups to a separate protected location as part of deployment operations.

Payment gateway and OTP/SMS providers, external accounting exports, automated off-site backup schedules, returns payment refunds, and logistics carriers still need provider credentials and business rules before they can be integrated. Current collections support manual receipts and COD; do not represent them as online payment processing.
