export interface ChatMessage {
  content: string;
  userId: string;
  timestamp: Date;
}

export interface ChatResponse {
  content: string;
  userId: string;
  timestamp: Date;
}

export type StreamCallback = (response: ChatResponse | string) => void;

export interface IChatRepository {
  sendMessage(message: ChatMessage, onStream: StreamCallback): Promise<ChatResponse>;
} 