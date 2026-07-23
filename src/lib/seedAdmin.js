import bcrypt from 'bcrypt';

export async function seedAdmin(prisma) {
  if (!prisma || !prisma.admin) return;
  try {
    const envHash = process.env.ADMIN_PASSWORD_HASH;
    const envPassword = process.env.ADMIN_PASSWORD;

    let hashedPassword;
    if (envHash && envHash.trim() !== '') {
      hashedPassword = envHash;
    } else if (envPassword && envPassword.trim() !== '') {
      hashedPassword = await bcrypt.hash(envPassword, 10);
    } else {
      hashedPassword = await bcrypt.hash('password123', 10);
    }

    const username = 'admin';
    const admin = await prisma.admin.findUnique({
      where: { username },
    });

    if (!admin) {
      await prisma.admin.create({
        data: {
          username,
          password: hashedPassword,
        },
      });
      console.log('Admin user created successfully.');
    } else if (envHash && envHash.trim() !== '' || envPassword && envPassword.trim() !== '') {
      await prisma.admin.update({
        where: { username },
        data: {
          password: hashedPassword,
        },
      });
      console.log('Admin password updated from environment configuration.');
    }
  } catch (err) {
    if (err.code === 'P2021') {
      // Table doesn't exist yet, safe to ignore in test setups before migration
      return;
    }
    console.error('Failed to seed admin:', err);
  }
}

