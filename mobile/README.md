# Agri-One Mobile App

Expo app for product discovery, retailer purchasing, supplier order handling, and admin catalogue and business review. Public company, service, category, brand, FAQ, contact, privacy, and terms pages are also included. When the backend is offline, the app displays sample catalogue listings; sample items cannot be checked out.

## Run locally

1. Start the API and PostgreSQL by following [the backend setup](../backend/README.md).
2. From this directory, install dependencies and start Expo:

   ```bash
   npm install
   npm start
   ```

3. Open the project in an Android emulator, iOS simulator, or Expo Go.

In Expo development mode, opening the app without a saved session routes to the retailer test login. Enter the configured 10-digit `TEST_RETAILER_PHONE` (local example: `9876543210`). The API must have `ENABLE_TEST_RETAILER_LOGIN=true`; this endpoint is disabled whenever `NODE_ENV=production` and should remain off in deployed environments. Production app builds use the regular email-and-password login.

In development, the app discovers the current host serving Expo and uses its port `3001` for the API, so a laptop's changing LAN address does not stay hardcoded in the app. The Android emulator falls back to `10.0.2.2`; other local runs fall back to `localhost`. Set `EXPO_PUBLIC_API_URL` when the API is on a different server or Expo is running through a public tunnel that cannot share the API port. Keep a physical phone and local API server on a network that can reach each other. Production builds should use an HTTPS API URL.

Admin accounts use the same responsive web admin panel as desktop users. Set `EXPO_PUBLIC_ADMIN_URL` to the website's `/admin` URL when it is hosted separately from the API. If unset, the app derives the local website address from `EXPO_PUBLIC_API_URL`.

Retailer checkout requires an approved retailer organization and an offer available for the entered PIN code. Payments and delivery-provider integrations are not connected.

## Typography

Use `AgriText` and `AgriTextInput` from `components/AgriText` for screen text and inputs. Shared roles, sizes, font families, line heights, and colors live in `src/typography.ts`; Bengali font assets are loaded in `app/_layout.tsx`. Avoid importing React Native's `Text` directly in screens so typography stays consistent.
