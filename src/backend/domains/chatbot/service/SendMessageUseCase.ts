import { IChatRepository, ChatMessage, ChatResponse, StreamCallback } from '../repositories/IChatRepository';

export class SendMessageUseCase {
  constructor(private chatRepository: IChatRepository) {}

  async execute(message: ChatMessage, onStream: StreamCallback): Promise<ChatResponse> {
    return this.chatRepository.sendMessage(message, onStream);
  }
}
