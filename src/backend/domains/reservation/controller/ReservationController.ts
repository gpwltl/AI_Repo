import { NextRequest, NextResponse } from 'next/server';
import { CreateReservationUseCase } from '../service/CreateReservationUseCase';
import { ReservationRepository } from '../repositories/implementations/ReservationRepository';
import { FindReservationsByDateTimeUseCase } from '../service/FindReservationsByDateTimeUseCase';
import { FindAvailableRoomsUseCase } from '../service/FindAvailableRoomsUseCase';
import { logger } from '@/utils/logger';

export class ReservationController {
    private createReservationUseCase: CreateReservationUseCase;
    private findReservationsByDateTimeUseCase: FindReservationsByDateTimeUseCase;
    private findAvailableRoomsUseCase: FindAvailableRoomsUseCase;

    constructor() {
        const reservationRepository = new ReservationRepository();
        this.createReservationUseCase = new CreateReservationUseCase(reservationRepository);
        this.findReservationsByDateTimeUseCase = new FindReservationsByDateTimeUseCase(reservationRepository);
        this.findAvailableRoomsUseCase = new FindAvailableRoomsUseCase(reservationRepository);
    }

    async createReservation(request: NextRequest): Promise<NextResponse> {
        try {
            const body = await request.json();
            
            // Date 문자열을 Date 객체로 변환
            const reservationData = {
                ...body,
                startTime: new Date(body.startTime),
                endTime: new Date(body.endTime)
            };

            const result = await this.createReservationUseCase.execute(reservationData);

            return NextResponse.json(
                { 
                    message: 'Reservation created successfully',
                    data: result 
                }, 
                { status: 201 }
            );
        } catch (error) {
            return NextResponse.json(
                { 
                    message: error instanceof Error ? error.message : 'Internal server error' 
                }, 
                { status: 500 }
            );
        }
    }

    async findReservationsByDateTime(request: NextRequest): Promise<NextResponse> {
        try {
            const { searchParams } = new URL(request.url);
            const targetDate = searchParams.get('targetDate');
            const startHour = searchParams.get('startHour');
            const endHour = searchParams.get('endHour');

            // 필수 파라미터 검증
            if (!targetDate || !startHour || !endHour) {
                return NextResponse.json(
                    { message: 'Missing required parameters' },
                    { status: 400 }
                );
            }

            const result = await this.findReservationsByDateTimeUseCase.execute({
                targetDate: new Date(targetDate),
                startHour,
                endHour
            });

            return NextResponse.json(
                {
                    message: 'Reservations found successfully',
                    data: result
                },
                { status: 200 }
            );
        } catch (error) {
            return NextResponse.json(
                {
                    message: error instanceof Error ? error.message : 'Internal server error'
                },
                { status: 500 }
            );
        }
    }

    async findAvailableRooms(request: NextRequest): Promise<NextResponse> {
        try {
            const { searchParams } = new URL(request.url);
            const date = searchParams.get('date');
            const time = searchParams.get('time');

            logger.log('findAvailableRooms 컨트롤러 호출', {
                date,
                time,
                url: request.url
            });

            if (!date || !time) {
                logger.error('필수 파라미터 누락', { date, time });
                return NextResponse.json(
                    { message: '날짜와 시간을 모두 입력해주세요.' },
                    { status: 400 }
                );
            }

            const searchDate = new Date(date);
            logger.log('검색 날짜 파싱', {
                inputDate: date,
                parsedDate: searchDate.toISOString()
            });

            const availableRooms = await this.findAvailableRoomsUseCase.execute(searchDate, time);
            logger.log('사용 가능한 방 조회 완료', {
                date: searchDate,
                time,
                availableRoomsCount: availableRooms.length,
                availableRooms
            });

            return NextResponse.json({
                success: true,
                data: availableRooms
            });

        } catch (error) {
            logger.error('findAvailableRooms 컨트롤러 에러:', error);
            return NextResponse.json(
                { 
                    success: false,
                    message: error instanceof Error ? error.message : '검색 중 오류가 발생했습니다.'
                },
                { status: 500 }
            );
        }
    }
}
