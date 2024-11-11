import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { IReservationTool } from "./interfaces/IReservationTool";
import { SQLiteReservationTool } from "./implementations/SQLiteReservationTool";
import { logger } from "@/utils/logger";
import { ReservationValidator } from "./validators/ReservationValidator";

interface ReservationInfo {
  date?: string;
  startTime?: string;
  duration?: number;
  roomId?: number;
  userName?: string;
  content?: string;
  timeRange?: string;
}

export class ReservationTools {
  private reservationTool: IReservationTool;
  private activeReservations: Map<string, boolean> = new Map();

  constructor() {
    this.reservationTool = new SQLiteReservationTool();
  }

  getTools() {
    return [
      new DynamicStructuredTool({
        name: "find_next_available",
        description: `현재 시점으로부터 가장 빠른 예약 가능한 시간과 토론방을 찾습니다.`,
        schema: z.object({
          date: z.string().optional().describe("검색할 날짜 (YYYY-MM-DD 형식)"),
          timeRange: z.enum(["morning", "afternoon", "all"]).optional()
            .describe("검색할 시간대 (morning: 09:00-12:00, afternoon: 13:00-18:00, all: 전체)"),
          preferredRoom: z.number().optional()
            .describe("선호하는 토론방 번호 (1,4,5,6 중 선택)")
        }),
        func: async ({ date, timeRange = "all", preferredRoom }) => {
          try {
            let targetDate: Date;
            
            // 날짜 문자열 처리
            if (typeof date === 'string') {
              if (date.includes("이번주") || date.includes("다음주")) {
                const weekType = date.includes("이번주") ? "this" : "next";
                const dayMatch = date.match(/(월|화|수|목|금)요일/);
                if (dayMatch) {
                  const dayMap: { [key: string]: number } = {
                    '월': 1, '화': 2, '수': 3, '목': 4, '금': 5
                  };
                  targetDate = weekType === "this" ? 
                    this.getThisWeekday(dayMap[dayMatch[1]]) : 
                    this.getNextWeekday(dayMap[dayMatch[1]]);
                } else {
                  targetDate = new Date();
                }
              } else {
                targetDate = new Date(date);
              }
            } else {
              targetDate = new Date();
            }

            // 날짜가 과거인 경우 다음 영업일로 설정
            const today = new Date();
            if (targetDate < today) {
              targetDate = this.getNextBusinessDay(today);
            }

            logger.log('검색 날짜 계산:', {
              input: date,
              calculated: targetDate.toISOString(),
              dayOfWeek: targetDate.getDay(),
              localDate: targetDate.toLocaleDateString()
            });

            const result = await this.reservationTool.findNextAvailable({
              timeRange,
              preferredRoom,
              startFrom: targetDate
            });

            // 응답 메시지 생성
            let messageComponents = {
              type: 'availability_response',
              sections: [] as {
                type: string;
                content: string;
                items?: string[];
                style?: {
                  color?: string;
                  isBold?: boolean;
                };
              }[]
            };

            const dayOfWeek = targetDate.getDay();
            
            if (dayOfWeek === 0 || dayOfWeek === 6) {
              messageComponents.sections.push({
                type: 'error',
                content: `${targetDate.toLocaleDateString()}은(는) 주말이라 예약이 불가능합니다.`,
                style: { color: '#E53E3E' }
              });
            } else {
              const timeRangeStr = timeRange === "morning" ? "오전" : 
                                  timeRange === "afternoon" ? "오후" : "전체";
              
              messageComponents.sections.push({
                type: 'header',
                content: `${targetDate.toLocaleDateString()} ${timeRangeStr}에 예약 가능한 시간이 있습니다.`,
                style: { color: '#2B6CB0', isBold: true }
              });

              if (result.availableSlots.length > 0) {
                const timeSlots = this.formatTimeSlots(result.availableSlots);
                messageComponents.sections.push({
                  type: 'list',
                  content: '가능한 시간은 다음과 같습니다:',
                  items: timeSlots
                });
              }
            }

            return JSON.stringify({
              success: true,
              data: {
                date: targetDate.toISOString(),
                timeRange,
                availableSlots: result.availableSlots,
                messageComponents
              }
            });

          } catch (error) {
            logger.error('find_next_available 에러:', error);
            return JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
            });
          }
        }
      }),
      new DynamicStructuredTool({
        name: "check_availability",
        description: "특정 날짜와 시간의 토론방 예약 가능 여부를 확인합니다.",
        schema: z.object({
          date: z.string().describe("검색할 날짜 (YYYY-MM-DD 형식)"),
          startTime: z.string().optional().describe("시작 시간 (HH:00 형식)"),
          roomId: z.number().optional().describe("토론방 번호 (1,4,5,6 중 선택)")
        }),
        func: async ({ date, startTime, roomId }) => {
          try {
            const result = await this.reservationTool.checkAvailability(
              new Date(date),
              startTime,
              roomId
            );
            return JSON.stringify(result);
          } catch (error) {
            logger.error('check_availability 에러:', error);
            return JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
            });
          }
        }
      }),
      new DynamicStructuredTool({
        name: "create_reservation",
        description: "예약을 생성합니다.",
        schema: z.object({
          date: z.string().describe("예약 날짜 (YYYY-MM-DD 형식)"),
          startTime: z.string().describe("시작 시간 (HH:00 형식)"),
          duration: z.number().describe("사용 시간 (시간 단위)"),
          roomId: z.number().describe("토론방 번호 (1,4,5,6 중 선택)"),
          userName: z.string().describe("예약자 이름"),
          content: z.string().describe("회의 내용")
        }),
        func: async ({ date, startTime, duration, roomId, userName, content }) => {
          const reservationKey = `${date}_${startTime}_${roomId}`;
          
          try {
            // 중복 예약 방지를 위한 락 확인
            if (this.activeReservations.get(reservationKey)) {
              return JSON.stringify({
                success: false,
                error: "동일한 예약이 처리 중입니다.",
                errorType: 'DUPLICATE_REQUEST'
              });
            }
            
            this.activeReservations.set(reservationKey, true);

            // 토론방 번호가 없는 경우 가용한 방 찾기
            if (!roomId) {
              const availability = await this.reservationTool.checkAvailability(
                new Date(date),
                startTime
              );

              if (!availability.available) {
                return JSON.stringify({
                  success: false,
                  error: "선택한 시간에 예약 가능한 토론방이 없습니다.",
                  errorType: 'NO_AVAILABLE_ROOM'
                });
              }

              // 가용한 방 중 가장 작은 번호의 방 선택
              const availableRooms = availability.availableSlots
                .map(slot => slot.roomId)
                .filter((value, index, self) => self.indexOf(value) === index)
                .sort((a, b) => a - b);

              if (availableRooms.length === 0) {
                return JSON.stringify({
                  success: false,
                  error: "예약 가능한 토론방이 없습니다.",
                  errorType: 'NO_AVAILABLE_ROOM'
                });
              }

              roomId = availableRooms[0];
            }

            // 선택된 방에 대해 최종 가용성 체크
            const finalAvailability = await this.reservationTool.checkAvailability(
              new Date(date),
              startTime,
              roomId
            );

            if (!finalAvailability.available) {
              return JSON.stringify({
                success: false,
                error: `${roomId}번 토론방은 해당 시간에 이미 예약되어 있습니다.`,
                errorType: 'ROOM_NOT_AVAILABLE'
              });
            }

            // 예약 생성
            const result = await this.reservationTool.createReservation({
              date: new Date(date),
              startTime,
              duration,
              roomId,
              userName,
              content
            });

            // 성공 응답에 예약 완료 상태 플래그 추가
            return JSON.stringify({
              success: true,
              message: `예약이 완료되었습니다. (${roomId}번 토론방)`,
              reservationCompleted: true,  // 예약 완료 상태 표시
              reservationDetails: {
                date,
                startTime,
                duration,
                roomId,
                userName
              }
            });

          } catch (error) {
            logger.error('create_reservation 에러:', error);
            
            const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
            const errorType = error instanceof Error && error.message.includes('이미 예약된 시간')
              ? 'DUPLICATE_RESERVATION'
              : 'RESERVATION_CREATION_ERROR';

            return JSON.stringify({
              success: false,
              error: errorMessage,
              errorType
            });

          } finally {
            // 락 해제
            this.activeReservations.delete(reservationKey);
          }
        }
      }),
      new DynamicStructuredTool({
        name: "parse_date",
        description: "날짜 문자열을 파싱하여 실제 달력 기반의 날짜 정보를 반환합니다.",
        schema: z.object({
          dateString: z.string().describe("파싱할 날짜 문자열 (예: '다음주 화요일', '내일', 'YYYY-MM-DD')")
        }),
        func: async ({ dateString }) => {
          try {
            const today = new Date();
            let targetDate = new Date(); // 기본값으로 초기화

            // 상대적 날짜 처리
            if (dateString.includes('다음주')) {
              // 다음주 특정 요일 처리
              const dayMap: { [key: string]: number } = {
                '월요일': 1, '화요일': 2, '수요일': 3, '목요일': 4, '금요일': 5,
                '월욜': 1, '화욜': 2, '수욜': 3, '목욜': 4, '금욜': 5
              };

              for (const [day, num] of Object.entries(dayMap)) {
                if (dateString.includes(day)) {
                  targetDate = this.getNextWeekday(num);
                  break;
                }
              }
            } else if (dateString.includes('이번주')) {
              // 이번주 특정 요일 처리
              const dayMap: { [key: string]: number } = {
                '요일': 1, '화요일': 2, '수요일': 3, '목요일': 4, '금요일': 5,
                '월욜': 1, '화욜': 2, '수욜': 3, '목욜': 4, '금욜': 5
              };

              for (const [day, num] of Object.entries(dayMap)) {
                if (dateString.includes(day)) {
                  targetDate = this.getThisWeekday(num);
                  break;
                }
              }
            } else if (dateString === '내일') {
              targetDate = new Date(today);
              targetDate.setDate(today.getDate() + 1);
            } else if (dateString === '모레') {
              targetDate = new Date(today);
              targetDate.setDate(today.getDate() + 2);
            } else {
              // YYYY-MM-DD 형식 처리
              targetDate = new Date(dateString);
            }

            // 날짜가 유효하지 않은 경우
            if (!targetDate || isNaN(targetDate.getTime())) {
              throw new Error('유효하지 않은 날짜 형식입니다.');
            }

            // 주말인 경우
            const dayOfWeek = targetDate.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) {
              return JSON.stringify({
                success: false,
                error: '주말은 예약이 불가능합니다.',
                date: targetDate.toISOString(),
                dayOfWeek
              });
            }

            // 과거 날짜인 경우
            if (targetDate < today) {
              return JSON.stringify({
                success: false,
                error: '과거 날짜는 예약할 수 없습니다.',
                date: targetDate.toISOString(),
                dayOfWeek
              });
            }

            // 2주 이후인 경우
            const twoWeeksLater = new Date(today);
            twoWeeksLater.setDate(today.getDate() + 14);
            if (targetDate > twoWeeksLater) {
              return JSON.stringify({
                success: false,
                error: '2주 이후의 날짜는 예약할 수 없습니다.',
                date: targetDate.toISOString(),
                dayOfWeek
              });
            }

            return JSON.stringify({
              success: true,
              date: targetDate.toISOString(),
              dayOfWeek,
              dayName: ['일', '월', '화', '수', '목', '금', '토'][dayOfWeek],
              formattedDate: targetDate.toLocaleDateString()
            });
          } catch (error) {
            logger.error('parse_date 에러:', error);
            return JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : '날짜 파싱 중 오류가 발생했습니다.'
            });
          }
        }
      }),
      new DynamicStructuredTool({
        name: "parse_reservation_info",
        description: "사용자 메시지에서 예약 관련 정보를 추출합니다.",
        schema: z.object({
          message: z.string().describe("사용자 메시지"),
          currentInfo: z.object({
            date: z.string().optional(),
            timeRange: z.string().optional()
          }).optional()
        }),
        func: async ({ message, currentInfo }) => {
          try {
            const info: Partial<ReservationInfo> = {};
            
            // 날짜 파싱
            if (message.includes('다음주')) {
              const dayMatch = message.match(/(월|화|수|목|금)요일/);
              if (dayMatch) {
                const dayMap: { [key: string]: number } = {
                  '월': 1, '화': 2, '수': 3, '목': 4, '금': 5
                };
                const targetDate = this.getNextWeekday(dayMap[dayMatch[1]]);
                info.date = targetDate.toISOString().split('T')[0];
              }
            }

            // 시간대 파싱
            if (message.includes('오전')) {
              info.timeRange = 'morning';
            } else if (message.includes('오후')) {
              info.timeRange = 'afternoon';
            }

            // 구체적인 시간 파싱
            const timeMatch = message.match(/(\d{1,2})시(?:부터|~|\s)?(\d{1,2})?시(?:까지)?/);
            if (timeMatch) {
              const startHour = parseInt(timeMatch[1]);
              info.startTime = `${startHour.toString().padStart(2, '0')}:00`;
              if (timeMatch[2]) {
                const endHour = parseInt(timeMatch[2]);
                info.duration = endHour - startHour;
              }
            }

            // 이름과 목적 파싱
            const nameMatch = message.match(/(?:나는|제?이름은)\s*([가-힣]+)(?:이고|입니다|이야|예요|이에요)/);
            if (nameMatch) {
              info.userName = nameMatch[1];
            }

            const purposeMatch = message.match(/(?:목적은|내용은)?\s*(.+?)(?:할|하려|하고|예약|어)?(?:거야|습니다|해요|해|$)/);
            if (purposeMatch) {
              info.content = purposeMatch[1].trim();
            }

            return JSON.stringify({
              success: true,
              reservationInfo: info
            });
          } catch (error) {
            return JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : '파싱 실패'
            });
          }
        }
      }),
      new DynamicStructuredTool({
        name: "extract_conversation_date",
        description: "대화 내역과 현재 쿼리에서 예약 날짜 정보를 추출합니다.",
        schema: z.object({
          currentQuery: z.string().describe("현재 사용자의 쿼리"),
          messageHistory: z.array(z.object({
            role: z.enum(['system', 'user', 'assistant']),
            content: z.string()
          })).describe("이전 대화 내역"),
          currentDate: z.string().optional().describe("현재 저장된 날짜 정보")
        }),
        func: async ({ currentQuery, messageHistory, currentDate }) => {
          try {
            // 날짜 관련 키워드 추출
            const dateKeywords = messageHistory
              .filter(msg => msg.role !== 'system')
              .map(msg => msg.content)
              .concat(currentQuery);

            let targetDate: Date | null = null;
            
            // 현재 저장된 날짜가 있다면 우선 사용
            if (currentDate) {
              targetDate = new Date(currentDate);
            }

            // 새로운 날짜 정보가 있는지 확인
            for (const content of dateKeywords.reverse()) { // 최신 메시지부터 확인
              if (content.includes('다음주')) {
                const dayMatch = content.match(/(월|화|수|목|금)요일/);
                if (dayMatch) {
                  const dayMap: { [key: string]: number } = {
                    '월': 1, '화': 2, '수': 3, '목': 4, '금': 5
                  };
                  targetDate = this.getNextWeekday(dayMap[dayMatch[1]]);
                  break;
                }
              }
              // 다른 날짜 패턴들도 여기서 처리
            }

            if (!targetDate) {
              return JSON.stringify({
                success: false,
                error: "날짜 정보를 찾을 수 없습니다."
              });
            }

            return JSON.stringify({
              success: true,
              date: targetDate.toISOString(),
              formattedDate: targetDate.toLocaleDateString('ko-KR'),
              dayOfWeek: ['일', '월', '화', '수', '목', '금', '토'][targetDate.getDay()]
            });
          } catch (error) {
            logger.error('날짜 추출 실패:', error);
            return JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "날짜 추출 중 오류가 발생했습니다."
            });
          }
        }
      }),
      new DynamicStructuredTool({
        name: "check_reservation_availability",
        description: "특정 시간의 예약 가능 여부를 확인합니다.",
        schema: z.object({
          date: z.string().describe("확인할 날짜 (YYYY-MM-DD 형)"),
          startTime: z.string().describe("시작 시간 (HH:00 형식)"),
          roomId: z.number().describe("토론방 번호")
        }),
        func: async ({ date, startTime, roomId }) => {
          try {
            const availability = await this.reservationTool.checkAvailability(
              new Date(date),
              startTime,
              roomId
            );

            return JSON.stringify({
              success: true,
              available: availability.available,
              message: availability.available 
                ? "예약 가능한 시간입니다."
                : "이미 예약된 시간입니다."
            });
          } catch (error) {
            logger.error('check_availability 에러:', error);
            return JSON.stringify({
              success: false,
              error: "가용성 확인 중 오류가 발생했습니다."
            });
          }
        }
      })
    ];
  }

  private getThisWeekday(targetDay: number): Date {
    const today = new Date();
    const currentDay = today.getDay();
    const distance = targetDay - currentDay;
    const result = new Date(today);
    result.setDate(today.getDate() + (distance >= 0 ? distance : distance + 7));
    return result;
  }

  private getNextWeekday(targetDay: number): Date {
    const today = new Date();
    const result = new Date(today);
    result.setDate(today.getDate() + (7 - today.getDay()) + targetDay);
    return result;
  }

  private getNextBusinessDay(date: Date): Date {
    const result = new Date(date);
    do {
      result.setDate(result.getDate() + 1);
    } while (result.getDay() === 0 || result.getDay() === 6);
    return result;
  }

  private formatTimeSlots(slots: Array<{ startTime: string; endTime: string }>): string[] {
    return slots.map(slot => `${slot.startTime}~${slot.endTime}`);
  }
} 