import { 
  users, type User, type InsertUser, 
  posts, type Post, type InsertPost, 
  stories, type Story, type InsertStory, 
  settings, type Settings, type InsertSettings, 
  messages, type Message, type InsertMessage,
  privacy, type Privacy, type InsertPrivacy,
  contacts, type Contact, type InsertContact,
  filters, type Filter, type InsertFilter,
  type StoryViewer, type MessageWithUsers, type ContactWithUser, type FilterWithCreator
} from "@shared/schema";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { db } from "./db";
import { eq, desc, and, gt, lt, sql, ne, or } from "drizzle-orm";
import { Pool } from "@neondatabase/serverless";

// Create a PostgreSQL session store
const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  searchUsers(query: string): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User | undefined>;
  setUserStatus(id: number, status: string): Promise<void>;
  getSuggestions(userId: number): Promise<User[]>;
  
  // Post methods
  getPosts(): Promise<Post[]>;
  getPostsByUserId(userId: number): Promise<Post[]>;
  createPost(post: InsertPost): Promise<Post>;
  likePost(id: number): Promise<void>;
  deletePost(id: number, userId: number): Promise<boolean>;
  
  // Story methods
  getStories(): Promise<Story[]>;
  getStoriesByUserId(userId: number): Promise<Story[]>;
  createStory(story: InsertStory): Promise<Story>;
  addStoryViewer(storyId: number, viewer: StoryViewer): Promise<void>;
  getStoryViewers(storyId: number): Promise<StoryViewer[]>;
  likeStory(id: number, userId: number): Promise<Story | undefined>;
  deleteStory(id: number, userId: number): Promise<boolean>;
  deleteExpiredStories(): Promise<number>;
  
  // Settings methods
  getSettings(userId: number): Promise<Settings | undefined>;
  createSettings(settings: InsertSettings): Promise<Settings>;
  updateSettings(userId: number, settings: Partial<Settings>): Promise<Settings | undefined>;
  
  // Message methods
  getMessages(userId: number, contactId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessageRead(id: number): Promise<void>;
  getUnreadMessageCount(userId: number): Promise<number>;
  
  // Privacy methods
  getPrivacy(userId: number): Promise<Privacy | undefined>;
  createPrivacy(privacy: InsertPrivacy): Promise<Privacy>;
  updatePrivacy(userId: number, privacySettings: Partial<Privacy>): Promise<Privacy | undefined>;
  
  // Contact methods
  getContacts(userId: number): Promise<Contact[]>;
  getContactWithDetails(contactId: number): Promise<ContactWithUser | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContactStatus(id: number, status: string): Promise<Contact | undefined>;
  
  // Filter methods
  getFilters(type?: string): Promise<Filter[]>;
  getFilterById(id: number): Promise<FilterWithCreator | undefined>;
  createFilter(filter: InsertFilter): Promise<Filter>;
  updateFilter(id: number, filter: Partial<Filter>): Promise<Filter | undefined>;
  getPublicFilters(): Promise<Filter[]>;
  getUserFilters(userId: number): Promise<Filter[]>;
  
  sessionStore: any; // Store for express-session
}

export class DatabaseStorage implements IStorage {
  sessionStore: any; // Express session store
  
  constructor() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  
  async searchUsers(query: string): Promise<User[]> {
    // If empty query, return all users (limited for performance)
    if (!query || query.trim() === '') {
      return db
        .select()
        .from(users)
        .limit(50); // Limit for performance
    }
    
    const lowerCaseQuery = query.toLowerCase();
    
    // Search by username, firstName, lastName, and bio
    const results = await db
      .select()
      .from(users)
      .where(
        or(
          sql`LOWER(${users.username}) LIKE ${'%' + lowerCaseQuery + '%'}`,
          sql`LOWER(${users.firstName}) LIKE ${'%' + lowerCaseQuery + '%'}`,
          sql`LOWER(${users.lastName}) LIKE ${'%' + lowerCaseQuery + '%'}`,
          sql`LOWER(${users.bio}) LIKE ${'%' + lowerCaseQuery + '%'}`
        )
      )
      .limit(20); // Limit results for performance
    
    return results;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    
    // Create default settings for new user
    await this.createSettings({
      userId: user.id,
      aiFilters: true,
      smartHashtags: true,
      aiContentEnhancement: true,
      contentRecommendations: false,
      pushNotifications: true,
      emailNotifications: false,
      realTimeUpdates: true,
      arVrFeatures: true,
      messageEncryption: true,
      theme: 'light'
    });
    
    // Create default privacy settings for new user
    await this.createPrivacy({
      userId: user.id,
      profileVisibility: 'public',
      storyVisibility: 'all',
      lastSeenVisibility: 'all',
      messagePermission: 'all',
      dataUsageConsent: true
    });
    
    return user;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    
    return updatedUser;
  }
  
  async setUserStatus(id: number, status: string): Promise<void> {
    const now = new Date();
    await db
      .update(users)
      .set({ 
        status,
        lastActive: now
      })
      .where(eq(users.id, id));
  }
  
  async getSuggestions(userId: number): Promise<User[]> {
    try {
      // For now, we'll simply suggest users who are not the current user
      // In a more sophisticated implementation, this would consider:
      // - Users with similar interests
      // - Users with mutual connections
      // - Users from similar geographic areas
      // - Active users
      
      const allUsers = await db
        .select()
        .from(users)
        .where(ne(users.id, userId))
        .limit(10); // Limit for performance
      
      // Remove sensitive information like passwords
      return allUsers.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword as User;
      });
    } catch (error) {
      console.error("Error getting user suggestions:", error);
      return [];
    }
  }

  // Post methods
  async getPosts(): Promise<Post[]> {
    return db.select().from(posts).orderBy(desc(posts.createdAt));
  }

  async getPostsByUserId(userId: number): Promise<Post[]> {
    return db
      .select()
      .from(posts)
      .where(eq(posts.userId, userId))
      .orderBy(desc(posts.createdAt));
  }

  async createPost(postData: InsertPost): Promise<Post> {
    const [post] = await db.insert(posts).values(postData).returning();
    return post;
  }

  async likePost(id: number): Promise<void> {
    await db
      .update(posts)
      .set({ likes: sql`${posts.likes} + 1` })
      .where(eq(posts.id, id));
  }
  
  async deletePost(id: number, userId: number): Promise<boolean> {
    // Only allow users to delete their own posts
    const [result] = await db
      .delete(posts)
      .where(and(
        eq(posts.id, id),
        eq(posts.userId, userId)
      ))
      .returning({ id: posts.id });
    
    return !!result;
  }

  // Story methods
  async getStories(): Promise<Story[]> {
    const now = new Date();
    return db
      .select()
      .from(stories)
      .where(
        // Story has no expiration or hasn't expired yet
        sql`${stories.expiresAt} IS NULL OR ${stories.expiresAt} > ${now}`
      )
      .orderBy(desc(stories.createdAt));
  }

  async getStoriesByUserId(userId: number): Promise<Story[]> {
    const now = new Date();
    return db
      .select()
      .from(stories)
      .where(
        and(
          eq(stories.userId, userId),
          sql`${stories.expiresAt} IS NULL OR ${stories.expiresAt} > ${now}`
        )
      )
      .orderBy(desc(stories.createdAt));
  }

  async createStory(storyData: InsertStory): Promise<Story> {
    // Stories expire after 24 hours
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    const [story] = await db
      .insert(stories)
      .values({
        ...storyData,
        viewers: [],
        expiresAt
      })
      .returning();
    
    return story;
  }

  async addStoryViewer(storyId: number, viewer: StoryViewer): Promise<void> {
    const [story] = await db
      .select()
      .from(stories)
      .where(eq(stories.id, storyId));
    
    if (story) {
      const currentViewers = story.viewers as StoryViewer[] || [];
      
      // Check if user has already viewed
      const existingViewer = currentViewers.find(v => v.userId === viewer.userId);
      
      if (!existingViewer) {
        const updatedViewers = [...currentViewers, viewer];
        
        await db
          .update(stories)
          .set({ viewers: updatedViewers })
          .where(eq(stories.id, storyId));
      }
    }
  }

  async getStoryViewers(storyId: number): Promise<StoryViewer[]> {
    const [story] = await db
      .select()
      .from(stories)
      .where(eq(stories.id, storyId));
    
    return story ? (story.viewers as StoryViewer[] || []) : [];
  }
  
  async likeStory(id: number, userId: number): Promise<Story | undefined> {
    // Check if story exists
    const [story] = await db
      .select()
      .from(stories)
      .where(eq(stories.id, id));
    
    if (!story) return undefined;
    
    // Update the likes count
    const likesCount = (story.likes || 0) + 1;
    
    // Update the story
    const [updatedStory] = await db
      .update(stories)
      .set({ likes: likesCount })
      .where(eq(stories.id, id))
      .returning();
    
    return updatedStory;
  }
  
  async deleteStory(id: number, userId: number): Promise<boolean> {
    // Only allow users to delete their own stories
    const [result] = await db
      .delete(stories)
      .where(and(
        eq(stories.id, id),
        eq(stories.userId, userId)
      ))
      .returning({ id: stories.id });
    
    return !!result;
  }
  
  async deleteExpiredStories(): Promise<number> {
    const now = new Date();
    const result = await db
      .delete(stories)
      .where(
        sql`${stories.expiresAt} IS NOT NULL AND ${stories.expiresAt} < ${now}`
      )
      .returning();
    
    return result.length;
  }

  // Settings methods
  async getSettings(userId: number): Promise<Settings | undefined> {
    const [setting] = await db
      .select()
      .from(settings)
      .where(eq(settings.userId, userId));
    
    return setting;
  }

  async createSettings(settingsData: InsertSettings): Promise<Settings> {
    const [setting] = await db
      .insert(settings)
      .values(settingsData)
      .returning();
    
    return setting;
  }

  async updateSettings(userId: number, settingsData: Partial<Settings>): Promise<Settings | undefined> {
    const [updatedSetting] = await db
      .update(settings)
      .set(settingsData)
      .where(eq(settings.userId, userId))
      .returning();
    
    return updatedSetting;
  }
  
  // Message methods
  async getMessages(userId: number, contactId: number): Promise<Message[]> {
    return db
      .select()
      .from(messages)
      .where(
        or(
          and(
            eq(messages.senderId, userId),
            eq(messages.receiverId, contactId)
          ),
          and(
            eq(messages.senderId, contactId),
            eq(messages.receiverId, userId)
          )
        )
      )
      .orderBy(messages.createdAt);
  }

  async createMessage(messageData: InsertMessage): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values(messageData)
      .returning();
    
    return message;
  }

  async markMessageRead(id: number): Promise<void> {
    await db
      .update(messages)
      .set({ read: true })
      .where(eq(messages.id, id));
  }

  async getUnreadMessageCount(userId: number): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(
        and(
          eq(messages.receiverId, userId),
          eq(messages.read, false)
        )
      );
    
    return result[0]?.count || 0;
  }
  
  // Privacy methods
  async getPrivacy(userId: number): Promise<Privacy | undefined> {
    const [privacySettings] = await db
      .select()
      .from(privacy)
      .where(eq(privacy.userId, userId));
    
    return privacySettings;
  }

  async createPrivacy(privacyData: InsertPrivacy): Promise<Privacy> {
    const [privacySettings] = await db
      .insert(privacy)
      .values(privacyData)
      .returning();
    
    return privacySettings;
  }

  async updatePrivacy(userId: number, privacySettings: Partial<Privacy>): Promise<Privacy | undefined> {
    const [updatedPrivacy] = await db
      .update(privacy)
      .set(privacySettings)
      .where(eq(privacy.userId, userId))
      .returning();
    
    return updatedPrivacy;
  }
  
  // Contact methods
  async getContacts(userId: number): Promise<Contact[]> {
    return db
      .select()
      .from(contacts)
      .where(eq(contacts.userId, userId))
      .orderBy(contacts.createdAt);
  }

  async getContactWithDetails(contactId: number): Promise<ContactWithUser | undefined> {
    const [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, contactId));
      
    if (!contact) return undefined;
    
    const [contactUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, contact.contactId));
      
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, contact.userId));
    
    if (!contactUser || !user) return undefined;
    
    return {
      ...contact,
      contact: {
        id: contactUser.id,
        username: contactUser.username,
        profilePicture: contactUser.profilePicture,
        status: contactUser.status
      },
      user: {
        id: user.id,
        username: user.username,
        profilePicture: user.profilePicture,
        status: user.status
      }
    };
  }

  async createContact(contactData: InsertContact): Promise<Contact> {
    const [contact] = await db
      .insert(contacts)
      .values(contactData)
      .returning();
    
    return contact;
  }

  async updateContactStatus(id: number, status: string): Promise<Contact | undefined> {
    const [updatedContact] = await db
      .update(contacts)
      .set({ status })
      .where(eq(contacts.id, id))
      .returning();
    
    return updatedContact;
  }
  
  // Filter methods
  async getFilters(type?: string): Promise<Filter[]> {
    if (type) {
      return db
        .select()
        .from(filters)
        .where(eq(filters.type, type))
        .orderBy(filters.name);
    }
    
    return db
      .select()
      .from(filters)
      .orderBy(filters.name);
  }

  async getFilterById(id: number): Promise<FilterWithCreator | undefined> {
    const [filter] = await db
      .select()
      .from(filters)
      .where(eq(filters.id, id));
      
    if (!filter) return undefined;
    
    if (filter.createdBy) {
      const [creator] = await db
        .select()
        .from(users)
        .where(eq(users.id, filter.createdBy));
        
      if (creator) {
        return {
          ...filter,
          creator: {
            id: creator.id,
            username: creator.username,
            profilePicture: creator.profilePicture
          }
        };
      }
    }
    
    return filter;
  }

  async createFilter(filterData: InsertFilter): Promise<Filter> {
    const [filter] = await db
      .insert(filters)
      .values(filterData)
      .returning();
    
    return filter;
  }

  async updateFilter(id: number, filterData: Partial<Filter>): Promise<Filter | undefined> {
    const [updatedFilter] = await db
      .update(filters)
      .set(filterData)
      .where(eq(filters.id, id))
      .returning();
    
    return updatedFilter;
  }

  async getPublicFilters(): Promise<Filter[]> {
    return db
      .select()
      .from(filters)
      .where(eq(filters.isPublic, true))
      .orderBy(filters.name);
  }

  async getUserFilters(userId: number): Promise<Filter[]> {
    return db
      .select()
      .from(filters)
      .where(eq(filters.createdBy, userId))
      .orderBy(filters.name);
  }
}

// Switch to database storage
export const storage = new DatabaseStorage();
