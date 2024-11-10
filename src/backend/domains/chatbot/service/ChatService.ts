import { ChatOpenAI } from "@langchain/openai";
import { ChatSessionEntity } from '../entity/ChatSessionEntity';
import { IReservationTool } from '../tools/interfaces/IReservationTool';
import { SQLiteReservationTool } from '../tools/implementations/SQLiteReservationTool';
import { ReservationTools } from '../tools/ToolDefinitions';
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { ReservationState } from '../entity/ChatSessionEntity';
import { ReservationValidator } from '../validators/ReservationValidator';
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { formatToOpenAIFunctionMessages } from "langchain/agents/format_scratchpad";
import { ReservationInfo } from '../types/ReservationTypes';
import { AgentStep } from 'langchain/agents';

interface ToolOutput {
  data?: {
    messageComponents?: unknown;
  };
}

export class ChatService {
  private static instance: ChatService;
  private model: ChatOpenAI;
  private reservationTool: IReservationTool;
  private sessions: Map<string, ChatSessionEntity>;
  private agent: AgentExecutor | null = null;
  private isCreatingReservation: boolean = false;

  constructor() {
    console.log('ChatService 초기화 시작');
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    console.log('OpenAI API Key 존재 여부:', !!apiKey);
    
    if (!apiKey) {
      console.error('OpenAI API key not found');
      throw new Error('OpenAI API key not found');
    }

    this.sessions = new Map();
    
    try {
      this.model = new ChatOpenAI({
        openAIApiKey: apiKey,
        modelName: "gpt-4o-mini",
        temperature: 0.7,
        streaming: true,
      });
      console.log('ChatOpenAI 모델 초기화 성공');

      this.reservationTool = new SQLiteReservationTool();
      console.log('SQLiteReservationTool 초기화 성공');

      this.initializeAgent().then(() => {
        console.log('Agent 초기화 완료');
      }).catch(error => {
        console.error('Agent 초기화 실패:', error);
      });
    } catch (error) {
      console.error('ChatService 초기화 실패:', error);
      throw error;
    }
  }

  private async initializeAgent() {
    try {
      console.log('Agent 초기화 시작');
      const tools = new ReservationTools().getTools();
      console.log('Tools 생성 완료:', tools.map(t => t.name));
      
      const prompt = ChatPromptTemplate.fromMessages([
        ["system", `당신은 토론방 예약을 도와주는 AI 어시스턴트입니다.
        
        # 예약 관련 준수사항
        - 예약에 필요한 정보: 날짜(필수), 사용시간대(필수), 토론방번호(1,4,5,6중 선택), 예약자이름(필수), 회의내용(필수)
        - 예약 가능 시간: 평일 9시~18시
        - 시간 단위: 1시간
        - 토론방 예약과 관련없는 질문에는 "토론방 예약 관련 문의만 답변 가능합니다." 라고 답변하세요.
        - 모든 필수 정보가 수집되면 예약 가능 여부를 확인하고 예약을 진행하세요.
        - 사용자의 의도를 파악하여 자연스럽게 대화를 이어가며 필요한 정보를 수집하세요.
        
        # 에이전트 실행
        - 모든 예약 관련 답변은 tool을 활용하여 sqlite에서 예약 정보를 조회한 뒤에 답변하세요. 
        - 반드시 사실을 기반으로 대답해야 합니다. 
        - 모든 대화기록이 메모리에 저장됩니다. 
        - 대화 내용을 기반으로 점진적으로 예약에 필요한 정보들이 갖추어졌는지 항상 판단하고 만약 받지 못한 정보가 있을 경우 요청하세요.
        - 최종 예약이 성공적으로 끝날 경우 예약 완료 여부를 return 해주세요.
        `],
        ["human", "{input}"],
        ["assistant", "{agent_scratchpad}"]
      ]);

      const agent = await createOpenAIFunctionsAgent({
        llm: this.model,
        tools,
        prompt
      });

      const agentWithScratchpad = RunnableSequence.from([
        {
          input: (i: { input: string; agent_scratchpad?: AgentStep[] }) => i.input,
          agent_scratchpad: (i: { input: string; agent_scratchpad?: AgentStep[] }) =>
            formatToOpenAIFunctionMessages(i.agent_scratchpad || [])
        },
        agent
      ]);

      this.agent = AgentExecutor.fromAgentAndTools({
        agent: agentWithScratchpad,
        tools,
        verbose: true,
        metadata: {
          projectName: "reservation-chatbot"
        },
        tags: ["reservation-agent"]
      });

      console.log('Agent 초기화 완료');
    } catch (error) {
      console.error('Agent 초기화 실패:', error);
      throw error;
    }
  }

  private getOrCreateSession(sessionId: string): ChatSessionEntity {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new ChatSessionEntity(sessionId));
    }
    return this.sessions.get(sessionId)!;
  }

  async processMessage(sessionId: string, message: string, onStream: (token: string) => void): Promise<string> {
    console.log('========= 메시지 처리 시작 =========');
    console.log('세션 ID:', sessionId);
    console.log('사용자 메시지:', message);
    
    const session = this.getOrCreateSession(sessionId);
    session.addMessage('user', message);

    try {
      console.log('현재 예약 상태:', session.getReservationState());
      console.log('현재 예약 정보:', session.getReservationInfo());

      // 예약 확인 상태일 때 사용자의 응답 처리
      if (session.getReservationState() === ReservationState.CONFIRMING) {
        console.log('예약 확인 상태 처리 시작');
        return await this.handleConfirmationResponse(session, message, onStream);
      }

      // 새로운 예약 정보 파싱 및 검증
      console.log('예약 정보 파싱 시작');
      const newInfo = await this.parseReservationInfo(message);
      console.log('파싱된 예약 정보:', newInfo);
      
      if (Object.keys(newInfo).length > 0) {
        console.log('새로운 예약 정보 검증 시작');
        const validationErrors = ReservationValidator.validateReservationInfo(newInfo);
        console.log('검증 결과 - 에러:', validationErrors);
        
        if (validationErrors.length > 0) {
          const errorMessage = `다음 문제를 해결해주세요:\n${validationErrors.join('\n')}`;
          await this.streamResponse(errorMessage, onStream);
          session.addMessage('assistant', errorMessage);
          return errorMessage;
        }
        session.updateReservationInfo(newInfo);
        console.log('업데이트된 예약 정보:', session.getReservationInfo());
      }

      // 예약 정보 수집 완료 확인
      if (session.isReservationComplete() && 
          session.getReservationState() === ReservationState.COLLECTING_INFO) {
        console.log('예약 정보 수집 완료, 예약 처리 시작');
        return await this.handleCompletedReservation(session, onStream);
      }

      // LangChain Agent를 통한 대화 처리
      console.log('일반 대화 처리로 전환');
      return await this.handleGeneralConversation(session, message, onStream);

    } catch (error) {
      console.error('메시지 처리 중 오류 발생:', error);
      return await this.handleError(error, onStream);
    } finally {
      console.log('========= 메시지 처리 종료 =========\n');
    }
  }

  private async handleConfirmationResponse(
    session: ChatSessionEntity, 
    message: string, 
    onStream: (token: string) => void
  ): Promise<string> {
    const confirmRegex = /예|네|좋아요|확인|ok|yes/i;
    const cancelRegex = /아니오|아니요|취소|no/i;
    
    try {
      if (confirmRegex.test(message)) {
        // 한 번만 실행되도록 상태 체크
        if (session.getReservationState() !== ReservationState.CONFIRMING) {
          const response = "이미 예약이 처리되었거나 취소되었습니다.";
          await this.streamResponse(response, onStream);
          return response;
        }
        return await this.createReservation(session, onStream);
      } else if (cancelRegex.test(message)) {
        session.setReservationState(ReservationState.COLLECTING_INFO);
        const response = "예약을 취소했습니다. 다시 예약을 도와드릴까요?";
        await this.streamResponse(response, onStream);
        return response;
      } else {
        const response = "예 또는 아니오로 답변해주세요.";
        await this.streamResponse(response, onStream);
        return response;
      }
    } catch (error) {
      return await this.handleError(error, onStream);
    }
  }

  private async handleCompletedReservation(
    session: ChatSessionEntity,
    onStream: (token: string) => void
  ): Promise<string> {
    const info = session.getReservationInfo();
    
    try {
      const availability = await this.reservationTool.checkAvailability(
        info.date!,
        info.startTime,
        info.roomId
      );

      if (availability.available) {
        session.setReservationState(ReservationState.CONFIRMING);
        const confirmMessage = this.createConfirmationMessage(info);
        await this.streamResponse(confirmMessage, onStream);
        session.addMessage('assistant', confirmMessage);
        return confirmMessage;
      } else {
        const alternativeSlots = this.formatAvailableSlots(availability.availableSlots);
        const response = `죄송합니다. 해당 시간대는 예약이 불가합니다.\n\n다음 시간대가 가능합니:\n${alternativeSlots}`;
        await this.streamResponse(response, onStream);
        session.addMessage('assistant', response);
        return response;
      }
    } catch (error) {
      return await this.handleError(error, onStream);
    }
  }

  private formatAvailableSlots(slots: Array<{ roomId: number; startTime: string; endTime: string }>): string {
    return slots
      .map(slot => `- ${slot.roomId}번 토론방: ${slot.startTime} ~ ${slot.endTime}`)
      .join('\n');
  }

  private createConfirmationMessage(info: ReservationInfo): string {
    return `다음 내용으로 예약하시겠습니까?\n
날짜: ${info.date!.toLocaleDateString()}
시간: ${info.startTime || '미지정'}
사용시간: ${info.duration}시간
토론방: ${info.roomId || '미지정'}번
예약자: ${info.userName}
회의내용: ${info.content}

예약을 확정하시려면 "예", 취소하시려면 "아니오"를 입력해주세요.`;
  }

  private async handleError(error: unknown, onStream: (token: string) => void): Promise<string> {
    console.error('Error in processMessage:', error);
    let errorMessage = "죄송합니다. 처리 중 오류가 발생했습니다.";
    
    if (error instanceof Error) {
      if (error.message.includes('주말')) {
        errorMessage = "주말은 예약이 불가능합니다. 평일을 선택해주세요.";
      } else if (error.message.includes('시간')) {
        errorMessage = "예약 가능 시간은 09:00 ~ 18:00입니다.";
      }
    }

    await this.streamResponse(errorMessage, onStream);
    return errorMessage;
  }

  private async streamResponse(response: string, onStream: (token: string) => void): Promise<void> {
    for (const char of response) {
      onStream(char);
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  }

  private async parseReservationInfo(content: string): Promise<Partial<ReservationInfo>> {
    const dateRegex = /(\d{4}년\s*)?\d{1,2}월\s*\d{1,2}일/;
    const timeRegex = /(\d{1,2})(시|:00)/;
    const roomRegex = /(\d+)\s*(?:번\s*)?토론방/;
    const durationRegex = /(\d+)\s*시간/;

    const info: Partial<ReservationInfo> = {};
    
    // 날짜 파싱
    const dateMatch = content.match(dateRegex);
    if (dateMatch) {
      const dateStr = dateMatch[0];
      const year = new Date().getFullYear();
      const [month, day] = dateStr.match(/\d+/g)!.map(Number);
      info.date = new Date(year, month - 1, day);
    }

    // 시작 시간 파싱
    const timeMatch = content.match(timeRegex);
    if (timeMatch) {
      info.startTime = `${timeMatch[1].padStart(2, '0')}:00`;
    }

    // 토론 번호 파싱
    const roomMatch = content.match(roomRegex);
    if (roomMatch) {
      info.roomId = parseInt(roomMatch[1]);
    }

    // 사용 시간 파싱
    const durationMatch = content.match(durationRegex);
    if (durationMatch) {
      info.duration = parseInt(durationMatch[1]);
    }

    return info;
  }

  private async handleGeneralConversation(
    session: ChatSessionEntity,
    message: string,
    onStream: (token: string) => void
  ): Promise<string> {
    try {
      const result = await this.agent?.invoke({
        input: message
      });

      if (!result) throw new Error('Agent 응답 없음');

      // 구조화된 메시지 파싱 시도
      try {
        const toolOutputs = result.intermediateSteps.map((step: AgentStep) => {
          try {
            return JSON.parse(step.observation);
          } catch {
            return null;
          }
        }).filter((output: ToolOutput) => output?.data?.messageComponents);

        // 마지막 tool의 구조화된 메시지 사용
        const lastToolOutput = toolOutputs[toolOutputs.length - 1];
        if (lastToolOutput?.data?.messageComponents) {
          const response = {
            type: 'structured',
            sections: lastToolOutput.data.messageComponents.sections,
            raw: result.output
          };
          session.addMessage('assistant', JSON.stringify(response));
          return JSON.stringify(response);
        }
      } catch (error) {
        console.error('구조화된 메시지 파싱 실패:', error);
      }

      // 구조화된 메시지가 없는 경우 기존 응답 사용
      const response = {
        type: 'text',
        content: result.output
      };
      session.addMessage('assistant', JSON.stringify(response));
      return JSON.stringify(response);
    } catch (error) {
      console.error('일반 대화 처리 중 오류:', error);
      throw error;
    }
  }

  private async createReservation(
    session: ChatSessionEntity,
    onStream: (token: string) => void
  ): Promise<string> {
    const info = session.getReservationInfo();
    const reservationKey = `${info.date?.toISOString()}_${info.startTime}_${info.roomId}`;
    
    try {
      // 예약 정보 유효성 검증
      if (!info.date || !info.startTime || !info.duration || 
          !info.roomId || !info.userName || !info.content) {
        throw new Error('필수 예약 정보가 누락되었습니다.');
      }

      // 중복 예약 방지를 위한 락 확인
      if (this.isCreatingReservation) {
        const response = "이미 예약 처리가 진행 중입니다. 잠시만 기다려주세요.";
        await this.streamResponse(response, onStream);
        return response;
      }

      this.isCreatingReservation = true;
      console.log(`예약 생성 시작: ${reservationKey}`);

      try {
        // 세션 상태 확인
        if (session.getReservationState() !== ReservationState.CONFIRMING) {
          throw new Error('잘못된 예약 상태입니다.');
        }

        // 최종 가용성 재확인
        const availability = await this.reservationTool.checkAvailability(
          info.date,
          info.startTime,
          info.roomId
        );

        if (!availability.available) {
          throw new Error('선택하신 시간대는 이미 예약되었습니다.');
        }

        // 예약 생성 시도
        const success = await this.reservationTool.createReservation({
          date: info.date,
          startTime: info.startTime,
          duration: info.duration,
          roomId: info.roomId,
          userName: info.userName,
          content: info.content
        });

        if (!success) {
          throw new Error('예약 생성에 실패했습니다.');
        }

        // 예약 성공 처리
        const response = `예약이 완료되었습니다! \n\n` +
          `- **예약자 이름:** ${info.userName}\n` +
          `- **회의 목적:** ${info.content}\n` +
          `- **예약 날짜:** ${info.date.toLocaleDateString('ko-KR')}\n` +
          `- **예약 시간:** ${info.startTime} - ${this.calculateEndTime(info.startTime, info.duration)}\n` +
          `- **방 번호:** ${info.roomId}번 방\n\n` +
          `추가로 궁금한 점이 있으시면 언제든지 문의해 주세요!`;
        
        await this.streamResponse(response, onStream);
        
        // 세션 초기화
        session.clearReservationInfo();
        session.setReservationState(ReservationState.COLLECTING_INFO);
        
        console.log(`예약 생성 완료: ${reservationKey}`);
        return response;

      } catch (error) {
        console.error(`예약 생성 실패: ${reservationKey}`, error);
        throw error;
      } finally {
        this.isCreatingReservation = false;
        console.log(`예약 처리 종료: ${reservationKey}`);
      }
    } catch (error) {
      return await this.handleError(error, onStream);
    }
  }

  private calculateEndTime(startTime: string, duration: number): string {
    const [hours, minutes] = startTime.split(':').map(Number);
    const endHour = hours + duration;
    return `${endHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
} 