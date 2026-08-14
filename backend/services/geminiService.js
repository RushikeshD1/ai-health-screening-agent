import { GoogleGenAI } from "@google/genai";

class GeminiService {
  constructor(clientSocket) {
    this.clientSocket = clientSocket;

    this.ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    this.conversation = [];
    this.questionCount = 0;
    this.maxQuestions = 6;
    this.minQuestions = 4;

    this.isCompleted = false;
  }

  async startConversation() {
    try {
      this.conversation = [];
      this.questionCount = 0;
      this.isCompleted = false;

      const firstQuestion =
        "Hi, I'm Niva. I'll ask you a few simple questions about how you're feeling. There are no right or wrong answers. To start, could you tell me what health concern or symptom is bothering you the most right now?";

      this.conversation.push({
        role: "assistant",
        content: firstQuestion,
      });

      this.sendToClient({
        type: "ai_response",
        text: firstQuestion,
      });

      return firstQuestion;
    } catch (error) {
      console.error("❌ Failed to start conversation:", error);

      this.sendToClient({
        type: "ai_error",
        message: "Sorry, I couldn't start the health conversation.",
      });
    }
  }

  async generateResponse(userText) {
    try {
      if (!userText || !userText.trim()) {
        return;
      }

      console.log("🤖 User:", userText);

      // Store user response
      this.conversation.push({
        role: "user",
        content: userText.trim(),
      });

      /*
       * Ask Gemini whether we have enough information.
       */
      const prompt = `
You are Niva, a friendly AI health screening assistant.

Your job is to have a short, friendly health screening conversation.

IMPORTANT RULES:

1. Ask simple basic health questions only.
2. Do NOT diagnose the user.
3. Do NOT prescribe medicines.
4. Do NOT give dangerous medical advice.
5. Ask ONE question at a time.
6. Usually ask between 4 and 6 questions.
7. Keep questions natural and conversational.
8. Use information from previous answers.
9. Do not repeatedly ask the same question.
10. If you already have enough information after 4 questions, you may finish.
11. You MUST finish by question 6 at the latest.
12. Ask about things such as:
   - main symptom/problem
   - when it started
   - severity
   - other related symptoms
   - things that make it better/worse
   - relevant basic context
13. Avoid asking unnecessary personal questions.
14. If the user mentions an emergency or severe alarming symptoms, prioritize telling them to seek urgent professional medical care rather than continuing the screening.

Current question number: ${this.questionCount + 1}

Conversation so far:

${this.conversation
  .map(
    (message) =>
      `${message.role.toUpperCase()}: ${message.content}`,
  )
  .join("\n")}

Decide what to do next.

Return ONLY valid JSON in this exact format:

{
  "finished": false,
  "response": "Your next friendly question"
}

OR, when enough information has been collected:

{
  "finished": true,
  "response": "A short friendly closing message"
}

Do not use markdown.
`;

      const response = await this.ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
      });

      const rawText = response.text?.trim();

      if (!rawText) {
        throw new Error("Gemini returned an empty response");
      }

      console.log("🤖 Gemini raw:", rawText);

      const cleaned = rawText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      let result;

      try {
        result = JSON.parse(cleaned);
      } catch (error) {
        console.error("❌ Gemini JSON parse error:", error);

        // Fallback
        result = {
          finished: this.questionCount >= this.maxQuestions,
          response: rawText,
        };
      }

      /*
       * Increase question count after receiving user answer.
       */
      this.questionCount++;

      /*
       * Force completion at 6 questions.
       */
      if (this.questionCount >= this.maxQuestions) {
        result.finished = true;
      }

      /*
       * If conversation is not finished,
       * send next question.
       */
      if (!result.finished) {
        const nextQuestion = result.response?.trim();

        if (!nextQuestion) {
          throw new Error("Gemini returned an empty question");
        }

        this.conversation.push({
          role: "assistant",
          content: nextQuestion,
        });

        console.log(
          `🤖 Question ${this.questionCount + 1}:`,
          nextQuestion,
        );

        this.sendToClient({
          type: "ai_response",
          text: nextQuestion,
        });

        return;
      }

      /*
       * Conversation finished.
       */
      console.log("✅ Health screening completed");

      this.isCompleted = true;

      await this.generateHealthReport();

    } catch (error) {
      console.error("❌ Gemini error:", error);

      this.sendToClient({
        type: "ai_error",
        message: "Sorry, I couldn't generate a response.",
      });
    }
  }

  async generateHealthReport() {
    try {
      console.log("📋 Generating final health report...");

      const reportPrompt = `
You are Niva, a friendly health screening assistant.

Create a simple final health screening report based ONLY on the conversation below.

IMPORTANT:

- Do NOT diagnose a disease.
- Do NOT claim certainty.
- Do NOT prescribe medication.
- Do NOT invent symptoms.
- Clearly distinguish what the user reported from possible general considerations.
- Recommend seeing a qualified healthcare professional when appropriate.
- If the user mentioned potentially urgent symptoms, clearly recommend urgent medical attention.
- Keep the report easy to understand.

The report should contain:

1. Summary
2. Main concern
3. Symptoms mentioned
4. What may be worth paying attention to
5. What the client can do next
6. When to seek professional medical help

Conversation:

${this.conversation
  .map(
    (message) =>
      `${message.role.toUpperCase()}: ${message.content}`,
  )
  .join("\n")}

Return the report as normal readable text.
Do not use JSON.
`;

      const response = await this.ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: reportPrompt,
      });

      const report = response.text?.trim();

      if (!report) {
        throw new Error("Gemini returned an empty health report");
      }

      console.log("📋 Final health report:");
      console.log(report);

      /*
       * Tell the user the conversation is complete.
       */
      const closingMessage =
        "Thank you for sharing that with me. This is your final health screening report, and I'll share it with you now. Feel free to ask Niva anything at any time.";

      this.sendToClient({
        type: "ai_response",
        text: closingMessage,
      });

      /*
       * Send final report separately.
       */
      this.sendToClient({
        type: "health_report",
        report,
      });

    } catch (error) {
      console.error("❌ Health report error:", error);

      this.sendToClient({
        type: "ai_error",
        message: "Sorry, I couldn't generate your health report.",
      });
    }
  }

  sendToClient(data) {
    if (
      this.clientSocket &&
      this.clientSocket.readyState === 1
    ) {
      this.clientSocket.send(
        JSON.stringify(data),
      );
    }
  }

  reset() {
    this.conversation = [];
    this.questionCount = 0;
    this.isCompleted = false;
  }
}

export default GeminiService;
