import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChatService } from '@/hooks/useChatService';

interface Message {
  content: string;
  isUser: boolean;
}

export function ChatInterface() {
  const [message, setMessage] = useState('');
  const { messages, sendMessage } = useChatService();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 메시지가 추가될 때마다 스크롤
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (message.trim()) {
      sendMessage(message);
      setMessage('');
    }
  };

  return (
    <div className="flex flex-col h-[600px]">
      <div className="flex-1 overflow-auto p-6 space-y-4">
        {messages.map((msg: Message, i: number) => (
          <div
            key={i}
            className={`flex ${
              msg.isUser ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`rounded-lg px-6 py-3 max-w-[70%] text-lg ${
                msg.isUser
                  ? 'bg-[#3b547b] text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {/* 스크롤 위치를 잡기 위한 더미 div */}
        <div ref={messagesEndRef} />
      </div>
      <div className="border-t p-6 flex gap-4">
        <Input
          className="text-lg"
          value={message}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMessage(e.target.value)}
          placeholder="메시지를 입력하세요..."
          onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleSend()}
        />
        <Button
          className="px-8 text-lg"
          onClick={handleSend}
        >
          전송
        </Button>
      </div>
    </div>
  );
} 