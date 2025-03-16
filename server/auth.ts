import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${derivedKey.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  try {
    const [hashedPassword, salt] = stored.split(".");
    if (!hashedPassword || !salt) {
      return false;
    }
    const hashedBuf = Buffer.from(hashedPassword, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error("Password comparison error:", error);
    return false;
  }
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "default_secret_key_change_in_production",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log("Login attempt:", username);
        const user = await storage.getUserByUsername(username);
        console.log("User found:", user ? "yes" : "no");

        if (!user) {
          return done(null, false);
        }

        const isValid = await comparePasswords(password, user.password);
        if (!isValid) {
          return done(null, false);
        }

        return done(null, user);
      } catch (err) {
        console.error("Login error:", err);
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Create initial admin only if no users exist
  async function createInitialAdmin() {
    try {
      console.log("Checking for existing users...");
      const existingUsers = await storage.getAllUsers();

      if (existingUsers.length === 0) {
        console.log("No users found, creating initial admin...");
        const hashedPassword = await hashPassword("admin");
        console.log("Password hashed successfully");

        const adminUser = {
          username: "admin",
          password: hashedPassword,
          isAdmin: true,
          email: "admin@example.com",
        };

        await storage.createUser(adminUser);
        console.log("Initial admin user created successfully");
      } else {
        console.log("Users already exist, skipping admin creation");
      }
    } catch (error) {
      console.error("Error creating initial admin:", error);
    }
  }

  // Create initial admin on setup
  createInitialAdmin();

  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).send("Username already exists");
      }

      // Get all users to check if this is the first user
      const allUsers = await storage.getAllUsers();
      const isFirstUser = allUsers.length === 0;

      // Only allow account creation by admins (except for first user)
      if (!isFirstUser && (!req.isAuthenticated() || !req.user?.isAdmin)) {
        return res.status(403).send("Only administrators can create new accounts");
      }

      const hashedPassword = await hashPassword(req.body.password);
      const userData = {
        ...req.body,
        isAdmin: isFirstUser ? true : Boolean(req.body.isAdmin),
        password: hashedPassword,
      };

      const user = await storage.createUser(userData);

      // Only log in automatically if this is the first user
      if (isFirstUser) {
        req.login(user, (err) => {
          if (err) return next(err);
          res.status(201).json(user);
        });
      } else {
        res.status(201).json(user);
      }
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.status(200).json(req.user);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}