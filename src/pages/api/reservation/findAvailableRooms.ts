import { NextRequest } from 'next/server';
import { ReservationController } from '@/backend/domains/reservation/controller/ReservationController';
import { logger } from '@/utils/logger';

export const config = {
    runtime: 'edge',
};

const reservationController = new ReservationController();

export default async function handler(req: NextRequest) {
    logger.log('findAvailableRooms API 호출됨', {
        method: req.method,
        url: req.url
    });

    if (req.method !== 'GET') {
        logger.error('잘못된 HTTP 메서드', { method: req.method });
        return new Response(
            JSON.stringify({ message: 'Method not allowed' }),
            { 
                status: 405,
                headers: {
                    'Content-Type': 'application/json',
                }
            }
        );
    }

    try {
        const response = await reservationController.findAvailableRooms(req);
        logger.log('findAvailableRooms API 응답 성공', {
            status: response.status,
            url: req.url
        });
        return response;
    } catch (error) {
        logger.error('findAvailableRooms API 에러:', error);
        return new Response(
            JSON.stringify({ 
                success: false,
                message: error instanceof Error ? error.message : '서버 오류가 발생했습니다.'
            }),
            { 
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                }
            }
        );
    }
} 