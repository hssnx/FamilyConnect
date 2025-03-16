import { pgTable, text, serial, integer, boolean, date, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Keep existing users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  bio: text("bio"),
  profilePicture: text("profile_picture"),
  isAdmin: boolean("is_admin").notNull().default(false),
  points: integer("points").notNull().default(0),
  streak: integer("streak").notNull().default(0),
  lastStreak: timestamp("last_streak"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Add new user_daily_completions table
export const userDailyCompletions = pgTable("user_daily_completions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  completionDate: date("completion_date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Keep existing userInteractions table
export const userInteractions = pgTable("user_interactions", {
  id: serial("id").primaryKey(),
  giverId: integer("giver_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  receiverId: integer("receiver_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text("type").notNull(),
  reason: text("reason"),
  approved: boolean("approved").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Keep existing tasks table
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  goal: text("goal").default("Complete the assigned task successfully"),
  dueDate: date("due_date").notNull(),
  completed: boolean("completed").notNull().default(false),
  attempts: integer("attempts").notNull().default(0),
  completedBy: integer("completed_by").references(() => users.id),
  completedByName: text("completed_by_name"),
  taskPoints: integer("task_points").notNull().default(10),
  status: text("status").notNull().default('pending'),
  penaltyApplied: boolean("penalty_applied").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Update submissions table
export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  answer: text("answer").notNull(),
  correct: boolean("correct").notNull(),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  aiFeedback: text("ai_feedback"),
});

// Keep existing taskGenerations table
export const taskGenerations = pgTable("task_generations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  days: integer("days").notNull().default(30),
  numberOfSessions: integer("number_of_sessions").notNull().default(3),
  problemsPerSession: integer("problems_per_session").notNull().default(2),
  goal: text("goal").notNull(),
  generatedTasks: json("generated_tasks").notNull(),
  approved: boolean("approved").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Update submission schema to match new requirements
export const insertSubmissionSchema = createInsertSchema(submissions)
  .pick({
    taskId: true,
    userId: true,
    answer: true,
  })
  .extend({
    answer: z.string().min(1, "Answer is required"),
  });

// Keep other schemas
export const insertUserInteractionSchema = createInsertSchema(userInteractions)
  .pick({
    giverId: true,
    receiverId: true,
    type: true,
    reason: true,
  })
  .extend({
    type: z.enum(['like', 'dislike']),
    reason: z.string().optional(),
  });

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  bio: true,
  profilePicture: true,
  isAdmin: true,
});

export const insertTaskSchema = createInsertSchema(tasks).pick({
  userId: true,
  title: true,
  description: true,
  category: true,
  dueDate: true,
}).extend({
  title: z.string().max(100).optional(),
  category: z.string().optional(),
  description: z.string(),
});

export const insertTaskGenerationSchema = createInsertSchema(taskGenerations).pick({
  userId: true,
  days: true,
  numberOfSessions: true,
  problemsPerSession: true,
  goal: true,
});

// Export types
export type UserInteraction = typeof userInteractions.$inferSelect;
export type InsertUserInteraction = z.infer<typeof insertUserInteractionSchema>;

export type User = typeof users.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type TaskGeneration = typeof taskGenerations.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;
export type InsertTaskGeneration = z.infer<typeof insertTaskGenerationSchema>;

// Add new type for UserDailyCompletion
export type UserDailyCompletion = typeof userDailyCompletions.$inferSelect;
export type InsertUserDailyCompletion = typeof userDailyCompletions.$inferInsert;