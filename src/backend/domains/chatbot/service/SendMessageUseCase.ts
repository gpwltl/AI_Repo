import { IChatRepository, ChatMessage, ChatResponse, StreamCallback } from '../repositories/IChatRepository';

export class SendMessageUseCase {
  constructor(private chatRepository: IChatRepository) {
    console.log('SendMessageUseCase 생성자 호출');
  }

  async execute(message: ChatMessage, onStream: StreamCallback): Promise<ChatResponse> {
    console.log('SendMessageUseCase.execute 시작:', message);
    try {
      const response = await this.chatRepository.sendMessage(message, onStream);
      console.log('SendMessageUseCase.execute 완료:', response);
      return response;
    } catch (error) {
      console.error('SendMessageUseCase.execute 에러:', error);
      throw error;
    }
  }
}
