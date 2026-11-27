# Agri-One

Agri-One is a B2B agriculture input marketplace for retailers and suppliers, initially focused on Cooch Behar and Alipurduar, West Bengal. The website, responsive centralized admin panel, and Expo mobile app use the same NestJS API and PostgreSQL database.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). If port 3000 is already in use, Next.js will choose another available port and print its URL.

## Current frontend prototype

- Public marketplace pages: home, about, categories, brands, services, retailer and supplier information, contact, FAQ, login, registration, privacy and terms.
- Role workspaces: `/admin`, `/retailer`, `/supplier`, `/delivery`, `/warehouse`, `/accounts` and `/farmer`.
- Responsive layouts with shared navigation, catalogue cards, tables, local search, sorting, filters, pagination controls, charts, and demo feedback.
- The `/admin` panel manages products, categories, brands, inventory, orders, retailers, suppliers, promotions, delivery, payments and ledger, reports, notifications, and platform settings. It is responsive and can be used in a desktop or mobile browser.
- Website and app catalogue pages read the same approved products, offers, stock, categories, brands, and promotions from the API. The admin panel refreshes every 30 seconds; open website pages and the mobile app also refresh live catalogue data every 30 seconds and on focus/resume.
- Orders created by either platform are stored in the shared database and appear in the same admin order manager. Checkout uses an idempotency key to prevent duplicate submissions.
- Complete route map and visual tokens are documented in [Frontend Structure](docs/FRONTEND_STRUCTURE.md).

When the API cannot be reached, the website and app can show sample listings for browsing; those samples are not database records and cannot be checked out. Payment gateway settlement, OTP/SMS delivery, cloud object storage, and third-party logistics integrations still require provider credentials and deployment configuration. Product images currently use the API server's `backend/uploads` directory, which must be backed up and mounted on persistent shared storage in production.

## Run the API

Start PostgreSQL first (Docker instructions and credentials are in [backend/README.md](backend/README.md)), then in a second terminal:

```bash
cd backend
copy .env.example .env
npm install
npm run db:migrate -- --name init
npm run db:seed
npm run start:dev
```

The web sign-in and registration screens use `http://localhost:3001/api/v1` by default. Set `NEXT_PUBLIC_API_URL` if the API runs elsewhere.

## Separate mobile app

The existing Next.js website remains in the repository root. The independent React Native app built with Expo is in [mobile/](mobile/README.md). It has its own dependencies and run command:

```bash
cd mobile
npm install
npm start
```

Start the API first. Android emulators use `10.0.2.2` to reach the host machine; for a physical phone, set `EXPO_PUBLIC_API_URL` to the computer's LAN address as described in the mobile README.

## Project documents

- [Software Requirements Specification](docs/SRS.md)
- [Project Blueprint](docs/PROJECT_BLUEPRINT.md)

The requirements and architecture are drafts derived from the project brief. Business policies, compliance responsibilities, integrations, service targets and commercial terms require confirmation before production implementation.
