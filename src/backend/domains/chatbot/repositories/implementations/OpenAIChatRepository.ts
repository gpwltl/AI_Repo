import { ChatOpenAI } from "@langchain/openai";
import { IChatRepository, ChatMessage, ChatResponse, StreamCallback } from "../IChatRepository";

export class OpenAIChatRepository implements IChatRepository {
  private static instance: OpenAIChatRepository;
  private model: ChatOpenAI;

  private constructor() {
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    console.log('API Key:', apiKey);
    
    if (!apiKey) {
      throw new Error('OpenAI API key not found');
    }

    this.model = new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: "gpt-4o-mini",
      temperature: 0.7,
      streaming: true,
    });
  }

  public static getInstance(): OpenAIChatRepository {
    if (!OpenAIChatRepository.instance) {
      OpenAIChatRepository.instance = new OpenAIChatRepository();
    }
    return OpenAIChatRepository.instance;
  }

  async sendMessage(message: ChatMessage, onStream: StreamCallback): Promise<ChatResponse> {
    try {
      let fullContent = '';
      
      const response = await this.model.invoke(
        `${message.content}`,
        {
          callbacks: [
            {
              handleLLMNewToken(token: string) {
                fullContent += token;
                onStream(token);
              },
            },
          ],
        }
      );

      return {
        content: fullContent || response,
        userId: 'bot',
        timestamp: new Date()
      };
    } catch (error) {
      console.error('OpenAI API Error:', error);
      throw new Error('Failed to get response from OpenAI');
    }
  }
} 