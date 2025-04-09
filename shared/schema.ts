import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email"),
  profilePicture: text("profile_picture"),
  bio: text("bio"),
  status: text("status").default("online"),
  lastActive: timestamp("last_active").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// We'll setup relations later after all tables are defined

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  imageUrl: text("image_url").notNull(),
  caption: text("caption"),
  location: text("location"),
  aiEnhanced: boolean("ai_enhanced").default(false),
  arFilter: text("ar_filter"),
  filterData: jsonb("filter_data"),
  likes: integer("likes").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const postsRelations = relations(posts, ({ one }) => ({
  user: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
}));

export const stories = pgTable("stories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  imageUrl: text("image_url").notNull(),
  filter: text("filter"),
  aiEnhanced: boolean("ai_enhanced").default(false),
  arEnabled: boolean("ar_enabled").default(false),
  vrEnabled: boolean("vr_enabled").default(false),
  filterData: jsonb("filter_data"),
  viewers: jsonb("viewers").default([]),
  likes: integer("likes").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

export const storiesRelations = relations(stories, ({ one }) => ({
  user: one(users, {
    fields: [stories.userId],
    references: [users.id],
  }),
}));

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id).unique(),
  aiFilters: boolean("ai_filters").default(true),
  smartHashtags: boolean("smart_hashtags").default(true),
  aiContentEnhancement: boolean("ai_content_enhancement").default(true),
  contentRecommendations: boolean("content_recommendations").default(false),
  pushNotifications: boolean("push_notifications").default(true),
  emailNotifications: boolean("email_notifications").default(false),
  realTimeUpdates: boolean("real_time_updates").default(true),
  arVrFeatures: boolean("ar_vr_features").default(true),
  messageEncryption: boolean("message_encryption").default(true),
  theme: text("theme").default("light"),
});

// New tables for real-time messaging and privacy
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull().references(() => users.id),
  receiverId: integer("receiver_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  arFilterApplied: boolean("ar_filter_applied").default(false),
  filterData: jsonb("filter_data"),
  read: boolean("read").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messagesRelations = relations(messages, ({ one }) => ({
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
    relationName: "sender",
  }),
  receiver: one(users, {
    fields: [messages.receiverId],
    references: [users.id],
    relationName: "receiver",
  }),
}));

export const privacy = pgTable("privacy", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id).unique(),
  profileVisibility: text("profile_visibility").default("public"),
  storyVisibility: text("story_visibility").default("all"),
  lastSeenVisibility: text("last_seen_visibility").default("all"),
  messagePermission: text("message_permission").default("all"),
  dataUsageConsent: boolean("data_usage_consent").default(true),
});

export const privacyRelations = relations(privacy, ({ one }) => ({
  user: one(users, {
    fields: [privacy.userId],
    references: [users.id],
  }),
}));

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  contactId: integer("contact_id").notNull().references(() => users.id),
  status: text("status").default("pending"), // pending, accepted, blocked
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contactsRelations = relations(contacts, ({ one }) => ({
  user: one(users, {
    fields: [contacts.userId],
    references: [users.id],
    relationName: "user",
  }),
  contact: one(users, {
    fields: [contacts.contactId],
    references: [users.id],
    relationName: "contact",
  }),
}));

export const filters = pgTable("filters", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // ar, vr, ai, basic
  configuration: jsonb("configuration").notNull(),
  previewUrl: text("preview_url"),
  isPublic: boolean("is_public").default(true),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const filtersRelations = relations(filters, ({ one }) => ({
  creator: one(users, {
    fields: [filters.createdBy],
    references: [users.id],
  }),
}));

export const settingsRelations = relations(settings, ({ one }) => ({
  user: one(users, {
    fields: [settings.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  firstName: true,
  lastName: true,
  email: true,
  bio: true,
  profilePicture: true,
  status: true,
});

export const insertPostSchema = createInsertSchema(posts).pick({
  userId: true,
  imageUrl: true,
  caption: true,
  location: true,
  aiEnhanced: true,
  arFilter: true,
  filterData: true,
});

export const insertStorySchema = createInsertSchema(stories).pick({
  userId: true,
  imageUrl: true,
  filter: true,
  aiEnhanced: true,
  arEnabled: true,
  vrEnabled: true,
  filterData: true,
});

export const insertSettingsSchema = createInsertSchema(settings).pick({
  userId: true,
  aiFilters: true,
  smartHashtags: true,
  aiContentEnhancement: true,
  contentRecommendations: true,
  pushNotifications: true,
  emailNotifications: true,
  realTimeUpdates: true,
  arVrFeatures: true,
  messageEncryption: true,
  theme: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  senderId: true,
  receiverId: true,
  content: true,
  arFilterApplied: true,
  filterData: true,
});

export const insertPrivacySchema = createInsertSchema(privacy).pick({
  userId: true,
  profileVisibility: true,
  storyVisibility: true,
  lastSeenVisibility: true,
  messagePermission: true,
  dataUsageConsent: true,
});

export const insertContactSchema = createInsertSchema(contacts).pick({
  userId: true,
  contactId: true,
  status: true,
});

export const insertFilterSchema = createInsertSchema(filters).pick({
  name: true,
  type: true,
  configuration: true,
  previewUrl: true,
  isPublic: true,
  createdBy: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof posts.$inferSelect;

export type InsertStory = z.infer<typeof insertStorySchema>;
export type Story = typeof stories.$inferSelect;

export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export type InsertPrivacy = z.infer<typeof insertPrivacySchema>;
export type Privacy = typeof privacy.$inferSelect;

export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

export type InsertFilter = z.infer<typeof insertFilterSchema>;
export type Filter = typeof filters.$inferSelect;

// Extended types for frontend
export type UserWithProfile = User & {
  postCount?: number;
  followerCount?: number;
  followingCount?: number;
  privacy?: Privacy;
  onlineStatus?: string;
};

export type PostWithUser = Post & {
  user: Pick<User, 'id' | 'username' | 'profilePicture' | 'status'>;
  filter?: Filter;
};

export type StoryWithUser = Story & {
  user: Pick<User, 'id' | 'username' | 'profilePicture' | 'status'>;
  filter?: Filter;
};

export type StoryViewer = {
  userId: number;
  username: string;
  profilePicture: string;
  viewedAt: string;
};

export type MessageWithUsers = Message & {
  sender: Pick<User, 'id' | 'username' | 'profilePicture' | 'status'>;
  receiver: Pick<User, 'id' | 'username' | 'profilePicture' | 'status'>;
  filter?: Filter;
};

export type ContactWithUser = Contact & {
  user: Pick<User, 'id' | 'username' | 'profilePicture' | 'status'>;
  contact: Pick<User, 'id' | 'username' | 'profilePicture' | 'status'>;
};

export type FilterWithCreator = Filter & {
  creator?: Pick<User, 'id' | 'username' | 'profilePicture'>;
};

// AR/VR filter configuration types
export type ARFilterConfig = {
  type: 'ar';
  meshData?: string;
  textureUrl?: string;
  animationData?: any;
  intensity?: number;
  trackingPoints?: string[];
  overlayElements?: AROverlayElement[];
};

export type VRFilterConfig = {
  type: 'vr';
  environment?: string;
  immersionLevel?: number;
  interactiveElements?: VRInteractiveElement[];
  audioUrl?: string;
  lighting?: VRLighting;
};

export type AIFilterConfig = {
  type: 'ai';
  model?: string;
  parameters?: Record<string, any>;
  styleTransfer?: boolean;
  enhancementLevel?: number;
};

export type AROverlayElement = {
  id: string;
  type: 'text' | 'image' | '3d' | 'effect';
  content: string;
  position: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
};

export type VRInteractiveElement = {
  id: string;
  type: string;
  position: { x: number; y: number; z: number };
  action: string;
  triggerDistance?: number;
};

export type VRLighting = {
  ambient: string;
  directional?: string;
  intensity: number;
  shadows?: boolean;
};

// Setup user relations after all tables are defined
export const usersRelations = relations(users, ({ many, one }) => ({
  posts: many(posts),
  stories: many(stories),
  settings: one(settings),
  sentMessages: many(messages, { relationName: "sender" }),
  receivedMessages: many(messages, { relationName: "receiver" }),
  userPrivacy: one(privacy),
  contacts: many(contacts, { relationName: "user" }),
  contactsOf: many(contacts, { relationName: "contact" }),
}));
