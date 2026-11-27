CREATE TYPE "AdminPermission" AS ENUM (
    'CATALOG', 'RETAILERS', 'ORDERS', 'INVENTORY', 'FINANCE',
    'DELIVERY', 'REPORTS', 'NOTIFICATIONS', 'SETTINGS', 'USERS'
);

ALTER TABLE "User"
ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "adminPermissions" "AdminPermission"[] NOT NULL DEFAULT ARRAY[]::"AdminPermission"[];

-- Keep existing administrator logins operational while enabling scoped admin accounts.
UPDATE "User"
SET "isSuperAdmin" = TRUE
WHERE "role" = 'ADMIN'::"UserRole"
  AND cardinality("adminPermissions") = 0;
