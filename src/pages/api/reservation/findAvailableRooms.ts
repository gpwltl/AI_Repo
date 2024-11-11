import { NextRequest } from 'next/server';
import { ReservationController } from '@/backend/domains/reservation/controller/ReservationController';

export const config = {
    runtime: 'edge',
};

const reservationController = new ReservationController();

export default async function handler(req: NextRequest) {
    if (req.method !== 'GET') {
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
        return await reservationController.findAvailableRooms(req);
    } catch (error) {
        console.error('API Error:', error);
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