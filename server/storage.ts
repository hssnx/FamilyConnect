import { db } from "./db";
import { users, tasks, submissions, taskGenerations, userInteractions } from "@shared/schema";
import { User, InsertUser, Task, InsertTask, Submission, InsertSubmission, TaskGeneration, InsertTaskGeneration, UserInteraction, InsertUserInteraction } from "@shared/schema";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { eq, and, gt, lt, sql } from "drizzle-orm";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User>;
  getAllUsers(): Promise<User[]>;
  createTask(task: InsertTask): Promise<Task>;
  getAllTasks(): Promise<Task[]>;
  getTasks(userId: number): Promise<Task[]>;
  getTaskById(taskId: number): Promise<Task | undefined>;
  updateTask(taskId: number, updates: Partial<Task>): Promise<Task>;
  deleteTask(taskId: number): Promise<void>;
  createSubmission(submission: InsertSubmission & { correct: boolean }): Promise<Submission>;
  getSubmissions(taskId: number): Promise<(Submission & { submitterName: string | null })[]>;
  sessionStore: session.Store;
  createTaskGeneration(generation: InsertTaskGeneration & { generatedTasks: any }): Promise<TaskGeneration>;
  approveTaskGeneration(id: number): Promise<void>;
  getFutureTasks(userId: number): Promise<Task[]>;
  getTodaysTasks(userId: number): Promise<Task[]>;
  getPastTasks(userId: number): Promise<Task[]>;
  createInteraction(interaction: InsertUserInteraction): Promise<UserInteraction>;
  getRecentInteraction(giverId: number, receiverId: number): Promise<UserInteraction | undefined>;
  approveInteraction(id: number): Promise<void>;
  getUserInteractions(userId: number): Promise<UserInteraction[]>;
  getUserInteractionCounts(userId: number): Promise<{ likes: number; dislikes: number }>;
  checkOverdueTasks(userId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true,
      tableName: 'user_sessions'
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [createdUser] = await db.insert(users).values(user).returning();
    return createdUser;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [createdTask] = await db.insert(tasks).values(task).returning();
    return createdTask;
  }

  async getAllTasks(): Promise<Task[]> {
    return await db.select().from(tasks);
  }

  async getTasks(userId: number): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.userId, userId));
  }

  async getTaskById(taskId: number): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    return task;
  }

  async updateTask(taskId: number, updates: Partial<Task>): Promise<Task> {
    const [updatedTask] = await db
      .update(tasks)
      .set(updates)
      .where(eq(tasks.id, taskId))
      .returning();
    return updatedTask;
  }

  async deleteTask(taskId: number): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, taskId));
  }

  async createSubmission(submission: InsertSubmission & { correct: boolean }): Promise<Submission> {
    const [createdSubmission] = await db
      .insert(submissions)
      .values(submission)
      .returning();
    return createdSubmission;
  }

  async getSubmissions(taskId: number): Promise<(Submission & { submitterName: string | null })[]> {
    const results = await db
      .select({
        submission: submissions,
        username: users.username
      })
      .from(submissions)
      .leftJoin(users, eq(submissions.userId, users.id))
      .where(eq(submissions.taskId, taskId));

    return results.map(({ submission, username }) => ({
      ...submission,
      submitterName: username
    }));
  }

  async createTaskGeneration(generation: InsertTaskGeneration & { generatedTasks: any }): Promise<TaskGeneration> {
    const [createdGeneration] = await db
      .insert(taskGenerations)
      .values({ 
        ...generation,
        generatedTasks: generation.generatedTasks,
      })
      .returning();
    return createdGeneration;
  }

  async approveTaskGeneration(id: number): Promise<void> {
    await db
      .update(taskGenerations)
      .set({ approved: true })
      .where(eq(taskGenerations.id, id));
  }

  async getFutureTasks(userId: number): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          gt(sql`DATE(${tasks.dueDate})`, sql`CURRENT_DATE`)
        )
      );
  }

  async getTodaysTasks(userId: number): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          eq(sql`DATE(${tasks.dueDate})`, sql`CURRENT_DATE`)
        )
      );
  }

  async getPastTasks(userId: number): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          lt(sql`DATE(${tasks.dueDate})`, sql`CURRENT_DATE`)
        )
      );
  }

  async createInteraction(interaction: InsertUserInteraction): Promise<UserInteraction> {
    const [createdInteraction] = await db
      .insert(userInteractions)
      .values({
        ...interaction,
        approved: true 
      })
      .returning();

    const pointChange = interaction.type === 'like' ? 2 : -2;
    await db
      .update(users)
      .set({
        points: sql`${users.points} + ${pointChange}`
      })
      .where(eq(users.id, interaction.receiverId));

    return createdInteraction;
  }

  async getRecentInteraction(giverId: number, receiverId: number): Promise<UserInteraction | undefined> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const [recentInteraction] = await db
      .select()
      .from(userInteractions)
      .where(
        and(
          eq(userInteractions.giverId, giverId),
          eq(userInteractions.receiverId, receiverId),
          gt(userInteractions.createdAt, yesterday)
        )
      )
      .orderBy(sql`${userInteractions.createdAt} DESC`);

    return recentInteraction;
  }

  async getUserInteractions(userId: number): Promise<UserInteraction[]> {
    return await db
      .select()
      .from(userInteractions)
      .where(
        eq(userInteractions.receiverId, userId)
      )
      .orderBy(sql`${userInteractions.createdAt} DESC`);
  }

  async getUserInteractionCounts(userId: number): Promise<{ likes: number; dislikes: number }> {
    const interactions = await db
      .select()
      .from(userInteractions)
      .where(
        and(
          eq(userInteractions.receiverId, userId),
          eq(userInteractions.approved, true)
        )
      );

    return {
      likes: interactions.filter(i => i.type === 'like').length,
      dislikes: interactions.filter(i => i.type === 'dislike').length
    };
  }
  async approveInteraction(id: number): Promise<void> {
    await db
      .update(userInteractions)
      .set({ approved: true })
      .where(eq(userInteractions.id, id));
  }

  async checkOverdueTasks(userId: number): Promise<void> {
    const overdueTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          eq(tasks.completed, false),
          eq(tasks.penaltyApplied, false),
          lt(sql`DATE(${tasks.dueDate})`, sql`CURRENT_DATE`),
          eq(tasks.status, 'pending')
        )
      );

    if (overdueTasks.length === 0) return;

    await db.transaction(async (tx) => {
      for (const task of overdueTasks) {
        const penaltyPoints = Math.floor(task.taskPoints / 2);

        await tx
          .update(users)
          .set({
            points: sql`${users.points} - ${penaltyPoints}`
          })
          .where(eq(users.id, userId));

        await tx
          .update(tasks)
          .set({
            status: 'missed',
            penaltyApplied: true
          })
          .where(eq(tasks.id, task.id));
      }
    });
  }
}

export const storage = new DatabaseStorage();