export class ReservationValidator {
  static validateDate(date: Date): string | null {
    const today = new Date();
    const twoWeeksLater = new Date(today);
    twoWeeksLater.setDate(today.getDate() + 14);

    if (isNaN(date.getTime())) return "유효하지 않은 날짜입니다.";
    if (date < today) return "과거 날짜는 예약할 수 없습니다.";
    if (date > twoWeeksLater) return "2주 이후의 날짜는 예약할 수 없습니다.";
    
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return "주말은 예약할 수 없습니다.";

    return null;
  }

  static validateTime(time: string): string | null {
    const hour = parseInt(time.split(':')[0]);
    if (isNaN(hour) || hour < 9 || hour >= 18) {
      return "예약 가능 시간은 09:00-18:00입니다.";
    }
    return null;
  }

  static validateDuration(duration: number): string | null {
    if (duration < 1 || duration > 4) {
      return "예약 시간은 1-4시간 사이여야 합니다.";
    }
    return null;
  }

  static validateRoomId(roomId: number): string | null {
    if (![1, 4, 5, 6].includes(roomId)) {
      return "유효하지 않은 토론방 번호입니다. (가능: 1, 4, 5, 6)";
    }
    return null;
  }
} 