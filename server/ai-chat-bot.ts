import OpenAI from 'openai';
import { storage } from './storage';
import WebSocket from 'ws';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const AI_MODEL = "gpt-4o";

/**
 * AI Chat Bot Service for automated interactions with users
 */
interface ClientInfo {
  userId: number;
  username: string;
  [key: string]: any;
}

export class AIChatBotService {
  private botPersona: string;
  private clients: Map<WebSocket, ClientInfo>;
  
  constructor(clients: Map<WebSocket, ClientInfo>) {
    this.clients = clients;
    this.botPersona = "You are Mingleo Assistant, a helpful AI chat bot integrated into the Mingleo social media platform. Your tone is friendly, conversational, and helpful. You provide short, concise answers and engage with users naturally. You can suggest filters, features, and content ideas. You also help users navigate the platform.";
    
    // Start sending periodic messages to all active users
    this.initPeriodicMessages();
  }
  
  /**
   * Initialize periodic automated messages to all users
   */
  private initPeriodicMessages() {
    // Send messages every 30-60 minutes (randomized)
    setInterval(() => {
      this.sendPeriodicMessagesToAllUsers();
    }, Math.floor(Math.random() * 30 * 60 * 1000) + 30 * 60 * 1000);
  }
  
  /**
   * Send periodic AI-generated messages to all active users
   */
  private async sendPeriodicMessagesToAllUsers() {
    // Get all active users
    const activeUserIds = new Set<number>();
    
    this.clients.forEach((clientInfo) => {
      if (clientInfo && clientInfo.userId) {
        activeUserIds.add(clientInfo.userId);
      }
    });
    
    // Send personalized messages to each active user
    for (const userId of Array.from(activeUserIds)) {
      try {
        // Get user data
        const user = await storage.getUser(userId);
        if (!user) continue;
        
        // Generate a personalized tip or message
        const message = await this.generatePersonalizedMessage(user);
        
        // Find the user's WebSocket connection and send message
        this.clients.forEach((clientInfo, ws) => {
          if (clientInfo.userId === userId) {
            // Send the message if user is connected
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'ai-assistant-message',
                message: message,
                sender: {
                  userId: 0,
                  username: 'MingleoAI',
                  isBot: true
                },
                timestamp: new Date().toISOString(),
                messageId: `ai-${Date.now()}`
              }));
            }
          }
        });
      } catch (error) {
        console.error(`Error sending AI message to user ${userId}:`, error);
      }
    }
  }
  
  /**
   * Generate a personalized message for a specific user
   */
  private async generatePersonalizedMessage(user: any): Promise<string> {
    // Get user's recent activities to personalize the message
    const recentPosts = await storage.getPostsByUserId(user.id);
    const recentStories = await storage.getStoriesByUserId(user.id);
    
    // Get user's settings to personalize the message
    const settings = await storage.getSettings(user.id);
    
    // Create a context string summarizing user activity
    let contextString = `User ${user.username} `;
    
    if (recentPosts.length > 0) {
      contextString += `has posted ${recentPosts.length} posts recently. `;
    } else {
      contextString += 'has not posted anything recently. ';
    }
    
    if (recentStories.length > 0) {
      contextString += `has ${recentStories.length} active stories. `;
    }
    
    if (settings) {
      if (settings.aiFilters) {
        contextString += 'has AI filters enabled. ';
      }
      // Check theme preference instead of darkMode
      if (settings.theme === 'dark') {
        contextString += 'prefers dark mode. ';
      }
    }
    
    try {
      // Generate the AI response
      const prompt = `Based on this user context: "${contextString}", generate a short, friendly message as if you're a social media assistant. Suggest a feature, tip, or engagement idea related to their activity. Keep it under 150 characters, casual and helpful.`;
      
      const response = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: this.botPersona },
          { role: 'user', content: prompt }
        ],
        max_tokens: 100,
        temperature: 0.7
      });
      
      return response.choices[0].message.content || 'Hey there! Try exploring our new AI filters for your next post or story!';
    } catch (error) {
      console.error('Error generating personalized message:', error);
      return 'Hey there! Try exploring our new AI filters for your next post or story!';
    }
  }
  
  /**
   * Process a user message and generate an AI response
   */
  async processUserMessage(userId: number, message: string): Promise<string> {
    // Get user data for personalization
    const user = await storage.getUser(userId);
    
    if (!user) {
      return "I'm sorry, I couldn't process your request at this time.";
    }
    
    try {
      // Generate the AI response
      const response = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: this.botPersona },
          { role: 'user', content: `${user.username} asks: ${message}` }
        ],
        max_tokens: 150,
        temperature: 0.7
      });
      
      return response.choices[0].message.content || "I'm here to help! Is there anything specific you'd like to know about using Mingleo?";
    } catch (error) {
      console.error('Error processing user message:', error);
      return "I'm here to help! Is there anything specific you'd like to know about using Mingleo?";
    }
  }
  
  /**
   * Send an immediate AI response to a specific user
   */
  async sendImmediateResponse(userWs: WebSocket, userId: number, userMessage: string) {
    try {
      // Generate AI response
      const response = await this.processUserMessage(userId, userMessage);
      
      // Send response via WebSocket
      if (userWs.readyState === WebSocket.OPEN) {
        userWs.send(JSON.stringify({
          type: 'ai-assistant-message',
          message: response,
          sender: {
            userId: 0,
            username: 'MingleoAI',
            isBot: true
          },
          inResponseTo: userMessage,
          timestamp: new Date().toISOString(),
          messageId: `ai-${Date.now()}`
        }));
      }
    } catch (error) {
      console.error('Error sending immediate AI response:', error);
    }
  }
}