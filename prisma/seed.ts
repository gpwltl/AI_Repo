import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Room 데이터 생성
  const rooms = await Promise.all([
    prisma.room.create({
      data: {
        roomId: 1,
        roomName: '토론방 1',
        capacity: 6
      }
    }),
    prisma.room.create({
      data: {
        roomId: 4,
        roomName: '토론방 4',
        capacity: 6
      }
    }),
    prisma.room.create({
      data: {
        roomId: 5,
        roomName: '토론방 5',
        capacity: 6
      }
    }),
    prisma.room.create({
      data: {
        roomId: 6,
        roomName: '토론방 6',
        capacity: 6
      }
    })
  ]);

  console.log('Created rooms:', rooms);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 