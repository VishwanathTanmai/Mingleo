import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import WebSocket from "ws";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { aiService } from "./ai-service";
import { AIChatBotService } from "./ai-chat-bot";
import { z } from "zod";
import { 
  insertPostSchema, 
  insertStorySchema, 
  insertMessageSchema, 
  insertContactSchema, 
  insertFilterSchema,
  insertPrivacySchema 
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

  const httpServer = createServer(app);
  
  // Setup WebSocket server with authentication verification
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    verifyClient: (info, callback) => {
      // Allow all connections for now
      // In a production environment, you might want to verify the session
      callback(true);
    }
  });
  
  // Store connected clients with user info
  const clients = new Map();
  
  // Helper function to handle search queries asynchronously
  async function handleSearchQuery(ws: WebSocket, clientInfo: any, query: string) {
    try {
      // Perform search on server
      const searchResults = await storage.searchUsers(query);
      
      // Filter out current user
      const filteredResults = searchResults.filter(user => user.id !== clientInfo.userId);
      
      // Send results back to the requesting client only
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'search-results',
          query: query,
          results: filteredResults.slice(0, 5) // Only send top 5 for suggestions
        }));
      }
    } catch (error) {
      console.error('Error handling search query:', error);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Error processing search query'
        }));
      }
    }
  }
  
  // Helper function to send friend suggestions to a user
  async function sendFriendSuggestions(ws: WebSocket, userId: number) {
    try {
      // Get suggestions from storage
      const suggestions = await storage.getSuggestions(userId);
      
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'friend-suggestions',
          suggestions: suggestions.slice(0, 5) // Only send top 5 suggestions
        }));
      }
    } catch (error) {
      console.error('Error sending friend suggestions:', error);
    }
  }
  
  // Handle WebSocket connections
  wss.on('connection', (ws, req) => {
    // Handle client authentication
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle authentication message
        if (data.type === 'auth') {
          // Store user data with the connection
          clients.set(ws, {
            userId: data.userId,
            username: data.username
          });
          
          // Notify other clients about user coming online
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'user-online',
                userId: data.userId,
                username: data.username
              }));
            }
          });
          
          // Send current online users to the newly connected client
          const onlineUsers = Array.from(clients.values())
            .filter(client => client.userId && client.userId !== data.userId);
          
          ws.send(JSON.stringify({
            type: 'online-users',
            users: onlineUsers
          }));
          
          // Send friend suggestions to the user
          sendFriendSuggestions(ws, data.userId);
          
          return;
        }
        
        // For standard messages, check if client is authenticated
        const clientInfo = clients.get(ws);
        if (!clientInfo) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Not authenticated'
          }));
          return;
        }
        
        // Add sender info to message
        const enrichedData = {
          ...data,
          sender: {
            userId: clientInfo.userId,
            username: clientInfo.username
          }
        };
        
        // Handle acknowledgments first
        if (data.type === 'ack' && data.messageId) {
          // Simply pass the acknowledgment to the original sender if available
          if (data.originalSenderId) {
            wss.clients.forEach((client) => {
              const clientData = clients.get(client);
              if (client.readyState === WebSocket.OPEN && 
                  clientData && 
                  clientData.userId === data.originalSenderId) {
                client.send(JSON.stringify({
                  type: 'ack',
                  messageId: data.messageId,
                  timestamp: new Date().toISOString()
                }));
              }
            });
          }
          return;
        }
        
        // Add message ID if not present for tracking/acknowledgment
        if (!data.messageId) {
          enrichedData.messageId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        }
        
        // Store the sender's ID for acknowledgment routing
        enrichedData.originalSenderId = clientInfo.userId;
        
        // Handle different message types
        switch (data.type) {
          case 'direct-message':
            // Send only to the target user
            if (data.targetUserId) {
              wss.clients.forEach((client) => {
                const clientData = clients.get(client);
                if (client.readyState === WebSocket.OPEN && 
                    clientData && 
                    clientData.userId === data.targetUserId) {
                  client.send(JSON.stringify(enrichedData));
                }
              });
            }
            break;
            
          case 'typing-indicator':
            // Send typing indicator to the target user
            if (data.targetUserId) {
              wss.clients.forEach((client) => {
                const clientData = clients.get(client);
                if (client.readyState === WebSocket.OPEN && 
                    clientData && 
                    clientData.userId === data.targetUserId) {
                  client.send(JSON.stringify(enrichedData));
                }
              });
            }
            break;
            
          case 'like-post':
            // Handle post like - store in database and notify post owner
            if (data.postId && data.ownerId) {
              // Update like count in database (handled by API endpoint)
              // Notify the post owner about the like
              wss.clients.forEach((client) => {
                const clientData = clients.get(client);
                if (client.readyState === WebSocket.OPEN && 
                    clientData && 
                    clientData.userId === data.ownerId) {
                  client.send(JSON.stringify(enrichedData));
                }
              });
            }
            break;
            
          case 'like-story':
            // Handle story like - store in database and notify story owner
            if (data.storyId && data.ownerId) {
              // Notify the story owner about the like
              wss.clients.forEach((client) => {
                const clientData = clients.get(client);
                if (client.readyState === WebSocket.OPEN && 
                    clientData && 
                    clientData.userId === data.ownerId) {
                  client.send(JSON.stringify(enrichedData));
                }
              });
            }
            break;
            
          case 'like-reel':
            // Handle reel like - store in database and notify reel owner
            if (data.reelId && data.ownerId) {
              // Notify the reel owner about the like
              wss.clients.forEach((client) => {
                const clientData = clients.get(client);
                if (client.readyState === WebSocket.OPEN && 
                    clientData && 
                    clientData.userId === data.ownerId) {
                  client.send(JSON.stringify(enrichedData));
                }
              });
            }
            break;
            
          case 'comment':
            // Handle comment - store in database and notify content owner
            if (data.contentId && data.contentType && data.ownerId) {
              // Notify the content owner about the comment
              wss.clients.forEach((client) => {
                const clientData = clients.get(client);
                if (client.readyState === WebSocket.OPEN && 
                    clientData && 
                    clientData.userId === data.ownerId) {
                  client.send(JSON.stringify(enrichedData));
                }
              });
            }
            break;
            
          case 'follow-request':
            // Handle follow request - store in database and notify target user
            if (data.targetUserId) {
              // Notify the target user about the follow request
              wss.clients.forEach((client) => {
                const clientData = clients.get(client);
                if (client.readyState === WebSocket.OPEN && 
                    clientData && 
                    clientData.userId === data.targetUserId) {
                  client.send(JSON.stringify(enrichedData));
                }
              });
            }
            break;
            
          case 'follow-accept':
            // Handle follow request acceptance - notify the original requester
            if (data.targetUserId) {
              // Notify the original follow requester
              wss.clients.forEach((client) => {
                const clientData = clients.get(client);
                if (client.readyState === WebSocket.OPEN && 
                    clientData && 
                    clientData.userId === data.targetUserId) {
                  client.send(JSON.stringify(enrichedData));
                }
              });
            }
            break;
            
          case 'search-query':
            // Handle real-time search queries
            if (data.query) {
              // For search queries, handle asynchronously in a separate function
              handleSearchQuery(ws, clientInfo, data.query);
            }
            break;
            
          case 'contact-status-update':
            // Handle contact status updates
            if (data.contactId && data.status) {
              try {
                // Update the contact status in the database
                const updatedContact = await storage.updateContactStatus(data.contactId, data.status);
                
                if (updatedContact) {
                  // Broadcast the status change to relevant users
                  wss.clients.forEach((client) => {
                    const clientData = clients.get(client);
                    if (client.readyState === WebSocket.OPEN && clientData) {
                      // Send to both the user who made the change and the target contact
                      if (clientData.userId === clientInfo.userId || 
                          clientData.userId === updatedContact.contactId) {
                        client.send(JSON.stringify({
                          type: 'contact-status-changed',
                          contactId: updatedContact.id,
                          status: updatedContact.status,
                          updatedBy: clientInfo.userId,
                          timestamp: new Date().toISOString()
                        }));
                      }
                    }
                  });
                }
              } catch (error) {
                console.error('Error updating contact status:', error);
                ws.send(JSON.stringify({
                  type: 'error',
                  message: 'Failed to update contact status',
                  errorCode: 'CONTACT_STATUS_UPDATE_FAILED'
                }));
              }
            }
            break;
          
          default:
            // Broadcast to all clients for other message types
            wss.clients.forEach((client) => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(enrichedData));
              }
            });
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });
    
    // Handle disconnections
    ws.on('close', () => {
      const clientInfo = clients.get(ws);
      if (clientInfo && clientInfo.userId) {
        // Notify other clients about user going offline
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'user-offline',
              userId: clientInfo.userId,
              username: clientInfo.username
            }));
          }
        });
      }
      
      // Remove from clients map
      clients.delete(ws);
    });
    
    // Send initial connection confirmation
    ws.send(JSON.stringify({ type: 'connection', status: 'connected', time: new Date().toISOString() }));
  });

  // User profile routes
  app.get("/api/profile/:userId", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const userId = parseInt(req.params.userId);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const posts = await storage.getPostsByUserId(userId);
      
      // Remove password from response
      const { password: _, ...userProfile } = user;
      
      res.json({
        ...userProfile,
        postCount: posts.length,
        followerCount: 0, // Placeholder for future implementation
        followingCount: 0  // Placeholder for future implementation
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });
  
  app.put("/api/profile", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const { bio, firstName, lastName, email } = req.body;
      const updatedUser = await storage.updateUser(req.user.id, {
        bio,
        firstName,
        lastName,
        email
      });
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Remove password from response
      const { password: _, ...userWithoutPassword } = updatedUser;
      
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Post routes
  app.get("/api/posts", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const posts = await storage.getPosts();
      
      // Fetch user data for each post
      const postsWithUserData = await Promise.all(
        posts.map(async (post) => {
          const user = await storage.getUser(post.userId);
          return {
            ...post,
            user: user ? {
              id: user.id,
              username: user.username,
              profilePicture: user.profilePicture
            } : null
          };
        })
      );
      
      res.json(postsWithUserData);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch posts" });
    }
  });
  
  app.post("/api/posts", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const postData = insertPostSchema.parse({
        ...req.body,
        userId: req.user.id
      });
      
      const post = await storage.createPost(postData);
      
      // Broadcast to WebSocket clients
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'new-post',
            post: {
              ...post,
              user: {
                id: req.user.id,
                username: req.user.username,
                profilePicture: req.user.profilePicture
              }
            }
          }));
        }
      });
      
      res.status(201).json(post);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid post data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create post" });
    }
  });
  
  app.delete("/api/posts/:id", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const postId = parseInt(req.params.id);
      const result = await storage.deletePost(postId, req.user.id);
      
      if (!result) {
        return res.status(404).json({ message: "Post not found or you don't have permission to delete it" });
      }
      
      // Broadcast to WebSocket clients
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'post-deleted',
            postId
          }));
        }
      });
      
      res.json({ success: true, message: "Post deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete post" });
    }
  });

  app.post("/api/posts/:id/like", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const postId = parseInt(req.params.id);
      await storage.likePost(postId);
      
      // Get updated post
      const posts = await storage.getPosts();
      const post = posts.find(p => p.id === postId);
      
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      
      // Broadcast to WebSocket clients with userId information
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          // Send post-liked to everyone to update UI
          client.send(JSON.stringify({
            type: 'post-liked',
            postId,
            likes: post.likes,
            userId: req.user?.id || null, // Include who liked the post
            username: req.user?.username || null,
            timestamp: new Date().toISOString()
          }));
          
          // Send like-notification only to post owner for the heart icon
          const clientInfo = clients.get(client);
          if (clientInfo && clientInfo.userId === post.userId && post.userId !== req.user.id) {
            client.send(JSON.stringify({
              type: 'like-notification',
              id: `like-post-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              data: {
                contentType: 'post',
                postId: post.id,
                username: req.user.username,
                userId: req.user.id,
                userAvatar: req.user.profilePicture,
                timestamp: new Date().toISOString()
              }
            }));
          }
        }
      });
      
      res.json({ likes: post.likes });
    } catch (error) {
      res.status(500).json({ message: "Failed to like post" });
    }
  });

  // Story routes
  app.get("/api/stories", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const stories = await storage.getStories();
      
      // Fetch user data for each story
      const storiesWithUserData = await Promise.all(
        stories.map(async (story) => {
          const user = await storage.getUser(story.userId);
          return {
            ...story,
            user: user ? {
              id: user.id,
              username: user.username,
              profilePicture: user.profilePicture
            } : null
          };
        })
      );
      
      res.json(storiesWithUserData);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stories" });
    }
  });
  
  app.post("/api/stories", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const storyData = insertStorySchema.parse({
        ...req.body,
        userId: req.user.id
      });
      
      const story = await storage.createStory(storyData);
      
      // Broadcast to WebSocket clients
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'new-story',
            story: {
              ...story,
              user: {
                id: req.user.id,
                username: req.user.username,
                profilePicture: req.user.profilePicture
              }
            }
          }));
        }
      });
      
      res.status(201).json(story);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid story data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create story" });
    }
  });
  
  app.post("/api/stories/:id/view", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const storyId = parseInt(req.params.id);
      
      await storage.addStoryViewer(storyId, {
        userId: req.user.id,
        username: req.user.username,
        profilePicture: req.user.profilePicture || '',
        viewedAt: new Date().toISOString()
      });
      
      const viewers = await storage.getStoryViewers(storyId);
      
      // Broadcast to WebSocket clients
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'story-viewed',
            storyId,
            viewers
          }));
        }
      });
      
      res.json({ viewers });
    } catch (error) {
      res.status(500).json({ message: "Failed to record story view" });
    }
  });
  
  app.get("/api/stories/:id/viewers", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const storyId = parseInt(req.params.id);
      const viewers = await storage.getStoryViewers(storyId);
      
      res.json(viewers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch story viewers" });
    }
  });
  
  app.post("/api/stories/:id/like", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const storyId = parseInt(req.params.id);
      const story = await storage.likeStory(storyId, req.user.id);
      
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }
      
      // Broadcast to WebSocket clients
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          // Send story-liked to everyone to update UI
          client.send(JSON.stringify({
            type: 'story-liked',
            storyId,
            userId: req.user.id,
            username: req.user.username,
            likes: story.likes || 0,
            timestamp: new Date().toISOString()
          }));
          
          // Send like-notification only to story owner for the heart icon
          const clientInfo = clients.get(client);
          if (clientInfo && clientInfo.userId === story.userId && story.userId !== req.user.id) {
            client.send(JSON.stringify({
              type: 'like-notification',
              id: `like-story-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              data: {
                contentType: 'story',
                storyId: story.id,
                username: req.user.username,
                userId: req.user.id,
                userAvatar: req.user.profilePicture,
                timestamp: new Date().toISOString()
              }
            }));
          }
        }
      });
      
      res.json({ success: true, likes: story.likes || 0 });
    } catch (error) {
      res.status(500).json({ message: "Failed to like story" });
    }
  });
  
  app.delete("/api/stories/:id", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const storyId = parseInt(req.params.id);
      const result = await storage.deleteStory(storyId, req.user.id);
      
      if (!result) {
        return res.status(404).json({ message: "Story not found or you don't have permission to delete it" });
      }
      
      // Broadcast to WebSocket clients
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'story-deleted',
            storyId
          }));
        }
      });
      
      res.json({ success: true, message: "Story deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete story" });
    }
  });

  // Settings routes
  app.get("/api/settings", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const settings = await storage.getSettings(req.user.id);
      
      if (!settings) {
        return res.status(404).json({ message: "Settings not found" });
      }
      
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });
  
  app.put("/api/settings", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const { 
        aiFilters, 
        smartHashtags, 
        aiContentEnhancement, 
        contentRecommendations, 
        pushNotifications, 
        emailNotifications, 
        realTimeUpdates,
        arVrFeatures,
        messageEncryption,
        theme 
      } = req.body;
      
      const updatedSettings = await storage.updateSettings(req.user.id, {
        aiFilters,
        smartHashtags,
        aiContentEnhancement,
        contentRecommendations,
        pushNotifications,
        emailNotifications,
        realTimeUpdates,
        arVrFeatures,
        messageEncryption,
        theme
      });
      
      if (!updatedSettings) {
        return res.status(404).json({ message: "Settings not found" });
      }
      
      // Broadcast settings changes to WebSocket clients
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'settings-updated',
            userId: req.user.id,
            settings: updatedSettings
          }));
        }
      });
      
      res.json(updatedSettings);
    } catch (error) {
      res.status(500).json({ message: "Failed to update settings" });
    }
  });
  
  // Privacy routes
  app.get("/api/privacy", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const privacySettings = await storage.getPrivacy(req.user.id);
      
      if (!privacySettings) {
        return res.status(404).json({ message: "Privacy settings not found" });
      }
      
      res.json(privacySettings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch privacy settings" });
    }
  });
  
  app.put("/api/privacy", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const privacyData = insertPrivacySchema.partial().parse({
        ...req.body,
        userId: req.user.id
      });
      
      const updatedPrivacy = await storage.updatePrivacy(req.user.id, privacyData);
      
      if (!updatedPrivacy) {
        return res.status(404).json({ message: "Privacy settings not found" });
      }
      
      res.json(updatedPrivacy);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid privacy data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update privacy settings" });
    }
  });
  
  // User status route
  app.put("/api/user/status", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const { status } = req.body;
      
      if (!status || typeof status !== 'string') {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      await storage.setUserStatus(req.user.id, status);
      
      // Broadcast status update to WebSocket clients
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'user-status-changed',
            userId: req.user.id,
            status
          }));
        }
      });
      
      res.json({ status, success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to update status" });
    }
  });
  
  // Messaging routes
  app.get("/api/messages/:contactId", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const contactId = parseInt(req.params.contactId);
      const messages = await storage.getMessages(req.user.id, contactId);
      
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });
  
  app.post("/api/messages", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const messageData = insertMessageSchema.parse({
        ...req.body,
        senderId: req.user.id,
        read: false
      });
      
      const message = await storage.createMessage(messageData);
      
      // Broadcast new message to WebSocket clients
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'new-message',
            message: {
              ...message,
              sender: {
                id: req.user.id,
                username: req.user.username,
                profilePicture: req.user.profilePicture,
                status: req.user.status
              }
            }
          }));
        }
      });
      
      res.status(201).json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid message data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to send message" });
    }
  });
  
  app.post("/api/messages/:id/read", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const messageId = parseInt(req.params.id);
      await storage.markMessageRead(messageId);
      
      // Broadcast message read status to WebSocket clients
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'message-read',
            messageId,
            userId: req.user.id
          }));
        }
      });
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark message as read" });
    }
  });
  
  app.get("/api/messages/unread/count", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const count = await storage.getUnreadMessageCount(req.user.id);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: "Failed to get unread message count" });
    }
  });
  
  // Contacts routes
  app.get("/api/contacts", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const contacts = await storage.getContacts(req.user.id);
      
      // Get all online users from WebSocket connections
      const onlineUserIds = Array.from(clients.values())
        .filter(client => client.userId)
        .map(client => client.userId);
      
      // Fetch user details for each contact formatted for chat UI
      const formattedContacts = await Promise.all(
        contacts.map(async (contact) => {
          const user = await storage.getUser(contact.contactId);
          if (!user) return null;
          
          // Format name based on available fields
          const name = user.firstName 
            ? `${user.firstName} ${user.lastName || ''}`.trim()
            : user.username;
            
          // Format status based on WebSocket connections
          const status = onlineUserIds.includes(user.id) ? 'online' : user.status || 'offline';
          
          return {
            id: user.id,
            name: name,
            username: user.username,
            avatar: user.profilePicture || null,
            status: status
          };
        })
      );
      
      // Filter out null values (in case any users weren't found)
      res.json(formattedContacts.filter(Boolean));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });
  
  // User search endpoint
  app.get("/api/users/search", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const query = req.query.q as string || '';
      
      if (!query || query.trim() === '') {
        return res.json([]);
      }
      
      const users = await storage.searchUsers(query);
      
      // Don't include the current user in search results
      const filteredUsers = users.filter(user => user.id !== req.user.id);
      
      // Send the results to the client directly
      res.json(filteredUsers);
      
      // Also broadcast via WebSocket that a search happened (for real-time friend suggestions)
      wss.clients.forEach((client) => {
        const clientInfo = clients.get(client);
        if (client.readyState === WebSocket.OPEN && clientInfo && clientInfo.userId === req.user.id) {
          client.send(JSON.stringify({
            type: 'search-results',
            query,
            results: filteredUsers.slice(0, 5) // Only send top 5 for suggestions
          }));
        }
      });
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ message: "Failed to search users" });
    }
  });
  
  // Friend suggestions endpoint
  app.get("/api/users/suggestions", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      // Use storage.getSuggestions which provides more intelligent recommendations
      const recommendedUsers = await storage.getSuggestions(req.user.id);
      
      // Send real-time suggestions via WebSocket
      wss.clients.forEach((client) => {
        const clientInfo = clients.get(client);
        if (client.readyState === WebSocket.OPEN && clientInfo && clientInfo.userId === req.user.id) {
          client.send(JSON.stringify({
            type: 'friend-suggestions',
            suggestions: recommendedUsers
          }));
        }
      });
      
      res.json(recommendedUsers);
    } catch (error) {
      console.error('Friend suggestions error:', error);
      res.status(500).json({ message: "Failed to get friend suggestions" });
    }
  });
  
  app.post("/api/contacts", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const contactData = insertContactSchema.parse({
        ...req.body,
        userId: req.user.id,
        status: 'active'
      });
      
      // Verify the contact user exists
      const contactUser = await storage.getUser(contactData.contactId);
      if (!contactUser) {
        return res.status(404).json({ message: "Contact user not found" });
      }
      
      const contact = await storage.createContact(contactData);
      
      res.status(201).json({
        ...contact,
        contactDetails: {
          id: contactUser.id,
          username: contactUser.username,
          profilePicture: contactUser.profilePicture,
          status: contactUser.status
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid contact data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to add contact" });
    }
  });
  
  app.put("/api/contacts/:id/status", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const contactId = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!status || typeof status !== 'string') {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      const updatedContact = await storage.updateContactStatus(contactId, status);
      
      if (!updatedContact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      res.json(updatedContact);
    } catch (error) {
      res.status(500).json({ message: "Failed to update contact status" });
    }
  });
  
  // Likes notifications endpoint
  app.get("/api/likes/notifications", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      // Get recent likes for user content (posts, stories, etc.)
      // We'll combine likes from posts and stories
      const posts = await storage.getPosts();
      const stories = await storage.getStories();
      
      // Filter for posts by the current user that have been liked
      const userPosts = posts.filter(post => post.userId === req.user.id && post.likes > 0);
      const userStories = stories.filter(story => story.userId === req.user.id && story.likes > 0);
      
      // Basic notification entries - in a real implementation, you might have a full notifications table
      const postNotifications = userPosts.map(post => ({
        contentType: 'post',
        postId: post.id,
        timestamp: post.updatedAt || post.createdAt,
        username: 'someone', // Simplified - you'd track who liked it
        userId: null,
        userAvatar: null
      }));
      
      const storyNotifications = userStories.map(story => ({
        contentType: 'story',
        storyId: story.id,
        timestamp: story.updatedAt || story.createdAt,
        username: 'someone', // Simplified - you'd track who liked it
        userId: null,
        userAvatar: null
      }));
      
      // Combine and sort by timestamp, newest first
      const allNotifications = [...postNotifications, ...storyNotifications]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10); // Limit to most recent 10
      
      res.json(allNotifications);
    } catch (error) {
      console.error('Error fetching like notifications:', error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });
  
  // Filter routes
  app.get("/api/filters", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const type = req.query.type as string | undefined;
      const filters = await storage.getFilters(type);
      
      res.json(filters);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch filters" });
    }
  });
  
  app.get("/api/filters/public", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const filters = await storage.getPublicFilters();
      res.json(filters);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch public filters" });
    }
  });
  
  app.get("/api/filters/my", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const filters = await storage.getUserFilters(req.user.id);
      res.json(filters);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user filters" });
    }
  });
  
  app.get("/api/filters/:id", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const filterId = parseInt(req.params.id);
      const filter = await storage.getFilterById(filterId);
      
      if (!filter) {
        return res.status(404).json({ message: "Filter not found" });
      }
      
      res.json(filter);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch filter" });
    }
  });
  
  app.post("/api/filters", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const filterData = insertFilterSchema.parse({
        ...req.body,
        createdBy: req.user.id
      });
      
      const filter = await storage.createFilter(filterData);
      
      // Broadcast new filter to WebSocket clients if it's public
      if (filter.isPublic) {
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'new-filter',
              filter
            }));
          }
        });
      }
      
      res.status(201).json(filter);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid filter data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create filter" });
    }
  });
  
  app.put("/api/filters/:id", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const filterId = parseInt(req.params.id);
      const filter = await storage.getFilterById(filterId);
      
      if (!filter) {
        return res.status(404).json({ message: "Filter not found" });
      }
      
      // Check if the user owns this filter
      if (filter.createdBy !== req.user.id) {
        return res.status(403).json({ message: "Forbidden: You don't own this filter" });
      }
      
      const updatedFilter = await storage.updateFilter(filterId, req.body);
      
      if (!updatedFilter) {
        return res.status(404).json({ message: "Filter not found" });
      }
      
      // Broadcast updated filter to WebSocket clients if it's public
      if (updatedFilter.isPublic) {
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'filter-updated',
              filter: updatedFilter
            }));
          }
        });
      }
      
      res.json(updatedFilter);
    } catch (error) {
      res.status(500).json({ message: "Failed to update filter" });
    }
  });
  
  // AI-enhanced filter routes
  
  app.post("/api/ai/analyze-image", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const { imageData } = req.body;
      
      if (!imageData) {
        return res.status(400).json({ message: "Image data is required" });
      }
      
      const analysis = await aiService.analyzeImage(imageData);
      res.json(analysis);
    } catch (error) {
      console.error("Error in image analysis:", error);
      res.status(500).json({ message: "Error analyzing image" });
    }
  });
  
  app.post("/api/ai/ar-face", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const { imageData } = req.body;
      
      if (!imageData) {
        return res.status(400).json({ message: "Image data is required" });
      }
      
      const faceParams = await aiService.generateARFaceParams(imageData);
      res.json(faceParams);
    } catch (error) {
      console.error("Error generating AR face parameters:", error);
      res.status(500).json({ message: "Error generating AR face parameters" });
    }
  });
  
  app.post("/api/ai/ar-world", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const { imageData } = req.body;
      
      if (!imageData) {
        return res.status(400).json({ message: "Image data is required" });
      }
      
      const worldParams = await aiService.generateARWorldParams(imageData);
      res.json(worldParams);
    } catch (error) {
      console.error("Error generating AR world parameters:", error);
      res.status(500).json({ message: "Error generating AR world parameters" });
    }
  });
  
  app.post("/api/ai/vr", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const { imageData, vrType } = req.body;
      
      if (!imageData || !vrType) {
        return res.status(400).json({ message: "Image data and VR type are required" });
      }
      
      const vrParams = await aiService.generateVRParams(imageData, vrType);
      res.json(vrParams);
    } catch (error) {
      console.error("Error generating VR parameters:", error);
      res.status(500).json({ message: "Error generating VR parameters" });
    }
  });

  // Set up automatic cleanup of expired stories (runs every hour)
  const HOUR_IN_MS = 60 * 60 * 1000;
  setInterval(async () => {
    try {
      const deletedCount = await storage.deleteExpiredStories();
      if (deletedCount > 0) {
        console.log(`Cleanup: Deleted ${deletedCount} expired stories`);
        
        // Notify connected clients about deleted stories
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'stories-cleanup',
              count: deletedCount,
              timestamp: new Date().toISOString()
            }));
          }
        });
      }
    } catch (error) {
      console.error("Error cleaning up expired stories:", error);
    }
  }, HOUR_IN_MS);

  return httpServer;
}
