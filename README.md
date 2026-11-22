# Agri-One

Agri-One is planned as a B2B agriculture input marketplace for retailers and suppliers, initially focused on Cooch Behar and Alipurduar, West Bengal. It combines third-party marketplace listings with Agri-One-owned wholesale stock. The current repository contains the public website prototype and planning documents.

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
- Registration and sign-in submit to the NestJS API. Retailer catalogue, cart quantities and workspace dashboards remain illustrative frontend data.
- Complete route map and visual tokens are documented in [Frontend Structure](docs/FRONTEND_STRUCTURE.md).

Most products, prices, counts, suppliers, statuses, and workspace interactions are illustrative frontend data. The API includes JWT authentication, PostgreSQL persistence, approved catalogue reads, supplier submissions and stock updates, admin reviews, and transactional retailer checkout. The frontend currently connects only its registration and sign-in screens to that API. Payment gateways, live KYC uploads, and logistics integrations are not implemented.

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

## Project documents

- [Software Requirements Specification](docs/SRS.md)
- [Project Blueprint](docs/PROJECT_BLUEPRINT.md)

The requirements and architecture are drafts derived from the project brief. Business policies, compliance responsibilities, integrations, service targets and commercial terms require confirmation before production implementation.
