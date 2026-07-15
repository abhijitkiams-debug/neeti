import Anthropic from "@anthropic-ai/sdk";

/**
 * Pluggable AI adapter, same pattern as lib/notify.ts — every caller checks
 * isAiConfigured() first and degrades gracefully (a clear message, not a
 * crash) when ANTHROPIC_API_KEY isn't set, since this is a dev sandbox
 * without real credentials wired up.
 */
export function isAiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export type GeneratedQuestion = {
  questionText: string;
  explanation: string;
  options: { text: string; isCorrect: boolean }[];
};

const QUIZ_TOOL: Anthropic.Tool = {
  name: "record_quiz_questions",
  description: "Record a set of multiple-choice micro-quiz questions generated from a policy document.",
  input_schema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        description: "3 to 5 multiple-choice questions testing comprehension of the policy content.",
        items: {
          type: "object",
          properties: {
            questionText: { type: "string", description: "The question, referring to specific policy requirements." },
            explanation: { type: "string", description: "1-2 sentence explanation shown after the employee answers, citing why the correct option is right." },
            options: {
              type: "array",
              description: "Exactly 4 answer options, in a randomized order, with exactly one marked correct.",
              items: {
                type: "object",
                properties: {
                  text: { type: "string" },
                  isCorrect: { type: "boolean" },
                },
                required: ["text", "isCorrect"],
              },
              minItems: 4,
              maxItems: 4,
            },
          },
          required: ["questionText", "explanation", "options"],
        },
      },
    },
    required: ["questions"],
  },
};

/**
 * Generates micro-quiz questions from a policy's rendered content via the
 * Claude API. Uses a forced tool call so the response is always the typed
 * shape below rather than free-form text that needs re-parsing.
 */
export async function generateQuizQuestions(params: { title: string; contentHtml: string }): Promise<GeneratedQuestion[]> {
  if (!isAiConfigured()) {
    throw new Error("ANTHROPIC_API_KEY is not configured — AI quiz generation is unavailable in this environment.");
  }

  const plainText = stripHtml(params.contentHtml).slice(0, 12000);
  if (plainText.length < 40) {
    throw new Error("This policy has too little content to generate quiz questions from — write the policy body first.");
  }

  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    system:
      "You write compliance micro-quiz questions for corporate policy documents. Questions must be answerable strictly from the provided text, unambiguous, and test practical understanding rather than trivia. Always call the record_quiz_questions tool with your output.",
    tools: [QUIZ_TOOL],
    tool_choice: { type: "tool", name: "record_quiz_questions" },
    messages: [
      {
        role: "user",
        content: `Policy title: ${params.title}\n\nPolicy content:\n${plainText}\n\nGenerate 4 multiple-choice micro-quiz questions for employees who just read this policy.`,
      },
    ],
  });

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) {
    throw new Error("The AI did not return structured quiz questions — try again.");
  }

  const input = toolUse.input as { questions?: GeneratedQuestion[] };
  const questions = input.questions ?? [];
  return questions.filter((q) => q.questionText && q.options?.some((o) => o.isCorrect) && q.options.length >= 2);
}

/**
 * Translates a policy version's HTML into the target language via the
 * Claude API, preserving tag structure so the WYSIWYG editor and the
 * consumption portal can render it exactly like the original. Plain text
 * completion rather than a tool call — the "structure" we need back is the
 * HTML itself, not a JSON shape.
 */
export async function translatePolicyContent(params: { contentHtml: string; targetLanguageName: string }): Promise<string> {
  if (!isAiConfigured()) {
    throw new Error("ANTHROPIC_API_KEY is not configured — AI translation is unavailable in this environment.");
  }
  if (stripHtml(params.contentHtml).trim().length < 10) {
    throw new Error("This policy has too little content to translate — write the policy body first.");
  }

  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 8192,
    system:
      `You translate corporate policy documents into ${params.targetLanguageName} for compliance purposes. ` +
      "You will be given an HTML fragment. Translate only the human-readable text content into the target " +
      "language; leave every HTML tag, attribute, and attribute value exactly as-is. Preserve the exact tag " +
      "structure and nesting. Do not add, remove, or reorder elements. Respond with only the translated HTML " +
      "fragment — no commentary, no markdown code fences, no explanation.",
    messages: [{ role: "user", content: params.contentHtml }],
  });

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock || !textBlock.text.trim()) {
    throw new Error("The AI did not return a translation — try again.");
  }
  return textBlock.text.trim().replace(/^```(?:html)?\n?/, "").replace(/\n?```$/, "");
}
