import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@example.com';
  const adminPassword = 'admin123456';

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      password: passwordHash,
      username: 'admin',
      role: UserRole.admin,
      status: UserStatus.active,
      emailVerified: true,
    },
    update: {},
  });

  // Default site settings (system_configs)
  const defaults: Array<{ key: string; value: string; description: string }> = [
    { key: 'site.registrationEnabled', value: 'true', description: 'Enable registration' },
    { key: 'site.initialRegisterCredits', value: '0', description: 'Initial permanent credits for new users' },
    { key: 'site.title', value: 'FlowMuse', description: 'Site title' },
    { key: 'site.icon', value: '', description: 'Site icon URL' },
    { key: 'site.footer', value: '© 2026 FlowMuse', description: 'Site footer text' },
  ];

  for (const item of defaults) {
    await prisma.systemConfig.upsert({
      where: { key: item.key },
      create: item,
      update: { value: item.value, description: item.description },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
