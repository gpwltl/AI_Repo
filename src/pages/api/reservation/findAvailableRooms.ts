import type { NextApiRequest, NextApiResponse } from 'next';
import { ReservationController } from '@/backend/domains/reservation/controller/ReservationController';
import { logger } from '@/utils/logger';

const reservationController = new ReservationController();

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    logger.log('findAvailableRooms API 호출됨', {
        method: req.method,
        query: req.query
    });

    if (req.method !== 'GET') {
        logger.error('잘못된 HTTP 메서드', { method: req.method });
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { date, time } = req.query;

        if (!date || !time) {
            return res.status(400).json({
                success: false,
                message: '날짜와 시간을 모두 입력해주세요.'
            });
        }

        const result = await reservationController.findAvailableRooms(
            new Date(date as string),
            time as string
        );

        logger.log('findAvailableRooms API 응답 성공', {
            date,
            time,
            result
        });

        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('findAvailableRooms API 에러:', error);
        return res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : '서버 오류가 발생했습니다.'
        });
    }
} 