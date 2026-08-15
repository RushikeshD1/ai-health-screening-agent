import WebSocket from "ws";

class ElevenLabsService {
  constructor(clientSocket) {
    this.clientSocket = clientSocket;

    this.socket = null;

    this.isConnected = false;

    this.connectPromise = null;
  }

  /*
   * CONNECT TO ELEVENLABS
   */
  connect() {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    const voiceId = process.env.ELEVENLABS_VOICE_ID;

    if (!apiKey) {
      console.error("❌ ElevenLabs API key missing");

      return Promise.reject(new Error("ElevenLabs API key missing"));
    }

    if (!voiceId) {
      console.error("❌ ElevenLabs voice ID missing");

      return Promise.reject(new Error("ElevenLabs voice ID missing"));
    }

    if (
      this.isConnected &&
      this.socket &&
      this.socket.readyState === WebSocket.OPEN
    ) {
      return Promise.resolve();
    }

    this.connectPromise = new Promise((resolve, reject) => {
      const url =
        `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input` +
        `?model_id=eleven_flash_v2_5` +
        `&output_format=mp3_44100_128` +
        // Keep the socket alive up to 3 minutes between messages so it
        // doesn't silently close while the user is talking / STT is
        // transcribing between AI turns.
        `&inactivity_timeout=180`;

      console.log("🔊 Connecting to ElevenLabs...");

      this.socket = new WebSocket(url, {
        headers: {
          "xi-api-key": apiKey,
        },
      });

      /*
       * CONNECTED
       */
      this.socket.on("open", () => {
        console.log("🔊 ElevenLabs connected");

        this.isConnected = true;

        /*
         * Initialize streaming
         */
        this.socket.send(
          JSON.stringify({
            text: " ",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.8,
              speed: 1,
            },
            generation_config: {
              chunk_length_schedule: [120, 160, 250, 290],
            },
          })
        );

        console.log("🔊 ElevenLabs ready");

        resolve();
      });

      /*
       * MESSAGE FROM ELEVENLABS
       */
      this.socket.on("message", (message) => {
        try {
          const data = JSON.parse(message.toString());

          console.log("ElevenLabs response:", data);

          /*
           * AUDIO
           */
          if (data.audio) {
            this.sendToClient({
              type: "tts_audio",
              audio: data.audio,
            });
          }

          /*
           * FINAL
           *
           * This means ElevenLabs has finished sending audio.
           *
           * It does NOT mean the browser finished playing.
           */
          if (data.isFinal || data.is_final) {
            console.log("🔊 ElevenLabs final");

            this.sendToClient({
              type: "tts_end",
            });
          }
        } catch (error) {
          console.error("ElevenLabs message error:", error);
        }
      });

      /*
       * ERROR
       */
      this.socket.on("error", (error) => {
        console.error("❌ ElevenLabs error:", error.message);

        this.isConnected = false;

        this.sendToClient({
          type: "tts_error",
          message: "Text-to-speech failed",
        });

        reject(error);
      });

      /*
       * CLOSED
       */
      this.socket.on("close", () => {
        console.log("🔊 ElevenLabs disconnected");

        this.isConnected = false;

        this.socket = null;

        this.connectPromise = null;
      });
    });

    return this.connectPromise;
  }

  /*
   * SPEAK
   *
   * Self-healing: if the socket dropped (e.g. inactivity timeout
   * between AI turns), reconnect before speaking instead of
   * silently failing.
   */
  async speak(text) {
    if (!text) {
      return;
    }

    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.log("🔊 ElevenLabs not connected, reconnecting...");

      try {
        await this.connect();
      } catch (error) {
        console.error("❌ ElevenLabs reconnect failed:", error);

        this.sendToClient({
          type: "tts_error",
          message: "Text-to-speech failed",
        });

        return;
      }
    }

    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.log("❌ ElevenLabs still not connected after reconnect attempt");

      return;
    }

    console.log("🔊 Speaking:", text);

    /*
     * Send text.
     */
    this.socket.send(
      JSON.stringify({
        text,
        flush: true,
      })
    );

    /*
     * Empty text tells ElevenLabs that this generation is finished.
     */
    this.socket.send(
      JSON.stringify({
        text: "",
      })
    );
  }

  /*
   * CLOSE
   */
  close() {
    if (!this.socket) {
      return;
    }

    console.log("🔊 Closing ElevenLabs");

    try {
      this.socket.close();
    } catch (error) {
      console.error("❌ ElevenLabs close error:", error);
    }

    this.socket = null;

    this.isConnected = false;

    this.connectPromise = null;
  }

  /*
   * SEND TO FRONTEND
   */
  sendToClient(data) {
    if (
      this.clientSocket &&
      this.clientSocket.readyState === WebSocket.OPEN
    ) {
      try {
        this.clientSocket.send(JSON.stringify(data));
      } catch (error) {
        console.error("❌ Failed to send data to client:", error);
      }
    }
  }
}

export default ElevenLabsService;