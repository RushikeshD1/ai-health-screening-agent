import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import { WebSocketServer } from "ws";

import DeepgramService from "./services/DeepgramService.js";
import GeminiService from "./services/GeminiService.js";

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

  let callStarted = false;
  let isRecording = false;

  ws.send(
    JSON.stringify({
      type: "connected",
      message: "websocket connection established",
    }),
  );

  ws.on("message", async (message, isBinary) => {
    /*
     * AUDIO
     */
    if (isBinary) {
      if (!isRecording) {
        return;
      }

      if (!deepgramService) {
        console.log(
          "❌ Deepgram service does not exist",
        );
        return;
      }

      if (!deepgramService.isConnected) {
        console.log(
          "❌ Deepgram is not connected",
        );
        return;
      }

      console.log(
        "Audio received:",
        message.length,
        "bytes",
      );

      deepgramService.sendAudio(message);

      return;
    }

    /*
     * JSON MESSAGE
     */
    try {
      const data = JSON.parse(
        message.toString(),
      );

      console.log(
        "Message from client:",
        data,
      );

      /*
       * START CALL
       */
      if (data.type === "start_call") {
        console.log("📞 Call started");

        callStarted = true;
        isRecording = false;

        /*
         * Create Gemini service
         */
        geminiService = new GeminiService(ws);

        /*
         * Create Deepgram service
         */
        deepgramService = new DeepgramService(
          ws,
          async (finalTranscript) => {
            console.log(
              "📝 Final user transcript:",
              finalTranscript,
            );

            if (!geminiService) {
              console.log(
                "❌ Gemini service does not exist",
              );

              return;
            }

            await geminiService.generateResponse(
              finalTranscript,
            );
          },
        );

        /*
         * Connect Deepgram
         */
        deepgramService.connect();

        /*
         * Start Gemini conversation
         */
        await geminiService.startConversation();

        return;
      }

      /*
       * START RECORDING
       */
      if (data.type === "start_recording") {
        if (!callStarted) {
          console.log(
            "❌ Call has not started",
          );

          return;
        }

        if (
          !deepgramService ||
          !deepgramService.isConnected
        ) {
          console.log(
            "❌ Deepgram is not connected",
          );

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
        console.log(
          "⏹️ Recording stopped",
        );

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

        if (deepgramService) {
          deepgramService.close();
          deepgramService = null;
        }

        if (geminiService) {
          geminiService.reset();
          geminiService = null;
        }

        return;
      }

    } catch (error) {
      console.error(
        "❌ Message processing error:",
        error,
      );
    }
  });

  /*
   * CLIENT DISCONNECTED
   */
  ws.on("close", () => {
    console.log(
      "client disconnected",
    );

    callStarted = false;
    isRecording = false;

    if (deepgramService) {
      deepgramService.close();
      deepgramService = null;
    }

    if (geminiService) {
      geminiService.reset();
      geminiService = null;
    }
  });

  ws.on("error", (error) => {
    console.error(
      "❌ WebSocket error:",
      error,
    );
  });
});

server.listen(port, () => {
  console.log(
    `🚀 Server running on port ${port}`,
  );

  console.log(
    `🔌 WebSocket running on port ${port}`,
  );
});

