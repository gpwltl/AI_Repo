import { GetRoomInterfaceUseCase } from './GetRoomInterfaceUseCase';
import { Reservation } from '../entities/Reservation';
import { ReservationRepository } from '../repositories/ReservationRepository';

export class GetRoomUseCase implements GetRoomInterfaceUseCase {
    private reservationRepository: ReservationRepository;

    constructor(reservationRepository: ReservationRepository) {
        this.reservationRepository = reservationRepository;
    }

    async getComponents(roomId: string, date: Date): Promise<Reservation[]> {
        // 당일 시작과 끝 시간을 설정
        const startOfDay = new Date(date.setHours(0, 0, 0, 0));
        const endOfDay = new Date(date.setHours(23, 59, 59, 999));

        // 예약 저장소에서 해당 방의 당일 예약을 조회
        return this.reservationRepository.findReservationsByRoomAndDate(roomId, startOfDay, endOfDay);
    }
}
