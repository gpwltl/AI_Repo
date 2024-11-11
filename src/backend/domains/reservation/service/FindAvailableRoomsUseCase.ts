import { ReservationRepository } from '../repositories/implementations/ReservationRepository';
import { IAvailableRoom } from '../interfaces/IReservation';

export class FindAvailableRoomsUseCase {
    constructor(private reservationRepository: ReservationRepository) {}

    async execute(searchDate: Date, startTime: string): Promise<IAvailableRoom[]> {
        try {
            // 입력값 검증
            if (!this.isValidDate(searchDate)) {
                throw new Error('유효하지 않은 날짜입니다.');
            }

            if (!this.isValidTime(startTime)) {
                throw new Error('예약 가능 시간은 09:00-18:00입니다.');
            }

            // 주말 체크
            if (this.isWeekend(searchDate)) {
                throw new Error('주말은 예약이 불가능합니다.');
            }

            return await this.reservationRepository.findAvailableRooms(searchDate, startTime);
        } catch (error) {
            throw error;
        }
    }

    private isValidDate(date: Date): boolean {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const twoWeeksLater = new Date(today);
        twoWeeksLater.setDate(today.getDate() + 14);
        
        return date >= today && date <= twoWeeksLater;
    }

    private isValidTime(time: string): boolean {
        const [hours] = time.split(':').map(Number);
        return hours >= 9 && hours < 18;
    }

    private isWeekend(date: Date): boolean {
        const day = date.getDay();
        return day === 0 || day === 6;
    }
} 