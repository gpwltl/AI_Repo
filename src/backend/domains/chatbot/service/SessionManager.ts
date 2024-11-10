import { ChatSessionEntity, ReservationInfo } from '../entity/ChatSessionEntity';
import { logger } from '@/utils/logger';

export class SessionManager {
  private static instance: SessionManager;
  private sessions: Map<string, ChatSessionEntity> = new Map();

  private constructor() {}

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  getSession(sessionId: string): ChatSessionEntity {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = new ChatSessionEntity(sessionId);
      this.sessions.set(sessionId, session);
      logger.log('새 세션 생성:', sessionId);
    }
    return session;
  }

  updateSessionInfo(sessionId: string, info: Partial<ReservationInfo>): void {
    const session = this.getSession(sessionId);
    session.updateReservationInfo(info);
    logger.log('세션 정보 업데이트:', {
      sessionId,
      updatedInfo: info,
      currentState: session.getReservationInfo()
    });
  }

  clearSession(sessionId: string): void {
    const session = this.getSession(sessionId);
    session.clearReservationInfo();
    logger.log('세션 초기화:', sessionId);
  }
} 