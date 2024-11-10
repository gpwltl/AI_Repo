import { IReservationTool } from '../interfaces/IReservationTool';
import { DateParsingTool } from './DateParsingTool';
import { ReservationValidator } from '../../validators/ReservationValidator';
import { logger } from '@/utils/logger';

interface CreateReservationParams {
  date: Date;
  startTime: string;
  duration: number;
  roomId: number;
  userName: string;
  content: string;
}

export class SQLiteReservationTool implements IReservationTool {
  private activeReservations = new Map<string, boolean>();

  constructor() {
    logger.log('SQLiteReservationTool initialized');
  }

  async checkAvailability(date: Date, startTime?: string, roomId?: number) {
    try {
      logger.log('checkAvailability 호출:', { date, startTime, roomId });

      const response = await fetch('/api/reservation/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: date.toISOString(),
          startTime,
          roomId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '가용성 확인 실패');
      }

      const result = await response.json();
      logger.log('가용성 확인 결과:', result);
      
      return result.data;
    } catch (error) {
      logger.error('checkAvailability 에러:', error);
      throw error;
    }
  }

  async createReservation(info: {
    date: string | Date;
    startTime: string;
    duration: number;
    roomId: number;
    userName: string;
    content: string;
  }): Promise<boolean> {
    const reservationKey = `${info.date}_${info.startTime}_${info.roomId}`;
    
    try {
      // 중복 예약 방지를 위한 락 확인
      if (this.activeReservations.get(reservationKey)) {
        throw new Error('동일한 예약이 처리 중입니다.');
      }
      
      this.activeReservations.set(reservationKey, true);

      // 날짜 형식 변환
      const date = typeof info.date === 'string' ? new Date(info.date) : info.date;
      const formattedDate = date.toISOString().split('T')[0];

      const requestBody = {
        date: formattedDate,
        startTime: info.startTime,
        duration: info.duration,
        roomId: info.roomId,
        userName: info.userName,
        content: info.content
      };

      logger.log('예약 요청:', requestBody);

      const result = await fetch('/api/reservation/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!result.ok) {
        const errorData = await result.json();
        throw new Error(errorData.error || '예약 생성에 실패했습니다.');
      }

      const responseData = await result.json();
      return responseData.success;

    } catch (error) {
      logger.error('예약 생성 중 에러:', error);
      throw error;
    } finally {
      // 락 해제
      this.activeReservations.delete(reservationKey);
    }
  }

  async findNextAvailable(options: {
    timeRange: "morning" | "afternoon" | "all";
    preferredRoom?: number;
    startFrom: Date | string;
  }): Promise<{
    availableSlots: Array<{
      date: string;
      roomId: number;
      startTime: string;
      endTime: string;
    }>;
    success?: boolean;
    error?: string;
    messageComponents?: any;
  }> {
    try {
      const targetDate = typeof options.startFrom === 'string' 
        ? DateParsingTool.parseDateString(options.startFrom)
        : options.startFrom;

      logger.log('findNextAvailable 요청:', {
        targetDate,
        timeRange: options.timeRange,
        preferredRoom: options.preferredRoom
      });

      const validationError = ReservationValidator.validateDate(targetDate);
      if (validationError) {
        return {
          availableSlots: [],
          success: false,
          error: validationError
        };
      }

      // API 호출로 예약된 시간 확인
      const response = await fetch('/api/reservation/find-next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: targetDate.toISOString(),
          timeRange: options.timeRange,
          preferredRoom: options.preferredRoom
        })
      });

      if (!response.ok) {
        throw new Error('가용성 확인 실패');
      }

      const result = await response.json();
      logger.log('API 응답:', result);
      
      // 시간대별 기본 슬롯 생성
      const timeRanges = {
        morning: { start: 9, end: 12 },
        afternoon: { start: 13, end: 18 },
        all: { start: 9, end: 18 }
      };
      
      const range = timeRanges[options.timeRange] || timeRanges.all;
      const defaultSlots = [];
      
      // 모든 방에 대해 기본 시간 슬롯 생성
      const rooms = [1, 4, 5, 6];
      for (const roomId of rooms) {
        if (options.preferredRoom && options.preferredRoom !== roomId) continue;
        
        for (let hour = range.start; hour < range.end; hour++) {
          defaultSlots.push({
            date: targetDate.toISOString().split('T')[0],
            roomId,
            startTime: `${hour.toString().padStart(2, '0')}:00`,
            endTime: `${(hour + 1).toString().padStart(2, '0')}:00`
          });
        }
      }

      // result.data가 비어있거나 배열이 아닌 경우 처리
      const reservedSlots = Array.isArray(result.data) ? result.data : [];
      
      // 예약된 시간이 없으면 모든 시간이 가능
      if (reservedSlots.length === 0) {
        logger.log('예약된 시간 없음, 모든 시간 사용 가능');
        return {
          availableSlots: defaultSlots,
          success: true
        };
      }

      // 예약된 시간을 제외한 가용 시간 계산
      const availableSlots = defaultSlots.filter(slot => {
        return !reservedSlots.some((reserved: any) => 
          reserved.roomId === slot.roomId && 
          reserved.startTime === slot.startTime
        );
      });

      logger.log('가용 시간 계산 완료:', {
        totalSlots: defaultSlots.length,
        reservedSlots: reservedSlots.length,
        availableSlots: availableSlots.length
      });

      return {
        availableSlots,
        success: true
      };

    } catch (error) {
      logger.error('findNextAvailable 에러:', error);
      return {
        availableSlots: [],
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      };
    }
  }
} 