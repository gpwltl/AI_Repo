import { ReservationInfo } from '../entity/ChatSessionEntity';

export class ReservationValidator {
  static validateDate(date: Date): string | null {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    if (targetDate < today) {
      return "과거 날짜는 예약할 수 없습니다.";
    }
    
    const dayOfWeek = targetDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return "주말은 예약할 수 없습니다.";
    }
    
    // 30일 이후의 예약은 제한
    const thirtyDaysLater = new Date(today);
    thirtyDaysLater.setDate(today.getDate() + 30);
    
    if (targetDate > thirtyDaysLater) {
      return "30일 이후의 예약은 불가능합니다.";
    }
    
    return null;
  }

  static validateTime(time: string): string | null {
    const [hours] = time.split(':').map(Number);
    if (hours < 9 || hours >= 18) {
      return "예약 가능 시간은 09:00 ~ 18:00입니다.";
    }
    return null;
  }

  static validateDuration(duration: number): string | null {
    if (duration < 1 || duration > 9) {
      return "예약 시간은 1시간 이상 9시간 이하여야 합니다.";
    }
    return null;
  }

  static validateRoomId(roomId: number): string | null {
    if (![1, 4, 5, 6].includes(roomId)) {
      return "유효하지 않은 토론방 번호입니다. (가능한 번호: 1, 4, 5, 6)";
    }
    return null;
  }

  static validateReservationInfo(info: ReservationInfo): string[] {
    const errors: string[] = [];

    if (info.date) {
      const dateError = this.validateDate(info.date);
      if (dateError) errors.push(dateError);
    }

    if (info.startTime) {
      const timeError = this.validateTime(info.startTime);
      if (timeError) errors.push(timeError);
    }

    if (info.duration) {
      const durationError = this.validateDuration(info.duration);
      if (durationError) errors.push(durationError);
    }

    if (info.roomId) {
      const roomError = this.validateRoomId(info.roomId);
      if (roomError) errors.push(roomError);
    }

    return errors;
  }
} 