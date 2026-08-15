import { GoogleGenAI } from "@google/genai";

class GeminiService {
  constructor(clientSocket, elevenLabsService) {
    this.clientSocket = clientSocket;
    this.elevenLabsService = elevenLabsService;

    this.ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    // Store conversation for this call
    this.conversation = [];

    // Number of questions Niva has asked
    this.questionCount = 0;

    // Maximum questions — enforced in code below, not just in the
    // prompt, so the model can't wander past this on its own.
    this.maxQuestions = 3;

    // Minimum questions before we allow an early finish
    this.minQuestions = 2;

    // Screening completed
    this.screeningCompleted = false;
  }

  /*
   * Detect whether an error from the Gemini API is a quota /
   * rate-limit error (free tier exhausted) vs some other failure,
   * so the frontend can show a specific "out of free tokens"
   * message instead of a generic error.
   */
  isQuotaError(error) {
    const status = error?.status || error?.code;

    const message = (error?.message || "").toLowerCase();

    return (
      status === 429 ||
      message.includes("resource_exhausted") ||
      message.includes("quota") ||
      message.includes("rate limit")
    );
  }

  async generateResponse(userText) {
    try {
      if (!userText || !userText.trim()) {
        return null;
      }

      console.log("🤖 User:", userText);

      // Add user's answer to conversation
      this.conversation.push({
        role: "user",
        text: userText.trim(),
      });

      // If screening is already completed, don't ask more questions
      if (this.screeningCompleted) {
        console.log("⚠️ Screening already completed");
        return null;
      }

      /*
       * HARD CAP: if we've already asked the max number of
       * questions, don't even ask the model — go straight to the
       * report. This guarantees the call never asks more than
       * `maxQuestions`, regardless of what the model decides.
       */
      if (this.questionCount >= this.maxQuestions) {
        console.log(
          "✅ Max questions reached (",
          this.maxQuestions,
          "), finishing screening"
        );

        this.screeningCompleted = true;

        await this.generateHealthReport();

        return "SCREENING_COMPLETE";
      }

      const conversationText = this.conversation
        .map((message) => {
          return `${message.role === "user" ? "User" : "Niva"}: ${
            message.text
          }`;
        })
        .join("\n");

      const prompt = `
You are Niva, a friendly AI voice assistant conducting a basic health screening.

Your job is to ask the user ${this.minQuestions} to ${this.maxQuestions} simple health-related questions.

IMPORTANT RULES:

1. Ask ONLY ONE question at a time.
2. Keep every response short and natural because it will be spoken aloud.
3. Do not ask multiple questions in one response.
4. Use the user's previous answers to decide the next question.
5. Ask a maximum of ${this.maxQuestions} questions in total. This is a hard limit — do not go past it.
6. You may finish earlier than ${this.maxQuestions} once you have asked at least ${this.minQuestions} questions and have enough information.
7. Do not diagnose the user.
8. Do not give a long medical explanation.
9. When enough information has been collected (or you have reached ${this.maxQuestions} questions), respond with exactly:
SCREENING_COMPLETE

Current conversation:

${conversationText}

Niva has currently asked ${this.questionCount} questions out of a maximum of ${this.maxQuestions}.

Decide what to do next.

If another question is needed and the limit has not been reached:
- Ask exactly ONE simple question.

If enough information has been collected, or the question limit has been reached:
- Respond ONLY with SCREENING_COMPLETE.
`;

      const response = await this.ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: prompt,
      });

      const text = response.text?.trim();

      if (!text) {
        throw new Error("Gemini returned an empty response");
      }

      console.log("🤖 Gemini response:", text);

      if (text === "SCREENING_COMPLETE") {
        console.log(
          "✅ Screening completed after",
          this.questionCount,
          "questions",
        );

        this.screeningCompleted = true;

        await this.generateHealthReport();

        return "SCREENING_COMPLETE";
      }

      this.questionCount++;

      console.log(`❓ Question ${this.questionCount}:`, text);

      // Store Niva's response
      this.conversation.push({
        role: "assistant",
        text,
      });

      // Send text to frontend
      this.sendToClient({
        type: "ai_response",
        text,
      });

      // Speak using ElevenLabs
      if (this.elevenLabsService) {
        await this.elevenLabsService.speak(text);
      }

      return text;
    } catch (error) {
      console.error("❌ Gemini error:", error);

      if (this.isQuotaError(error)) {
        console.log("⚠️ Gemini quota/rate limit hit");

        this.sendToClient({
          type: "quota_exceeded",
          message:
            "We've run out of free AI usage for now. Please try again later.",
        });

        return null;
      }

      this.sendToClient({
        type: "ai_error",
        message: "Sorry, I couldn't generate a response.",
      });

      return null;
    }
  }

  async generateHealthReport() {
    try {
      console.log("📋 Generating final health report...");

      const conversationText = this.conversation
        .map((message) => {
          return `${message.role === "user" ? "User" : "Niva"}: ${
            message.text
          }`;
        })
        .join("\n");

      const reportPrompt = `
You are generating a basic health screening summary.

Review the conversation below.

${conversationText}

Create a simple informational screening report.

Return ONLY valid JSON.

Use exactly this structure:

{
  "summary": "Short summary of what the user reported",
  "possibleConcerns": [
    "Possible concern 1"
  ],
  "cautions": [
    "Caution or precaution the user should take, based only on what they described"
  ],
  "recommendations": [
    "Recommendation 1",
    "Recommendation 2"
  ],
  "whenToSeekHelp": "When the user should consider professional medical help"
}

For "cautions", list 1 to 3 general precautions relevant to what the user
described (e.g. things to avoid, warning signs to watch for, general safety
notes). Keep each one short and practical, and speak generally rather than
prescribing specific treatment.

IMPORTANT:

- Do NOT diagnose the user.
- Do NOT claim certainty.
- Base the report only on what the user said.
- Keep it concise.
`;

      const response = await this.ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: reportPrompt,
      });

      let text = response.text?.trim();

      if (!text) {
        throw new Error("Gemini returned empty health report");
      }

      // Remove markdown code fences if Gemini adds them
      text = text
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      let report;

      try {
        report = JSON.parse(text);
      } catch (error) {
        console.error("❌ Failed to parse health report JSON:", text);

        throw new Error("Invalid health report JSON");
      }

      console.log("📋 Health report generated:", report);

      // Speak a short closing summary before showing the written report,
      // so the call doesn't just end abruptly after the last question.
      const closingText = this.buildClosingMessage(report);

      console.log("🗣️ Closing message:", closingText);

      this.sendToClient({
        type: "ai_response",
        text: closingText,
      });

      if (this.elevenLabsService) {
        await this.elevenLabsService.speak(closingText);
      }

      this.sendToClient({
        type: "health_report",
        report,
      });

      this.sendToClient({
        type: "screening_completed",
      });

      return report;
    } catch (error) {
      console.error("❌ Health report error:", error);

      if (this.isQuotaError(error)) {
        console.log("⚠️ Gemini quota/rate limit hit during report");

        this.sendToClient({
          type: "quota_exceeded",
          message:
            "We've run out of free AI usage for now, so the report couldn't be generated. Please try again later.",
        });

        return null;
      }

      this.sendToClient({
        type: "ai_error",
        message: "Unable to generate the health report.",
      });

      return null;
    }
  }

  /*
   * Build a short, natural closing line to be SPOKEN after the
   * screening finishes — separate from the written report shown
   * on screen. Keeps it to 1-2 sentences since it's read aloud.
   */
  buildClosingMessage(report) {
    const parts = [
      "Thanks, I've got everything I need for now.",
    ];

    if (report.cautions && report.cautions.length > 0) {
      parts.push(report.cautions[0]);
    } else if (
      report.recommendations &&
      report.recommendations.length > 0
    ) {
      parts.push(report.recommendations[0]);
    }

    parts.push(
      "If things get worse or you have any concerns, feel free to start a new call anytime."
    );

    return parts.join(" ");
  }

  async startScreening() {
    try {
      this.conversation = [];
      this.questionCount = 0;
      this.screeningCompleted = false;

      const firstQuestion =
        "Hi, I'm Niva. I'll ask you a few simple questions about how you're feeling. There are no right or wrong answers. To start, could you tell me what health concern or symptom is bothering you the most right now?";

      this.questionCount++;

      this.conversation.push({
        role: "assistant",
        text: firstQuestion,
      });

      console.log("❓ Question 1:", firstQuestion);

      this.sendToClient({
        type: "ai_response",
        text: firstQuestion,
      });

      if (this.elevenLabsService) {
        await this.elevenLabsService.speak(firstQuestion);
      }

      return firstQuestion;
    } catch (error) {
      console.error("❌ Start screening error:", error);

      return null;
    }
  }

  reset() {
    console.log("🔄 Resetting Gemini screening");

    this.conversation = [];
    this.questionCount = 0;
    this.screeningCompleted = false;
  }

  sendToClient(data) {
    if (this.clientSocket && this.clientSocket.readyState === 1) {
      try {
        this.clientSocket.send(JSON.stringify(data));
      } catch (error) {
        console.error("❌ Failed to send Gemini message:", error);
      }
    }
  }
}

export default GeminiService;