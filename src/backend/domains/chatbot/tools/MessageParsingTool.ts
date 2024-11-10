import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { logger } from "@/utils/logger";
import { ReservationInfo } from "../entity/ChatSessionEntity";

export class MessageParsingTool {
  static getTool() {
    return new DynamicStructuredTool({
      name: "parse_reservation_info",
      description: "사용자의 자연어 메시지에서 예약 관련 정보를 추출합니다.",
      schema: z.object({
        message: z.string().describe("분석할 사용자 메시지"),
        currentDate: z.string().optional().describe("현재 대화에서 언급된 날짜 (YYYY-MM-DD 형식)"),
        currentTimeRange: z.string().optional().describe("현재 대화에서 언급된 시간대")
      }),
      func: async ({ message, currentDate, currentTimeRange }) => {
        try {
          logger.log('메시지 파싱 시작:', {
            message,
            currentDate,
            currentTimeRange
          });

          // 파싱 결과를 저장할 객체
          const parsedInfo: Partial<ReservationInfo> = {};

          // 날짜 정보가 있으면 유지
          if (currentDate) {
            parsedInfo.date = new Date(currentDate);
          }

          // 시간 관련 키워드 처리
          if (message.includes('~')) {
            const timeMatch = message.match(/(\d{1,2})~(\d{1,2})시/);
            if (timeMatch) {
              const startHour = parseInt(timeMatch[1]);
              const endHour = parseInt(timeMatch[2]);
              parsedInfo.startTime = `${startHour.toString().padStart(2, '0')}:00`;
              parsedInfo.duration = endHour - startHour;
            }
          }

          // 이름과 목적 추출을 위한 프롬프트 생성
          const extractionPrompt = `
            다음 메시지에서 예약자 이름과 회의 목적을 추출해주세요:
            "${message}"
            
            형식:
            {
              "userName": "추출된 이름",
              "content": "추출된 회의 목적"
            }
          `;

          // LLM을 통한 정보 추출
          // 실제 구현에서는 this.model.invoke() 등을 사용
          if (message.includes('이고') && message.includes('할거야')) {
            const nameContentMatch = message.match(/나는\s+(.+?)이고\s+(.+?)\s+할거야/);
            if (nameContentMatch) {
              parsedInfo.userName = nameContentMatch[1];
              parsedInfo.content = nameContentMatch[2];
            }
          }

          logger.log('파싱 결과:', parsedInfo);

          return JSON.stringify({
            success: true,
            parsedInfo
          });
        } catch (error) {
          logger.error('메시지 파싱 에러:', error);
          return JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : '메시지 파싱 중 오류가 발생했습니다.'
          });
        }
      }
    });
  }
} 