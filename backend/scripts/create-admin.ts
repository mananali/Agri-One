import 'dotenv/config';
import { OrganizationType, UserRole, VerificationStatus } from '@prisma/client';
import { hash } from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const developmentDefaults = process.env.NODE_ENV !== 'production';
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase() || (developmentDefaults ? 'codeenv@agri-one.local' : '');
  const password = process.env.ADMIN_PASSWORD || (developmentDefaults ? 'decoder' : '');
  const name = process.env.ADMIN_NAME?.trim() || (developmentDefaults ? 'CodeEnv' : 'Agri-One Admin');
  if (!email || !password || (process.env.NODE_ENV === 'production' && password.length < 12)) throw new Error('Set ADMIN_EMAIL and a strong ADMIN_PASSWORD (12+ characters) in backend/.env');
  if (await prisma.user.findUnique({ where: { email } })) throw new Error('That email already belongs to a user. No account was changed.');
  const organization = await prisma.organization.findFirst({ where: { type: OrganizationType.AGRI_ONE }, orderBy: { createdAt: 'asc' } });
  const adminOrganization = organization ?? await prisma.organization.create({ data: { name: 'Agri-One', type: OrganizationType.AGRI_ONE, verificationStatus: VerificationStatus.APPROVED } });
  await prisma.user.create({ data: { email, name, passwordHash: await hash(password, 12), role: UserRole.ADMIN, organizationId: adminOrganization.id } });
  console.info(`Created admin account ${email}.`);
  if (process.env.ADMIN_PASSWORD) console.info('Remove ADMIN_PASSWORD from the environment after setup.');
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
