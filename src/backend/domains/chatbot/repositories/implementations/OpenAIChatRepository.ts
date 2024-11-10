import { ChatOpenAI } from "@langchain/openai";
import { IChatRepository, ChatMessage, ChatResponse, StreamCallback } from "../IChatRepository";
import { logger } from '@/utils/logger';
import { Serialized } from "@langchain/core/load/serializable";
import { ReservationTools } from '../../tools/ToolDefinitions';
import { SQLiteReservationTool } from '../../tools/implementations/SQLiteReservationTool';
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { AgentStep } from "langchain/agents";
import { ChatSessionEntity, ReservationInfo } from '../entity/ChatSessionEntity';
import { SessionManager } from '../../service/SessionManager';

export class OpenAIChatRepository implements IChatRepository {
  private static instance: OpenAIChatRepository;
  private model: ChatOpenAI;
  private messageHistory: { role: 'system' | 'user' | 'assistant', content: string }[] = [];
  private agent: AgentExecutor | null = null;
  private reservationTool: SQLiteReservationTool;
  private maxRetries = 2;
  private retryCount = 0;
  private sessions: Map<string, ChatSessionEntity> = new Map();

  private constructor() {
    try {
      logger.log('OpenAIChatRepository 초기화 시작');
      const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
      logger.log('API Key 형식 확인:', {
        exists: !!apiKey,
        startsWithSk: apiKey?.startsWith('sk-'),
        length: apiKey?.length
      });
      
      if (!apiKey || !apiKey.startsWith('sk-')) {
        throw new Error('Invalid OpenAI API key format');
      }

      logger.log('ChatOpenAI 모델 초기화 시작');
      this.model = new ChatOpenAI({
        openAIApiKey: apiKey,
        modelName: "gpt-4o-mini",
        temperature: 0.7,
        streaming: true,
      });
      logger.log('ChatOpenAI 모델 초기화 완료');

      // 현재 날짜와 요일 정보 가져오기
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;
      const currentDate = today.getDate();
      
      // 시스템 프롬프트 초기화
      this.messageHistory = [{
        role: 'system',
        content: `당신은 토론방 예약 시스템의 상담원입니다.
        현재 날짜는 ${currentYear}년 ${currentMonth}월 ${currentDate}일입니다.

        예약 가능 여부 확인 시:
        1. 특정 날짜/시간 의 시 -> find_next_available 사용 (date, timeRange 파라미터 활용)
        2. 예약 생성 시에만 사용자의 이름과 회의 목적을 추가로 문의

        예약 시스템 정보:
        - 예약 가능한 토론방: 1, 4, 5, 6번
        - 예약 가능 시간: 평일 09:00-18:00
        - 한 번에 최대 3시간까지 예약 가능
        - 예약 시 필요한 정보: 날짜, 시간, 사용 목적, 예약자 이름
        
        주의사항:
        - 주말(토,일)은 예약 불가
        - 당일 예약 가능 (현재 시간 이후만)
        - 최대 2주 이내의 예약만 가능
        
        사용자의 예약 관련 문의에 친절하게 답변하고, 필요한 정보를 순차적으로 수집해주세요.
        현재 날짜를 기준으로 예약 가능 여부를 판단해주세요.
        
        예시:
        - "다음주 화요일 예약 가능해?" -> find_next_available (date: "0000-00-00")
        - "내일 오전에 가능한 방 있어?" -> find_next_available (date: "0000-00-00", timeRange: "morning")
        - "3시에 예약하고 싶은데" -> 이름과 회의 목적 문의 후 create_reservation

        불필요 정보는 즉시 요청하지 말고, 예약 가능한 시간을 먼저 확인해주세요.`
      }];

      this.reservationTool = new SQLiteReservationTool();
      logger.log('SQLiteReservationTool 초기화 완료');

      this.initializeAgent().then(() => {
        logger.log('Agent 초기화 완료');
      }).catch(error => {
        logger.error('Agent 초기화 실패:', error);
      });

    } catch (error) {
      logger.error('OpenAIChatRepository 초기화 중 에러:', error);
      throw error;
    }
  }

  private async initializeAgent() {
    try {
      logger.log('Agent 초기화 시작');
      const tools = new ReservationTools().getTools();
      logger.log('Tools 생성 완료:', tools.map(t => t.name));
      
      const prompt = ChatPromptTemplate.fromMessages([
        ["system", `${this.messageHistory[0].content}
        
        추가 지침:
        1. 이전 대화에서 확인된 정보를 우선적으로 활용하세요.
        2. 날짜가 이미 확인된 경우, 해당 날짜를 기준으로 예약을 진행하세요.
        3. 새로운 정보는 기존 정보를 대체하지 않고 보완하는 방식으로 처리하세요.
        4. 모든 도구 사용 시 이전 컨텍스트를 반드시 참조하세요.`],
        ["human", "{input}"],
        ["assistant", "{agent_scratchpad}"]
      ]);

      const agent = await createOpenAIFunctionsAgent({
        llm: this.model,
        tools,
        prompt
      });

      this.agent = AgentExecutor.fromAgentAndTools({
        agent,
        tools,
        verbose: true,
        returnIntermediateSteps: true,
        maxIterations: 5,
        handleParsingErrors: true
      });

      logger.log('Agent 초기화 완료');
    } catch (error) {
      logger.error('Agent 초기화 실패:', error);
      throw error;
    }
  }

  public static getInstance(): OpenAIChatRepository {
    logger.log('OpenAIChatRepository.getInstance 호출');
    if (!OpenAIChatRepository.instance) {
      logger.log('새 OpenAIChatRepository 인스턴스 생성');
      OpenAIChatRepository.instance = new OpenAIChatRepository();
    }
    return OpenAIChatRepository.instance;
  }

  async sendMessage(message: ChatMessage, onStream: StreamCallback): Promise<ChatResponse> {
    try {
      let session = this.sessions.get(message.userId);
      if (!session) {
        session = new ChatSessionEntity(message.userId);
        this.sessions.set(message.userId, session);
      }

      // 사용자 메시지를 히스토리에 추가
      session.addMessage('user', message.content);
      this.messageHistory.push({ role: 'user', content: message.content });

      // 날짜 정보 추출 시도
      if (!session.getReservationInfo().date) {
        if (message.content.includes('다음주')) {
          const dayMatch = message.content.match(/(월|화|수|목|금)요일/);
          if (dayMatch) {
            const dayMap: { [key: string]: number } = {
              '월': 1, '화': 2, '수': 3, '목': 4, '금': 5
            };
            const targetDate = this.getNextWeekday(dayMap[dayMatch[1]]);
            session.updateReservationInfo({ date: targetDate });
            logger.log('날짜 정보 저장:', {
              input: message.content,
              extractedDate: targetDate.toISOString()
            });
          }
        }
      }

      // 다른 예약 정보 파싱 및 업데이트
      const reservationInfo = await this.extractReservationInfo(message.content, message.userId);
      if (reservationInfo) {
        session.updateReservationInfo(reservationInfo);
        logger.log('예약 정보 업데이트:', {
          sessionId: message.userId,
          updatedInfo: reservationInfo,
          currentState: session.getReservationInfo()
        });
      }

      const response = await this.executeWithRetry(message, onStream);
      
      // AI 응답을 히스토리에 추가
      session.addMessage('assistant', response.content);
      this.messageHistory.push({ role: 'assistant', content: response.content });

      return response;
    } catch (error) {
      logger.error('메시지 처리 실패:', error);
      return {
        content: '죄송합니다. 요청을 처리하는 중에 오류가 발생했습니다.',
        userId: 'bot',
        timestamp: new Date()
      };
    }
  }

  private async extractReservationInfo(message: string, sessionId: string): Promise<Partial<ReservationInfo> | null> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) return null;

      const currentInfo = session.getReservationInfo();
      const info: Partial<ReservationInfo> = {};

      // 시간 정보 파싱
      if (message.includes('~')) {
        const timeMatch = message.match(/(\d{1,2})~(\d{1,2})시/);
        if (timeMatch) {
          const [_, startHour, endHour] = timeMatch;
          info.startTime = `${startHour.padStart(2, '0')}:00`;
          info.duration = Number(endHour) - Number(startHour);
        }
      }

      // 이름과 목적 파싱
      const nameMatch = message.match(/나는\s+([가-힣]+)이고/);
      const purposeMatch = message.match(/이고\s+(.+?)\s*(?:할거야|합니다|해요|할게요)$/);

      if (nameMatch) info.userName = nameMatch[1];
      if (purposeMatch) info.content = purposeMatch[1];

      // 기존 정보 유지
      return {
        ...currentInfo,
        ...info
      };
    } catch (error) {
      logger.error('예약 정보 추출 실패:', error);
      return null;
    }
  }

  private async executeWithRetry(message: ChatMessage, onStream: StreamCallback): Promise<ChatResponse> {
    try {
      const session = this.sessions.get(message.userId);
      if (!session) {
        throw new Error('세션을 찾을 수 없습니다.');
      }

      // 예약 정보 추출
      const reservationInfo = await this.extractReservationInfo(message.content, message.userId);
      if (reservationInfo) {
        session.updateReservationInfo(reservationInfo);
      }

      const currentInfo = session.getReservationInfo();
      const { contextualQuery } = this.buildCombinedContext(message, currentInfo);

      if (!this.agent) {
        throw new Error('Agent가 초기화되지 않았습니다.');
      }

      // Agent를 통한 실행
      const result = await this.agent.invoke({
        input: contextualQuery,
        callbacks: [{
          handleLLMNewToken: (token: string) => {
            onStream(token);
          }
        }]
      });

      // 예약 생성 조건 확인
      if (this.isReadyToCreateReservation(currentInfo)) {
        return await this.createReservation(session, currentInfo);
      }

      return {
        content: result.output,
        userId: 'bot',
        timestamp: new Date()
      };

    } catch (error) {
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        return this.executeWithRetry(message, onStream);
      }
      logger.error('실행 중 오류 발생:', error);
      throw error;
    } finally {
      this.retryCount = 0;
    }
  }

  private isReadyToCreateReservation(info: ReservationInfo): boolean {
    return !!(
      info.date &&
      info.startTime &&
      info.duration &&
      info.userName &&
      info.content
    );
  }

  private async createReservation(session: ChatSessionEntity, reservationInfo: ReservationInfo): Promise<ChatResponse> {
    if (!this.agent) throw new Error('Agent not initialized');
    
    const result = await this.agent.invoke({
        input: `create_reservation
            date: ${reservationInfo.date?.toISOString()}
            startTime: ${reservationInfo.startTime}
            duration: ${reservationInfo.duration}
            roomId: ${reservationInfo.roomId}
            userName: ${reservationInfo.userName}
            content: ${reservationInfo.content}
        `
    });

    if (result?.output?.includes('예약이 완료되었습니다')) {
        return {
            content: result.output,
            userId: 'bot',
            timestamp: new Date()
        };
    }

    throw new Error('예약 생성 실패');
  }

  private buildCombinedContext(message: ChatMessage, reservationInfo: ReservationInfo) {
    // 이전 대화에서 확인된 정보 수집
    const previousContext = {
      confirmedDate: reservationInfo.date ? 
        `이전 대화에서 확인된 날짜: ${reservationInfo.date.toLocaleDateString()}` : '',
      confirmedTime: reservationInfo.startTime ? 
        `확인된 시작 시간: ${reservationInfo.startTime}` : '',
      confirmedDuration: reservationInfo.duration ? 
        `확인된 예약 시간: ${reservationInfo.duration}시간` : '',
      confirmedName: reservationInfo.userName ? 
        `예약자 이름: ${reservationInfo.userName}` : '',
      confirmedPurpose: reservationInfo.content ? 
        `회의 목적: ${reservationInfo.content}` : ''
    };

    // 이전 맥락과 현재 메시지를 결합
    const contextualQuery = [
      previousContext.confirmedDate,
      previousContext.confirmedTime,
      previousContext.confirmedDuration,
      previousContext.confirmedName,
      previousContext.confirmedPurpose,
      `현재 요청: ${message.content}`
    ].filter(Boolean).join('\n');

    logger.log('대화 맥락 구성:', {
      previousContext,
      contextualQuery,
      currentMessage: message.content
    });

    return {
      contextualQuery,
      previousContext
    };
  }

  // 대화 히스토리 관리 메서드 추가
  public clearHistory(): void {
    this.messageHistory = [this.messageHistory[0]]; // 시스템 프롬프트만 유지
  }

  public getHistory(): Array<{ role: 'system' | 'user' | 'assistant', content: string }> {
    return [...this.messageHistory];
  }

  private getCurrentTimeRange(info: ReservationInfo): string | undefined {
    if (!info.startTime) return undefined;
    const hour = parseInt(info.startTime.split(':')[0]);
    if (hour >= 9 && hour < 12) return 'morning';
    if (hour >= 13 && hour < 18) return 'afternoon';
    return undefined;
  }

  // 날짜 검증 로직 수정
  private validateReservationDate(date: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);  // 당일 자정으로 설정
    
    const twoWeeksLater = new Date(today);
    twoWeeksLater.setDate(today.getDate() + 14);
    twoWeeksLater.setHours(23, 59, 59, 999);  // 2주 후 마지막 시간으로 설정

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);  // 비교를 위해 시간 초기화

    return targetDate >= today && targetDate <= twoWeeksLater;
  }

  private getNextWeekday(targetDay: number): Date {
    const today = new Date();
    const result = new Date(today);
    
    // 다음 주의 시작일(월요일)로 이동
    while (result.getDay() !== 1) {
      result.setDate(result.getDate() + 1);
    }
    
    // 원하는 요일까지 이동
    while (result.getDay() !== targetDay) {
      result.setDate(result.getDate() + 1);
    }
    
    return result;
  }
} 