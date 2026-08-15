import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import { WebSocketServer } from "ws";

import DeepgramService from "./services/deepgramService.js";
import GeminiService from "./services/geminiService.js";
import ElevenLabsService from "./services/elevenLabsServices.js";

dotenv.config();

const app = express();

const port = process.env.PORT || 3000;

app.use(cors());

app.use(express.json());

const server = http.createServer(app);

const wss = new WebSocketServer({
  server,
});

wss.on("connection", (ws) => {
  console.log("client connected");

  let deepgramService = null;

  let geminiService = null;

  let elevenLabsService = null;

  let callStarted = false;

  let isRecording = false;

  /*
   * CONNECTED
   */
  ws.send(
    JSON.stringify({
      type: "connected",
      message: "websocket connection established",
    }),
  );

  /*
   * CLIENT MESSAGE
   */
  ws.on("message", async (message, isBinary) => {
    /*
     * AUDIO
     */
    if (isBinary) {
      if (!isRecording) {
        return;
      }

      if (!deepgramService) {
        console.log("❌ Deepgram service does not exist");

        return;
      }

      if (!deepgramService.isConnected) {
        console.log("❌ Deepgram is not connected");

        return;
      }

      console.log("🎵 Audio received:", message.length, "bytes");

      deepgramService.sendAudio(message);

      return;
    }

    /*
     * JSON
     */
    try {
      const data = JSON.parse(message.toString());

      console.log("Message from client:", data);

      /*
       * START CALL
       */
      if (data.type === "start_call") {
        console.log("📞 Call started");

        /*
         * IMPORTANT:
         * Set this BEFORE anything else.
         */
        callStarted = true;

        isRecording = false;

        /*
         * ELEVENLABS
         */
        elevenLabsService = new ElevenLabsService(ws);

        try {
          /*
           * WAIT for ElevenLabs
           * to actually connect.
           */
          await elevenLabsService.connect();

          console.log("🔊 ElevenLabs ready");
        } catch (error) {
          console.error("❌ ElevenLabs connection failed:", error);

          callStarted = false;

          return;
        }

        /*
         * GEMINI
         */
        geminiService = new GeminiService(ws, elevenLabsService);

        /*
         * DEEPGRAM
         */
        deepgramService = new DeepgramService(ws, async (finalTranscript) => {
          if (!geminiService) {
            return;
          }

          /*
           * User finished speaking.
           */
          isRecording = false;

          console.log("🤖 Sending transcript to Gemini...");

          await geminiService.generateResponse(finalTranscript);
        });

        deepgramService.connect();

        /*
         * WELCOME MESSAGE
         */
        const welcomeMessage =
          "Hi, I'm Niva. I'll ask you a few simple questions about how you're feeling. There are no right or wrong answers. To start, could you tell me what health concern or symptom is bothering you the most right now?";

        /*
         * Send text to frontend
         */
        ws.send(
          JSON.stringify({
            type: "ai_response",
            text: welcomeMessage,
          }),
        );

        /*
         * Speak ONLY after ElevenLabs
         * is confirmed connected.
         */
        elevenLabsService.speak(welcomeMessage);

        return;
      }

      /*
       * START RECORDING
       */
      if (data.type === "start_recording") {
        if (!callStarted) {
          console.log("❌ Call has not started");

          return;
        }

        if (!deepgramService || !deepgramService.isConnected) {
          console.log("❌ Deepgram is not connected");

          return;
        }

        /*
         * Prevent duplicate starts.
         */
        if (isRecording) {
          console.log("⚠️ Already recording");

          return;
        }

        console.log("🎙️ Recording started");

        isRecording = true;

        return;
      }

      /*
       * STOP RECORDING
       */
      if (data.type === "stop_recording") {
        console.log("⏹️ Recording stopped");

        isRecording = false;

        if (deepgramService) {
          deepgramService.finalize();
        }

        return;
      }

      /*
       * END CALL
       */
      if (data.type === "end_call") {
        console.log("📞 Call ended");

        callStarted = false;

        isRecording = false;

        /*
         * Deepgram
         */
        if (deepgramService) {
          deepgramService.close();

          deepgramService = null;
        }

        /*
         * ElevenLabs
         */
        if (elevenLabsService) {
          elevenLabsService.close();

          elevenLabsService = null;
        }

        /*
         * Gemini
         */
        if (geminiService) {
          geminiService = null;
        }

        return;
      }
    } catch (error) {
      console.error("❌ Message processing error:", error);
    }
  });

  /*
   * CLIENT DISCONNECTED
   */
  ws.on("close", () => {
    console.log("client disconnected");

    callStarted = false;

    isRecording = false;

    if (deepgramService) {
      deepgramService.close();

      deepgramService = null;
    }

    if (geminiService) {
      if (typeof geminiService.reset === "function") {
        geminiService.reset();
      }

      geminiService = null;
    }

    if (elevenLabsService) {
      elevenLabsService.close();

      elevenLabsService = null;
    }
  });

  /*
   * WEBSOCKET ERROR
   */
  ws.on("error", (error) => {
    console.error("❌ WebSocket error:", error);
  });
});

server.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);

  console.log(`🔌 WebSocket running on port ${port}`);
});
