import { PrismaClient } from '@prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';
import { logger } from '@/utils/logger';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { date, startTime, roomId } = req.body;
    logger.log('가용성 확인 요청:', { date, startTime, roomId });

    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    // 해당 날짜의 모든 예약 조회
    const existingReservations = await prisma.reservation.findMany({
      where: {
        startTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
        ...(roomId ? { roomId: Number(roomId) } : {}),
        status: 1, // 활성 예약만 조회
      },
      select: {
        roomId: true,
        startTime: true,
        endTime: true,
      },
    });

    // 가능한 시간대 계산
    const availableSlots = calculateAvailableSlots(existingReservations, targetDate);

    return res.status(200).json({
      success: true,
      data: {
        available: availableSlots.length > 0,
        availableSlots,
      },
    });
  } catch (error) {
    logger.error('Error checking availability:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '가용성 확인 중 오류가 발생했습니다.',
    });
  }
}

function calculateAvailableSlots(existingReservations: any[], date: Date) {
  const availableRooms = [1, 4, 5, 6];
  const operatingHours = Array.from({ length: 9 }, (_, i) => i + 9); // 9시부터 17시까지
  const availableSlots = [];

  for (const roomId of availableRooms) {
    const roomReservations = existingReservations.filter(r => r.roomId === roomId);
    
    for (const hour of operatingHours) {
      const slotStart = new Date(date);
      slotStart.setHours(hour, 0, 0, 0);
      
      const slotEnd = new Date(date);
      slotEnd.setHours(hour + 1, 0, 0, 0);

      const isSlotTaken = roomReservations.some(reservation => {
        const reservationStart = new Date(reservation.startTime);
        const reservationEnd = new Date(reservation.endTime);
        return (
          (slotStart >= reservationStart && slotStart < reservationEnd) ||
          (slotEnd > reservationStart && slotEnd <= reservationEnd)
        );
      });

      if (!isSlotTaken) {
        availableSlots.push({
          roomId,
          startTime: `${hour.toString().padStart(2, '0')}:00`,
          endTime: `${(hour + 1).toString().padStart(2, '0')}:00`,
        });
      }
    }
  }

  return availableSlots;
} 