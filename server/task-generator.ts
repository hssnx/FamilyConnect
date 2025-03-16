import OpenAI from "openai";
import { InsertTaskGeneration } from "@shared/schema";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface GeneratedTask {
  title: string;
  description: string;
  category: string;
  goal: string;
  dayNumber: number;
}

export async function generateTasks(
  params: InsertTaskGeneration,
): Promise<GeneratedTask[]> {
  // Updated prompt: emphasizes concrete problem statements
  const prompt = `Generate ${params.numberOfSessions} learning sessions with ${params.problemsPerSession} tasks per session.
Learning goal: ${params.goal}

Schedule each session on a specific day:
${Array.from(
  { length: params.numberOfSessions || 3 },
  (_, i) => `Session ${i + 1}: Day ${(i + 1) * 10}`,
).join("\n")}

Return a JSON object with a 'tasks' array containing exactly ${
    (params.numberOfSessions || 3) * (params.problemsPerSession || 2)
  } tasks.
Each task in the array should have:
- title: A concise title for the task (max 100 characters)
- description: A detailed, concrete problem statement (max 500 characters). This must be an actual exercise or word problem the student can solve, not just an overview.
- category: The subject area (e.g., "Mathematics", "Programming")
- goal: A specific learning objective (max 200 characters), distinct from the prompt text
- dayNumber: The day number for this task's session (10, 20, or 30)

Example format:
{
  "tasks": [
    {
      "title": "Apply Chain Rule for Derivatives",
      "description": "Find the derivative of y = (3x + 2)^4 + e^(2x). Show full steps using the chain rule.",
      "category": "Mathematics",
      "goal": "Master advanced derivative techniques",
      "dayNumber": 10
    }
  ]
}

Important:
- Provide real, solvable problem statements in 'description'.
- Do NOT include extra text or disclaimers. Only return valid JSON with the 'tasks' array.
`;

  try {
    console.log("Generating tasks with OpenAI...");
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "You are an expert educational task planner. Always return your response as valid JSON with a 'tasks' array. Each task must contain a concrete, solvable problem statement in the 'description' field.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = response.choices[0].message.content;
    console.log("Raw OpenAI response:", content);

    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    let result: { tasks: GeneratedTask[] };
    try {
      result = JSON.parse(content);
    } catch (error) {
      console.error("JSON Parse Error:", error);
      console.error("Malformed content:", content);
      throw new Error(
        `Invalid JSON response from OpenAI: ${(error as Error).message}`,
      );
    }

    if (!result || !Array.isArray(result.tasks)) {
      console.error("Invalid response structure:", result);
      throw new Error("Invalid response format: missing tasks array");
    }

    // Validate each task
    const validatedTasks = result.tasks.map((task, index) => {
      if (
        !task.title ||
        !task.description ||
        !task.category ||
        !task.goal ||
        typeof task.dayNumber !== "number"
      ) {
        console.error(`Invalid task at index ${index}:`, task);
        throw new Error(`Task at index ${index} is missing required fields`);
      }
      return task;
    });

    // Sort tasks by day number
    validatedTasks.sort((a, b) => a.dayNumber - b.dayNumber);

    return validatedTasks;
  } catch (error) {
    console.error("Task generation error:", error);
    throw new Error(`Failed to generate tasks: ${(error as Error).message}`);
  }
}
