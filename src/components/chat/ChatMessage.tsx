import React from 'react';
import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';

interface MessageSection {
  type: 'header' | 'list' | 'paragraph' | 'error';
  content: string;
  items?: string[];
  style?: {
    color?: string;
    isBold?: boolean;
    isItalic?: boolean;
  };
}

interface ChatMessageProps {
  message: string;
  isBot?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, isBot = false }) => {
  let parsedMessage;
  try {
    parsedMessage = JSON.parse(message);
  } catch {
    // 기존 텍스트 메시지 처리
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-4 rounded-lg ${
          isBot ? 'bg-blue-50 mr-12' : 'bg-gray-50 ml-12'
        } mb-4`}
      >
        <ReactMarkdown>{message}</ReactMarkdown>
      </motion.div>
    );
  }

  if (parsedMessage.type === 'structured') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-4 rounded-lg ${
          isBot ? 'bg-blue-50 mr-12' : 'bg-gray-50 ml-12'
        } mb-4`}
      >
        {parsedMessage.sections.map((section: MessageSection, index: number) => {
          switch (section.type) {
            case 'header':
              return (
                <h3
                  key={index}
                  className={`text-lg mb-3 ${section.style?.isBold ? 'font-bold' : ''}`}
                  style={{ color: section.style?.color }}
                >
                  {section.content}
                </h3>
              );
            
            case 'list':
              return (
                <div key={index} className="mb-3">
                  <p className="mb-2">{section.content}</p>
                  <ul className="space-y-1 ml-4">
                    {section.items?.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-center hover:bg-blue-100 p-2 rounded cursor-pointer transition-colors"
                      >
                        <span className="w-4 h-4 mr-2 text-blue-500">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            
            // ... 다른 section type들 처리
          }
        })}
      </motion.div>
    );
  }

  // 일반 텍스트 메시지 처리
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-lg ${
        isBot ? 'bg-blue-50 mr-12' : 'bg-gray-50 ml-12'
      } mb-4`}
    >
      <ReactMarkdown>{parsedMessage.content}</ReactMarkdown>
    </motion.div>
  );
}; 