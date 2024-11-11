import { PrismaClient } from '@prisma/client';
import { ReservationEntity } from '../../entity/ReservationEntity';
import { ReservationInterfaceRepository } from '../interfaces/ReservationInterfaceRepository';
import { IReservation } from '../../interfaces/IReservation';

export class ReservationRepository implements ReservationInterfaceRepository {
    private prisma: PrismaClient;

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
}