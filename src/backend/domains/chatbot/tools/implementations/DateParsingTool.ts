import { addDays, startOfDay, nextDay } from 'date-fns';
import { logger } from '@/utils/logger';

export class DateParsingTool {
  private static DAYS_KR = ['일', '월', '화', '수', '목', '금', '토'];
  private static DAY_KEYWORDS = ['다음주', '이번주', '다다음주'];

  static parseDateString(dateString: string): Date {
    try {
      const today = startOfDay(new Date());
      
      // 상대적 날짜 처리 (예: "다음주 화요일")
      if (dateString.includes('요일')) {
        const weekKeyword = this.DAY_KEYWORDS.find(key => dateString.includes(key));
        const dayName = this.DAYS_KR.findIndex(day => dateString.includes(day));
        
        if (dayName === -1) {
          throw new Error('올바른 요일을 찾을 수 없습니다.');
        }

        let targetDate = today;
        
        // 주 단위 계산
        if (weekKeyword === '다음주') {
          targetDate = addDays(today, 7);
        } else if (weekKeyword === '다다음주') {
          targetDate = addDays(today, 14);
        }

        // 해당 주의 특정 요일 찾기
        while (targetDate.getDay() !== dayName) {
          targetDate = addDays(targetDate, 1);
        }

        logger.log('날짜 파싱 결과:', {
          input: dateString,
          parsed: targetDate.toISOString(),
          dayOfWeek: targetDate.getDay()
        });

        return targetDate;
      }

      // 직접적인 날짜 처리 (예: "2024-11-12")
      const parsedDate = new Date(dateString);
      if (isNaN(parsedDate.getTime())) {
        throw new Error('유효하지 않은 날짜 형식입니다.');
      }

      return parsedDate;
    } catch (error) {
      logger.error('날짜 파싱 에러:', error);
      throw error;
    }
  }
} 