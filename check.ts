import { PrismaClient } from '@prisma/client';
  const p = new PrismaClient();
  const events = await p.event.findMany();
  console.log('Total:', events.length);
  console.log(events);
  process.exit(0);
