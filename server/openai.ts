import OpenAI from "openai";

// The newest OpenAI model is "gpt-4o" which was released May 13, 2024.
// Do not change this unless explicitly requested.
export const openai = new OpenAI();

interface VerificationResult {
  correct: boolean;
  explanation: string;
  confidence: number;
  hint?: string;
}

interface InteractionApproval {
  approved: boolean;
  message: string;
}

export async function verifyAnswer(
  question: string,
  goal: string,
  userAnswer: string,
): Promise<VerificationResult> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an encouraging educational mentor. Your goal is to help students learn through guided discovery.

Key Guidelines:
- Never give away answers.
- Focus on the learning process.
- If the answer is incorrect, provide a subtle hint (2% of the solution).
- Validate their thought process.
- Be encouraging and supportive.

IMPORTANT: Respond ONLY with valid JSON (and no additional text), following exactly this format:
{
  "correct": boolean,
  "explanation": string,
  "confidence": number,
  "hint": string|null
}
Ensure that any quotes in your output are properly escaped.`,
        },
        {
          role: "user",
          content: `Learning Goal: ${goal}
Question: ${question}
Student's Response: ${userAnswer}

Evaluate their understanding and provide guidance.`,
        },
      ],
      max_tokens: 150,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    let result: any;
    try {
      result = JSON.parse(content || "{}");
    } catch (e) {
      throw new Error("Failed to parse AI response as JSON");
    }

    if (
      typeof result.correct !== "boolean" ||
      typeof result.explanation !== "string" ||
      typeof result.confidence !== "number"
    ) {
      throw new Error(
        "AI response missing required fields or fields are of the wrong type",
      );
    }

    return {
      correct: result.correct,
      explanation: result.explanation,
      confidence: Math.max(0, Math.min(1, result.confidence)),
      hint: result.hint || undefined,
    };
  } catch (error) {
    throw new Error("Failed to verify answer: " + (error as Error).message);
  }
}

export async function verifyInteraction(
  type: "like" | "dislike",
  reason: string,
): Promise<InteractionApproval> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a fair moderator for a family task management platform.
Evaluate the interaction request and respond ONLY with valid JSON in the exact format below, with no additional text or whitespace:
{
  "approved": boolean,
  "message": string,
  "type": "like" | "dislike"
}
Make sure the "type" field is present and exactly either "like" or "dislike".`,
        },
        {
          role: "user",
          content: `Evaluate a "${type}" interaction with reason: "${reason}"`,
        },
      ],
      max_tokens: 150,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    let result: any;
    try {
      result = JSON.parse(content || "{}");
    } catch (error) {
      throw new Error("Invalid JSON response from AI");
    }

    if (typeof result !== "object" || result === null) {
      throw new Error("AI response is not a valid JSON object");
    }
    if (typeof result.approved !== "boolean") {
      throw new Error("Invalid response: 'approved' must be a boolean");
    }
    if (typeof result.message !== "string" || !result.message.trim()) {
      throw new Error("Invalid response: 'message' must be a non-empty string");
    }
    if (result.type !== "like" && result.type !== "dislike") {
      throw new Error(
        `Invalid response: 'type' must be either 'like' or 'dislike', received ${result.type}`,
      );
    }
    if (result.approved && result.type !== type) {
      throw new Error(
        `Type mismatch: AI returned ${result.type} but expected ${type}`,
      );
    }

    return {
      approved: result.approved,
      message: result.message,
    };
  } catch (error) {
    console.error("Interaction verification error:", error);
    throw new Error(
      "Failed to verify interaction. Please try again with a more specific reason.",
    );
  }
}