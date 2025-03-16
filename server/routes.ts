import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { verifyAnswer, openai } from "./openai"; // Added openai import
import { insertTaskSchema, insertSubmissionSchema, insertUserInteractionSchema } from "@shared/schema";
import { generateTasks } from "./task-generator";
import { insertTaskGenerationSchema } from "@shared/schema";
import { hashPassword } from "./auth";
import * as z from 'zod';
import { startOfDay, isAfter, differenceInDays } from "date-fns";

function requireAuth(req: Express.Request, res: Express.Response, next: Express.NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

function requireAdmin(req: Express.Request, res: Express.Response, next: Express.NextFunction) {
  if (!req.isAuthenticated() || !req.user?.isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Add this endpoint before other task endpoints
  app.post("/api/tasks/enhance", requireAdmin, async (req, res) => {
    try {
      const { description } = req.body;

      const prompt = `Given this task description, generate a concise title (max 100 chars), a refined task description, and suggest an appropriate category.

Task: ${description}

The task can be any type (e.g., household chores, family activities, academic work, personal growth).
Make the title action-oriented when applicable.
Choose a category that best fits the context (e.g., "Household Chores", "Family Activity", "Academic", "Personal Growth").

Return a JSON object with exactly these fields:
{
  "title": "Action-oriented, clear title",
  "description": "Refined, clear description with any relevant instructions",
  "category": "Best fitting category"
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an expert at creating clear, practical task descriptions for families. Always return only valid JSON with the exact fields requested."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const content = response.choices[0].message.content;
      const enhancedTask = JSON.parse(content);

      res.json(enhancedTask);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Add the new endpoint for getting user interaction counts
  app.get("/api/users/:userId/interaction-counts", requireAuth, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const counts = await storage.getUserInteractionCounts(userId);
      res.json(counts);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Add this endpoint to check overdue tasks
  app.post("/api/tasks/check-overdue", requireAuth, async (req, res) => {
    try {
      await storage.checkOverdueTasks(req.user!.id);
      res.json({ message: "Overdue tasks checked" });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Update the task creation endpoint
  app.post("/api/tasks", requireAdmin, async (req, res) => {
    try {
      const taskData = insertTaskSchema.parse({
        ...req.body,
        // Add default goal if not provided
        goal: req.body.goal || 'Complete the assigned task successfully',
        taskPoints: req.body.taskPoints || 10 // Default to 10 points if not specified
      });

      const task = await storage.createTask({
        ...taskData,
        goal: taskData.goal,
      });

      res.status(201).json(task);
    } catch (error) {
      console.error('Task creation error:', error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to create task"
      });
    }
  });

  // User management endpoints
  app.get("/api/users", requireAuth, async (_req, res) => {
    const users = await storage.getAllUsers();
    const sanitizedUsers = users.map(user => ({
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
      points: user.points,
      streak: user.streak
    }));
    res.json(sanitizedUsers);
  });

  // Add these endpoints to handle user profiles
  app.get("/api/users/:userId", requireAuth, async (req, res) => {
    const userId = parseInt(req.params.userId);
    const user = await storage.getUser(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Don't send the password hash
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  });

  app.patch("/api/users/:userId", requireAuth, async (req, res) => {
    const userId = parseInt(req.params.userId);

    // Users can only update their own profile unless they're an admin
    if (userId !== req.user?.id && !req.user?.isAdmin) {
      return res.status(403).json({ message: "Not authorized to update this profile" });
    }

    const updates = req.body;
    const updatedUser = await storage.updateUser(userId, updates);

    // Don't send the password hash
    const { password, ...userWithoutPassword } = updatedUser;
    res.json(userWithoutPassword);
  });

  // Add this endpoint after other user management endpoints
  app.post("/api/users/:userId/reset-password", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { newPassword } = req.body;

      if (!newPassword) {
        return res.status(400).json({ message: "New password is required" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Hash the new password
      const hashedPassword = await hashPassword(newPassword);

      // Update the user's password
      await storage.updateUser(userId, { password: hashedPassword });

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });


  // Add new routes for user interactions
  app.post("/api/interactions", requireAuth, async (req, res) => {
    try {
      const interaction = insertUserInteractionSchema.parse({
        ...req.body,
        giverId: req.user!.id,
      });

      // Prevent self-interactions
      if (interaction.giverId === interaction.receiverId) {
        return res.status(400).json({ message: "Cannot interact with yourself" });
      }

      // Check for recent interactions
      const recentInteraction = await storage.getRecentInteraction(
        interaction.giverId,
        interaction.receiverId
      );

      if (recentInteraction) {
        return res.status(400).json({
          message: "You can only interact with a user once every 24 hours"
        });
      }

      // Create the interaction and update points
      const createdInteraction = await storage.createInteraction(interaction);

      res.status(201).json({
        interaction: createdInteraction,
        message: `Successfully ${interaction.type}d the user.`
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      console.error("Interaction error:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "An unexpected error occurred"
      });
    }
  });

  app.get("/api/users/:userId/interactions", requireAuth, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const interactions = await storage.getUserInteractions(userId);
      res.json(interactions);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Task management
  // Update the task submission endpoint to handle points
  app.post("/api/tasks/:taskId/submit", requireAuth, async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const task = await storage.getTaskById(taskId);

      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      const submissionData = insertSubmissionSchema.parse({
        ...req.body,
        taskId,
        userId: req.user!.id,
      });

      // Verify answer using AI with the task's goal
      const verification = await verifyAnswer(
        task.description,
        task.goal,
        submissionData.answer
      );

      // Create submission record
      const submission = await storage.createSubmission({
        ...submissionData,
        correct: verification.correct,
      });

      // Update task and user stats if correct
      if (verification.correct) {
        await storage.updateTask(taskId, {
          completed: true,
          completedBy: req.user!.id,
          completedByName: req.user!.username,
          attempts: task.attempts + 1,
          status: 'completed'
        });

        // Get today's completion status
        const today = new Date();
        const hasCompletedToday = await storage.checkDailyCompletion(req.user!.id, today);

        if (!hasCompletedToday) {
          // Record daily completion
          await storage.recordDailyCompletion(req.user!.id, today);

          // Get user's last streak date
          const user = await storage.getUser(req.user!.id);
          const lastStreakDate = user.lastStreak ? new Date(user.lastStreak) : null;

          let newStreak = 1; // Default to 1 for first completion

          if (lastStreakDate) {
            const daysSinceLastStreak = differenceInDays(today, lastStreakDate);

            // If completed yesterday, increment streak
            if (daysSinceLastStreak === 1) {
              newStreak = user.streak + 1;
            }
            // If more than 1 day has passed, reset streak to 1
          }

          // Update user's streak and points
          await storage.updateUser(req.user!.id, {
            points: req.user!.points + task.taskPoints,
            streak: newStreak,
            lastStreak: today,
          });
        } else {
          // Just update points if already completed a task today
          await storage.updateUser(req.user!.id, {
            points: req.user!.points + task.taskPoints,
          });
        }
      } else {
        await storage.updateTask(taskId, {
          attempts: task.attempts + 1,
        });
      }

      res.json({
        submission,
        verification,
      });
    } catch (error) {
      console.error('Task submission error:', error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to submit task"
      });
    }
  });


  app.post("/api/tasks", requireAdmin, async (req, res) => {
    const taskData = insertTaskSchema.parse(req.body);
    const task = await storage.createTask(taskData);
    res.status(201).json(task);
  });

  // Return tasks based on user role
  app.get("/api/tasks", requireAuth, async (req, res) => {
    const tasks = await storage.getAllTasks();
    res.json(tasks);
  });

  // Add user stats endpoint for leaderboard
  app.get("/api/users/stats", requireAuth, async (_req, res) => {
    const users = await storage.getAllUsers();
    // Only send necessary user data for leaderboard
    const stats = users.map(user => ({
      id: user.id,
      username: user.username,
      points: user.points,
      streak: user.streak
    }));
    res.json(stats);
  });

  // Add this endpoint after the existing /api/tasks endpoint
  app.get("/api/tasks/:taskId", requireAuth, async (req, res) => {
    const taskId = parseInt(req.params.taskId);
    if (isNaN(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }
    const task = await storage.getTaskById(taskId);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.json(task);
  });

  // Task deletion (admin only)
  app.delete("/api/tasks/:taskId", requireAdmin, async (req, res) => {
    const taskId = parseInt(req.params.taskId);
    await storage.deleteTask(taskId);
    res.sendStatus(200);
  });


  // Task generation endpoints
  app.post("/api/tasks/generate", requireAdmin, async (req, res) => {
    try {
      const params = insertTaskGenerationSchema.parse(req.body);
      const tasks = await generateTasks(params);

      // Store the generation in the database
      const generation = await storage.createTaskGeneration({
        ...params,
        generatedTasks: tasks,
      });

      res.json({ tasks, generationId: generation.id });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/tasks/approve", requireAdmin, async (req, res) => {
    try {
      const { tasks, generationId } = req.body;
      const userId = tasks[0]?.userId;

      // Get the username for task assignment
      const user = await storage.getUser(userId);
      if (!user) {
        throw new Error("User not found");
      }

      // Create all tasks with calculated due dates
      for (const task of tasks) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + task.dayNumber);
        dueDate.setHours(0, 0, 0, 0);

        await storage.createTask({
          ...task,
          userId: userId,
          dueDate: dueDate.toISOString().split('T')[0],
          completed: false,
          completedBy: null,
          completedByName: null,
          title: task.title,
          description: task.description,
          category: task.category,
          goal: task.goal || "Complete the assigned task successfully"
        });
      }

      // Mark the generation as approved
      await storage.approveTaskGeneration(generationId);

      res.json({ message: "Tasks approved and created successfully" });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Get today's tasks for the user
  app.get("/api/tasks/today", requireAuth, async (req, res) => {
    try {
      const tasks = await storage.getTodaysTasks(req.user!.id);
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Get future tasks for the user
  app.get("/api/tasks/future", requireAuth, async (req, res) => {
    try {
      const tasks = await storage.getFutureTasks(req.user!.id);
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Add this endpoint for past tasks
  app.get("/api/tasks/past", requireAuth, async (req, res) => {
    try {
      const tasks = await storage.getPastTasks(req.user!.id);
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Add endpoint to get submissions for a task
  app.get("/api/tasks/:taskId/submissions", requireAuth, async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      if (isNaN(taskId)) {
        return res.status(400).json({ message: "Invalid task ID" });
      }

      const task = await storage.getTaskById(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      const submissions = await storage.getSubmissions(taskId);

      // Sort by submission date, newest first
      submissions.sort((a, b) =>
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      );

      // Add information about whether the current user can edit each submission
      const enhancedSubmissions = submissions.map(submission => ({
        ...submission,
        canEdit: submission.userId === req.user!.id || req.user!.isAdmin
      }));

      res.json(enhancedSubmissions);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}