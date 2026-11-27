CREATE TYPE "BusinessEntityType" AS ENUM ('PROPRIETOR', 'PRIVATE_LIMITED', 'PARTNERSHIP');

ALTER TABLE "Organization"
ADD COLUMN "businessEntityType" "BusinessEntityType";
