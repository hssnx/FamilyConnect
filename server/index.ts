import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { openai } from "./openai";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Verify OpenAI API key before starting server
async function verifyOpenAIKey() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    // Create a timeout promise
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("OpenAI API verification timed out")), 5000);
    });

    // Make a minimal API call to verify the key
    const verifyCall = openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: "test" }],
      max_tokens: 1, // Minimal tokens for faster response
    });

    // Race between the API call and timeout
    await Promise.race([verifyCall, timeout]);
    log("OpenAI API key verified successfully");
  } catch (error) {
    // Log the error but don't prevent server startup
    log(`OpenAI API key verification warning: ${(error as Error).message}`, "warn");
    log("Server will continue starting up, but OpenAI features may not work correctly", "warn");
  }
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  log(`Unhandled Rejection at: ${promise}\nReason: ${reason}`, "error");
});

process.on('uncaughtException', (error) => {
  log(`Uncaught Exception: ${error.message}\n${error.stack}`, "error");
  process.exit(1);
});

(async () => {
  try {
    // Verify OpenAI API key before starting
    await verifyOpenAIKey();

    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      log(`Error: ${message}\n${err.stack}`, "error");
      res.status(status).json({ message });
    });

    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    const port = 5000;
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`Server started successfully on port ${port}`);
    });
  } catch (error) {
    log(`Failed to start server: ${(error as Error).message}\n${(error as Error).stack}`, "error");
    process.exit(1);
  }
})();