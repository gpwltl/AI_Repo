import { NextRequest, NextResponse } from 'next/server';
import { CreateReservationUseCase } from '../service/CreateReservationUseCase';
import { ReservationRepository } from '../repositories/implementations/ReservationRepository';
import { FindReservationsByDateTimeUseCase } from '../service/FindReservationsByDateTimeUseCase';
import { FindAvailableRoomsUseCase } from '../service/FindAvailableRoomsUseCase';

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

            if (!date || !time) {
                return NextResponse.json(
                    { message: '날짜와 시간을 모두 입력해주세요.' },
                    { status: 400 }
                );
            }

            const searchDate = new Date(date);
            const availableRooms = await this.findAvailableRoomsUseCase.execute(searchDate, time);

            return NextResponse.json({
                success: true,
                data: availableRooms
            });

        } catch (error) {
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
