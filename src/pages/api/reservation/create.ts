import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { date, startTime, duration, roomId, userName, content } = req.body;

  try {
    // 날짜와 시간 파싱
    const parsedDate = new Date(date);
    const [hours, minutes] = startTime.split(':').map(Number);
    
    // 시작 시간 설정
    const startDateTime = new Date(parsedDate);
    startDateTime.setHours(hours, minutes || 0, 0, 0);
    
    // 종료 시간 계산
    const endDateTime = new Date(startDateTime);
    endDateTime.setHours(startDateTime.getHours() + duration);

    logger.log('예약 시간 정보:', {
      parsedDate,
      startDateTime,
      endDateTime,
      duration
    });

    // 입력값 유효성 검사
    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      return res.status(400).json({
        success: false,
        error: '잘못된 날짜/시간 형식입니다.'
      });
    }

    // 트랜잭션 실행
    const reservation = await prisma.$transaction(async (tx) => {
      // 중복 예약 확인
      const existingReservation = await tx.reservation.findFirst({
        where: {
          AND: [
            { roomId: Number(roomId) },
            { status: 1 },
            {
              OR: [
                {
                  AND: [
                    { startTime: { lte: startDateTime } },
                    { endTime: { gt: startDateTime } }
                  ]
                },
                {
                  AND: [
                    { startTime: { lt: endDateTime } },
                    { endTime: { gte: endDateTime } }
                  ]
                }
              ]
            }
          ]
        }
      });

      if (existingReservation) {
        throw new Error('이미 예약된 시간입니다.');
      }

      // 예약 생성
      return await tx.reservation.create({
        data: {
          startTime: startDateTime,
          endTime: endDateTime,
          content,
          status: 1,
          userName,
          roomId: Number(roomId),
          userId: 1 // 임시 사용자 ID
        }
      });
    });

    logger.log('예약 생성 성공:', reservation);

    return res.status(200).json({
      success: true,
      data: reservation
    });

  } catch (error) {
    logger.error('예약 생성 중 에러:', error);
    
    // 에러 응답 처리
    if (error instanceof Error) {
      const statusCode = error.message.includes('이미 예약된 시간') ? 409 : 500;
      return res.status(statusCode).json({
        success: false,
        error: error.message
      });
    }
    
    return res.status(500).json({
      success: false,
      error: "예약 생성 중 오류가 발생했습니다."
    });
  }
} 