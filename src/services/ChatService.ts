import { OpenAIChatRepository } from '../backend/domains/chatbot/repositories/implementations/OpenAIChatRepository';
import { SendMessageUseCase } from '../backend/domains/chatbot/service/SendMessageUseCase';
import { StreamCallback } from '../backend/domains/chatbot/repositories/IChatRepository';

export class ChatService {
  private static instance: ChatService;
  private sendMessageUseCase: SendMessageUseCase;

  private constructor() {
    const chatRepository = OpenAIChatRepository.getInstance();
    this.sendMessageUseCase = new SendMessageUseCase(chatRepository);
  }

  public static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
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
      console.error('ChatService Error:', error);
      throw new Error('Failed to send message');
    }
  }
} 