import { PrismaClient } from '@prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';
import { logger } from '@/utils/logger';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { date, timeRange, preferredRoom } = req.body;
    logger.log('다음 예약 가능 시간 검색:', { date, timeRange, preferredRoom });

    const searchDate = date ? new Date(date) : new Date();
    
    if (isNaN(searchDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: '유효하지 않은 날짜 형식입니다.'
      });
    }

    // 주말 체크
    const dayOfWeek = searchDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return res.status(200).json({
        success: true,
        data: {
          availableSlots: [],
          message: "주말은 예약이 불가능합니다."
        }
      });
    }

    const startOfDay = new Date(searchDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(searchDate);
    endOfDay.setHours(23, 59, 59, 999);

    // 운영 시간 설정
    const operatingHours = {
      morning: { start: 9, end: 12 },
      afternoon: { start: 13, end: 18 },
      all: { start: 9, end: 18 }
    };

    // 기존 예약 조회
    const existingReservations = await prisma.reservation.findMany({
      where: {
        startTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
        ...(preferredRoom ? { roomId: Number(preferredRoom) } : {}),
        status: 1,
      },
    });

    logger.log('기존 예약:', existingReservations);

    // 모든 가능한 시간대 생성
    const availableSlots = [];
    const hours = operatingHours[timeRange as keyof typeof operatingHours] || operatingHours.all;
    const rooms = preferredRoom ? [preferredRoom] : [1, 4, 5, 6];

    for (const roomId of rooms) {
      for (let hour = hours.start; hour < hours.end; hour++) {
        const startTime = `${hour.toString().padStart(2, '0')}:00`;
        const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;

        // 해당 시간대에 예약이 있는지 확인
        const isBooked = existingReservations.some(reservation => {
          const resStart = new Date(reservation.startTime).getHours();
          return reservation.roomId === roomId && resStart === hour;
        });

        // 예약이 없으면 가용 시간으로 추가
        if (!isBooked) {
          availableSlots.push({
            date: searchDate.toISOString().split('T')[0],
            roomId,
            startTime,
            endTime,
          });
        }
      }
    }

    // 결과 반환
    const response = {
      success: true,
      data: {
        availableSlots,
        message: dayOfWeek === 0 || dayOfWeek === 6 
          ? "주말은 예약이 불가능합니다."
          : availableSlots.length === 0 
            ? `${searchDate.toLocaleDateString()} ${
                timeRange === 'morning' ? '오전' : 
                timeRange === 'afternoon' ? '오후' : 
                '전체'
              }에는 모든 시간대가 예약 가능합니다.`
            : `${searchDate.toLocaleDateString()} ${
                timeRange === 'morning' ? '오전' : 
                timeRange === 'afternoon' ? '오후' : 
                '전체'
              } 예약 가능한 시간을 조회했습니다.`
      }
    };

    logger.log('조회 결과:', {
      date: searchDate,
      dayOfWeek,
      timeRange,
      existingReservations: existingReservations.length,
      availableSlots: availableSlots.length,
      response
    });
    return res.status(200).json(response);

  } catch (error) {
    logger.error('Error finding next available slots:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '가용성 확인 중 오류가 발생했습니다.',
    });
  }
} 