import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.event.findMany().then(e => { console.log(JSON.stringify(e, null, 2)); process.exit(0); });