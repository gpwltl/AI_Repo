import { logger } from '@/utils/logger';

export interface ReservationInfo {
  date?: Date;
  startTime?: string;
  duration?: number;
  roomId?: number;
  userName?: string;
  content?: string;
}

export enum ReservationState {
  COLLECTING_INFO = 'COLLECTING_INFO',
  CONFIRMING = 'CONFIRMING',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED'
}

export class ChatSessionEntity {
  private readonly sessionId: string;
  private messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }> = [];
  private reservationInfo: ReservationInfo = {};
  private reservationState: ReservationState = ReservationState.COLLECTING_INFO;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  addMessage(role: 'user' | 'assistant', content: string): void {
    this.messages.push({
      role,
      content,
      timestamp: new Date()
    });
  }

  getMessages(): Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }> {
    return [...this.messages];
  }

  getRecentMessages(count: number = 10): Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }> {
    return [...this.messages].slice(-count);
  }

  updateReservationInfo(info: Partial<ReservationInfo>): void {
    if (info.date && (!this.reservationInfo.date || 
        info.date.getTime() !== this.reservationInfo.date.getTime())) {
      logger.log('날짜 정보 업데이트:', {
        oldDate: this.reservationInfo.date?.toISOString(),
        newDate: info.date.toISOString()
      });
    }

    this.reservationInfo = {
      ...this.reservationInfo,
      ...info
    };

    logger.log('예약 정보 업데이트 완료:', {
      userId: this.sessionId,
      currentState: this.reservationInfo
    });
  }

  getReservationInfo(): ReservationInfo {
    return this.reservationInfo;
  }

  setReservationState(state: ReservationState): void {
    this.reservationState = state;
  }

  hasRequiredInfo(): boolean {
    return !!(
      this.reservationInfo.date &&
      this.reservationInfo.startTime &&
      this.reservationInfo.duration &&
      this.reservationInfo.userName &&
      this.reservationInfo.content
    );
  }

  getMissingFields(): string[] {
    const missingFields: string[] = [];
    if (!this.reservationInfo.date) missingFields.push("날짜");
    if (!this.reservationInfo.duration) missingFields.push("사용시간");
    if (!this.reservationInfo.userName) missingFields.push("예약자 이름");
    if (!this.reservationInfo.content) missingFields.push("회의 내용");
    return missingFields;
  }

  clearReservationInfo(): void {
    this.reservationInfo = {};
    this.reservationState = ReservationState.COLLECTING_INFO;
  }

  getReservationState(): ReservationState {
    return this.reservationState;
  }

  isReservationComplete(): boolean {
    const info = this.reservationInfo;
    return !!(
      info.date &&
      info.startTime &&
      info.duration &&
      info.roomId &&
      info.userName &&
      info.content
    );
  }
} 