import { useState, useCallback, useMemo } from 'react';
import { ChatService } from '../services/ChatService';

export function useChatService() {
  const chatService = useMemo(() => ChatService.getInstance(), []);

  const [messages, setMessages] = useState<Array<{
    content: string;
    isUser: boolean;
  }>>([]);

  const sendMessage = useCallback(async (content: string) => {
    setMessages(prev => [...prev, { content, isUser: true }]);

    setMessages(prev => [...prev, { content: '', isUser: false }]);

    try {
      let streamedContent = '';
      await chatService.sendMessage(content, (token) => {
        streamedContent += token;
        setMessages(prev => [
          ...prev.slice(0, -1),
          { content: streamedContent, isUser: false }
        ]);
      });
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }, [chatService]);

  return { messages, sendMessage };
} 