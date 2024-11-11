import { ChatOpenAI } from "@langchain/openai";
import { IChatRepository, ChatMessage, ChatResponse, StreamCallback } from "../IChatRepository";
import { logger } from '@/utils/logger';
import { ReservationTools } from '../../tools/ToolDefinitions';
import { SQLiteReservationTool } from '../../tools/implementations/SQLiteReservationTool';
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatSessionEntity, ReservationInfo } from '../entity/ChatSessionEntity';

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
        modelName: "gpt-4o",
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

      // 메시지 히스토리에 추가
      session.addMessage('user', message.content);
      
      // 현재 예약 정보 가져오기
      const currentInfo = session.getReservationInfo();
      
      // Agent 컨텍스트 구성
      const contextMessage = this.buildContextMessage(message.content, currentInfo, session.getRecentMessages(5));

      // Agent 실행
      const result = await this.agent?.invoke({
        input: contextMessage,
        callbacks: [{
          handleLLMNewToken: (token: string) => {
            onStream(token);
          }
        }]
      });

      if (!result) throw new Error('Agent 응답 없음');

      // 응답 저장
      const response = {
        content: result.output,
        userId: 'bot',
        timestamp: new Date()
      };

      session.addMessage('assistant', response.content);
      return response;

    } catch (error) {
      logger.error('메시지 처리 실패:', error);
      throw error;
    }
  }

  private buildContextMessage(
    message: string,
    reservationInfo: ReservationInfo,
    recentMessages: Array<{role: 'user' | 'assistant', content: string}>
  ): string {
    const contextParts = [];

    // 예약 정보 포함
    if (Object.keys(reservationInfo).length > 0) {
      contextParts.push('현재 예약 정보:');
      Object.entries(reservationInfo).forEach(([key, value]) => {
        if (value !== undefined) {
          contextParts.push(`${key}: ${value instanceof Date ? value.toLocaleDateString() : value}`);
        }
      });
      contextParts.push('');
    }

    // 최근 대화 내역 포함
    contextParts.push('최근 대화:');
    recentMessages.forEach(msg => {
      contextParts.push(`${msg.role === 'user' ? '사용자' : 'AI'}: ${msg.content}`);
    });
    contextParts.push('');

    // 현재 메시지 추가
    contextParts.push(`현재 메시지: ${message}`);

    return contextParts.join('\n');
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