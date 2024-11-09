export class ChatRepository {
  async sendMessage(message: { content: string; userId: string; timestamp: Date }) {
    // 실제 구현에서는 DB나 외부 API와 통신
    return {
      content: `답변: ${message.content}에 대한 자동 응답입니다.`,
      userId: 'bot',
      timestamp: new Date()
    };
  }
}
