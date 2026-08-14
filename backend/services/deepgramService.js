import WebSocket from "ws";

class DeepgramService {
  constructor(clientSocket, onFinalTranscript) {
    this.clientSocket = clientSocket;
    this.onFinalTranscript = onFinalTranscript;

    this.deepgramSocket = null;

    this.finalTranscript = "";
    this.isConnected = false;
    this.isClosing = false;
  }

  connect() {
    const apiKey = process.env.DEEPGRAM_API_KEY;

    if (!apiKey) {
      console.error("❌ DEEPGRAM_API_KEY is missing");
      return;
    }

    if (
      this.deepgramSocket &&
      (
        this.deepgramSocket.readyState === WebSocket.OPEN ||
        this.deepgramSocket.readyState === WebSocket.CONNECTING
      )
    ) {
      console.log("⚠️ Deepgram socket already exists");
      return;
    }

    this.isClosing = false;
    this.finalTranscript = "";

    console.log("🔌 Connecting to Deepgram...");

    const url =
      "wss://api.deepgram.com/v1/listen" +
      "?model=nova-3" +
      "&language=en-US" +
      "&encoding=linear16" +
      "&sample_rate=16000" +
      "&channels=1" +
      "&smart_format=true" +
      "&interim_results=true" +
      "&endpointing=300";

    this.deepgramSocket = new WebSocket(url, {
      headers: {
        Authorization: `Token ${apiKey}`,
      },
    });

    this.deepgramSocket.on("open", () => {
      console.log("✅ Deepgram connected");

      this.isConnected = true;

      this.sendToClient({
        type: "stt_connected",
      });
    });

    this.deepgramSocket.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());

        this.handleTranscript(data);
      } catch (error) {
        console.error(
          "❌ Deepgram message parse error:",
          error
        );
      }
    });

    this.deepgramSocket.on("error", (error) => {
      console.error(
        "❌ Deepgram WebSocket error:",
        error.message
      );
    });

    this.deepgramSocket.on("close", (code, reason) => {
      console.log("🔴 Deepgram disconnected");

      console.log("Close code:", code);

      console.log(
        "Close reason:",
        reason?.toString() || ""
      );

      this.isConnected = false;

      this.deepgramSocket = null;

      if (!this.isClosing) {
        this.sendToClient({
          type: "stt_disconnected",
        });
      }
    });

    this.deepgramSocket.on(
      "unexpected-response",
      (request, response) => {
        console.error(
          "❌ Deepgram handshake failed"
        );

        console.error(
          "HTTP status:",
          response.statusCode
        );

        console.error(
          "HTTP status message:",
          response.statusMessage
        );

        console.error(
          "Deepgram error:",
          response.headers["dg-error"]
        );

        console.error(
          "Deepgram request ID:",
          response.headers["dg-request-id"]
        );
      }
    );
  }

  handleTranscript(data) {
    if (data.type !== "Results") {
      return;
    }

    const alternative =
      data.channel?.alternatives?.[0];

    if (!alternative) {
      return;
    }

    const transcript =
      alternative.transcript?.trim();

    if (!transcript) {
      return;
    }

    if (data.is_final) {
      this.finalTranscript +=
        (this.finalTranscript ? " " : "") +
        transcript;

      console.log(
        "✅ Final:",
        transcript
      );

      this.sendToClient({
        type: "transcript",
        text: this.finalTranscript,
        isFinal: true,
      });

      if (this.onFinalTranscript) {
        this.onFinalTranscript(
          this.finalTranscript
        );
      }

      return;
    }

    const currentTranscript =
      this.finalTranscript +
      (this.finalTranscript ? " " : "") +
      transcript;

    console.log(
      "📝 Interim:",
      transcript
    );

    this.sendToClient({
      type: "transcript",
      text: currentTranscript,
      isFinal: false,
    });
  }

  sendAudio(audioBuffer) {
    if (!this.isConnected) {
      console.log(
        "⚠️ Cannot send audio: Deepgram not connected"
      );

      return;
    }

    if (
      !this.deepgramSocket ||
      this.deepgramSocket.readyState !==
        WebSocket.OPEN
    ) {
      console.log(
        "⚠️ Cannot send audio: Deepgram socket not open"
      );

      return;
    }

    try {
      this.deepgramSocket.send(audioBuffer);
    } catch (error) {
      console.error(
        "❌ Failed to send audio to Deepgram:",
        error
      );
    }
  }

  finalize() {
    if (
      !this.deepgramSocket ||
      this.deepgramSocket.readyState !==
        WebSocket.OPEN
    ) {
      console.log(
        "⚠️ Cannot finalize: Deepgram socket not open"
      );

      return;
    }

    console.log(
      "⏹️ Finalizing current utterance..."
    );

    try {
      this.deepgramSocket.send(
        JSON.stringify({
          type: "Finalize",
        })
      );
    } catch (error) {
      console.error(
        "❌ Deepgram finalize error:",
        error
      );
    }
  }

  close() {
    console.log("🔴 Deepgram close() called");

    this.isClosing = true;

    if (
      this.deepgramSocket &&
      this.deepgramSocket.readyState ===
        WebSocket.OPEN
    ) {
      console.log(
        "🔴 Closing Deepgram connection..."
      );

      try {
        this.deepgramSocket.send(
          JSON.stringify({
            type: "CloseStream",
          })
        );
      } catch (error) {
        console.error(
          "❌ Error sending CloseStream:",
          error
        );
      }

      this.deepgramSocket.close();
    }

    this.deepgramSocket = null;
    this.isConnected = false;
  }

  resetTranscript() {
    this.finalTranscript = "";
  }

  sendToClient(data) {
    if (
      this.clientSocket &&
      this.clientSocket.readyState ===
        WebSocket.OPEN
    ) {
      try {
        this.clientSocket.send(
          JSON.stringify(data)
        );
      } catch (error) {
        console.error(
          "❌ Failed to send data to client:",
          error
        );
      }
    }
  }
}

export default DeepgramService;