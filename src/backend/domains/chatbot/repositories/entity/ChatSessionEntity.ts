export interface ReservationInfo {
  date?: Date;
  startTime?: string;
  duration?: number;
  roomId?: number;
  userName?: string;
  content?: string;
}

export class ChatSessionEntity {
  private reservationInfo: ReservationInfo = {};
  private messages: Array<{ role: 'user' | 'assistant', content: string }> = [];

  constructor(public readonly userId: string) {
    this.reservationInfo = {};
    this.messages = [];
  }

  updateReservationInfo(info: Partial<ReservationInfo>) {
    this.reservationInfo = { ...this.reservationInfo, ...info };
  }

  hasRequiredInfo(): boolean {
    return !!(this.reservationInfo.date && 
              this.reservationInfo.startTime && 
              this.reservationInfo.duration && 
              this.reservationInfo.userName && 
              this.reservationInfo.content);
  }

  getReservationInfo() {
    return { ...this.reservationInfo };
  }

  clearReservationInfo() {
    this.reservationInfo = {};
  }

  addMessage(role: 'user' | 'assistant', content: string): void {
    this.messages.push({ role, content });
  }

  getMessages() {
    return this.messages;
  }

  getRecentMessages(count: number) {
    return this.messages.slice(-count);
  }

  public isReservationComplete(): boolean {
    const info = this.reservationInfo;
    return !!(
      info.date &&
      info.startTime &&
      info.duration &&
      info.userName &&
      info.content &&
      info.roomId
    );
  }
} 