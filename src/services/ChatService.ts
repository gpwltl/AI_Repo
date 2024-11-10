import { OpenAIChatRepository } from '../backend/domains/chatbot/repositories/implementations/OpenAIChatRepository';
import { SendMessageUseCase } from '../backend/domains/chatbot/service/SendMessageUseCase';
import { StreamCallback } from '../backend/domains/chatbot/repositories/IChatRepository';
import { logger } from '@/utils/logger';

export class ChatService {
  private static instance: ChatService;
  private sendMessageUseCase: SendMessageUseCase;
  private chatRepository: OpenAIChatRepository;

  private constructor() {
    logger.log('ChatService 생성자 시작');
    try {
      logger.log('ChatRepository 초기화 시작');
      this.chatRepository = OpenAIChatRepository.getInstance();
      logger.log('ChatRepository 초기화 완료');
      
      logger.log('SendMessageUseCase 초기화 시작');
      this.sendMessageUseCase = new SendMessageUseCase(this.chatRepository);
      logger.log('SendMessageUseCase 초기화 완료');
    } catch (error) {
      logger.error('ChatService 생성자 에러:', error);
      throw error;
    }
  }

  public static getInstance(): ChatService {
    logger.log('ChatService.getInstance 호출');
    if (!ChatService.instance) {
      logger.log('새 ChatService 인스턴스 생성');
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  async processMessage(sessionId: string, content: string, onStream: StreamCallback): Promise<string> {
    try {
      logger.log('ChatService - processMessage 시작:', { sessionId, content });
      const response = await this.sendMessageUseCase.execute({
        content,
        userId: sessionId,
        timestamp: new Date()
      }, onStream);
      logger.log('ChatService - 응답 성공:', response);
      return response.content;
    } catch (error) {
      logger.error('ChatService 에러:', error);
      throw error;
    }
  }

  async sendMessage(content: string, onStream: StreamCallback): Promise<string> {
    try {
      const response = await this.sendMessageUseCase.execute({
        content,
        userId: '1',
        timestamp: new Date()
      }, onStream);
      return response.content;
    } catch (error) {
      logger.error('ChatService Error:', error);
      throw new Error('Failed to send message');
    }
  }
} 