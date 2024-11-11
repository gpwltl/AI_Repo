import { PrismaClient } from '@prisma/client';
import { ReservationEntity } from '../../entity/ReservationEntity';
import { ReservationInterfaceRepository } from '../interfaces/ReservationInterfaceRepository';
import { IReservation, IAvailableRoom } from '../../interfaces/IReservation';

export class ReservationRepository implements ReservationInterfaceRepository {
    private prisma: PrismaClient;
    private readonly AVAILABLE_ROOMS = [1, 4, 5, 6];

    constructor() {
        this.prisma = new PrismaClient();
    }

    async createReservation(reservation: ReservationEntity): Promise<ReservationEntity> {
        try {
            const createdReservation = await this.prisma.reservation.create({
                data: {
                    userId: reservation.getUserId(),
                    roomId: reservation.getRoomId(),
                    startTime: reservation.getStartTime(),
                    endTime: reservation.getEndTime(),
                    status: reservation.getStatus(),
                    regdate: new Date() // 현재 시간으로 설정
                }
            });

            return new ReservationEntity(
                createdReservation.id,
                createdReservation.userId,
                createdReservation.roomId,
                createdReservation.startTime,
                createdReservation.endTime,
                createdReservation.status,
                createdReservation.regdate
            );
        } catch (error: unknown) {
            if (error instanceof Error) {
                throw new Error(`Failed to create reservation: ${error.message}`);
            }
            throw new Error('Failed to create reservation: Unknown error');
        }
    }

    async findReservationsByDateTime(
        targetDate: Date,
        startHour: string,
        endHour: string
    ): Promise<ReservationEntity[]> {
        try {
            // 날짜와 시간 조합
            const year = targetDate.getFullYear();
            const month = String(targetDate.getMonth() + 1).padStart(2, '0');
            const day = String(targetDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            
            const startDateTime = new Date(`${dateStr} ${startHour}`);
            const endDateTime = new Date(`${dateStr} ${endHour}`);
            
            const reservations = await this.prisma.reservation.findMany({
                where: {
                    startTime: {
                        gte: startDateTime
                    },
                    endTime: {
                        lte: endDateTime
                    }
                }
            });

            // ReservationEntity 배열로 변환하여 반환
            return reservations.map((reservation: IReservation)  => new ReservationEntity(
                reservation.id,
                reservation.userId,
                reservation.roomId,
                reservation.startTime,
                reservation.endTime,
                reservation.status,
                reservation.regdate
            ));
        } catch (error: unknown) {
            if (error instanceof Error) {
                throw new Error(`Failed to find reservations: ${error.message}`);
            }
            throw new Error('Failed to find reservations: Unknown error');
        }
    }

    async findAvailableRooms(searchDate: Date, startTime: string): Promise<IAvailableRoom[]> {
        try {
            // 날짜와 시간 조합
            const searchDateTime = new Date(`${searchDate.toISOString().split('T')[0]}T${startTime}`);
            const endDateTime = new Date(searchDateTime);
            endDateTime.setHours(endDateTime.getHours() + 1); // 1시간 단위로 검색

            // 해당 시간대의 모든 예약 검색
            const reservations = await this.prisma.reservation.findMany({
                where: {
                    AND: [
                        {
                            startTime: {
                                lte: endDateTime
                            }
                        },
                        {
                            endTime: {
                                gt: searchDateTime
                            }
                        }
                    ]
                }
            });

            // 각 방의 가용성 확인
            const availableRooms: IAvailableRoom[] = this.AVAILABLE_ROOMS.map(roomId => {
                const roomReservations = reservations.filter((r: IReservation) => r.roomId === roomId);
                return {
                    roomId,
                    isAvailable: roomReservations.length === 0,
                    conflictingReservations: roomReservations
                };
            });

            return availableRooms;

        } catch (error) {
            console.error('방 검색 중 오류 발생:', error);
            throw new Error('방 검색 중 오류가 발생했습니다.');
        }
    }
}