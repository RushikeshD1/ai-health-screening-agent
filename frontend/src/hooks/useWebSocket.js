import { useEffect, useRef, useState } from "react";

const useWebSocket = () => {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [sttConnected, setSttConnected] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [healthReport, setHealthReport] = useState("");

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:3000");

    socketRef.current = socket;

    socket.onopen = () => {
      console.log("Connected to server");

      setConnected(true);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      console.log("Message from server:", data);

      // stt connected
      if (data.type === "stt_connected") {
        console.log("Speech recognition connected");

        setSttConnected(true);
      }

      // stt disconnected
      if (data.type === "stt_disconnected") {
        setSttConnected(false);
      }

      if (data.type === "transcript") {
        console.log(
          data.isFinal ? "✅ Final transcript:" : "📝 Interim transcript:",
          data.text,
        );
        setTranscript(data.text);
      }

      if (data.type === "ai_response") {
        console.log("🤖 AI response:", data.text);

        setAiResponse(data.text);
      }

      if (data.type === "ai_error") {
        console.error("AI error:", data.message);
      }

      // stt error
      if (data.type === "stt_error") {
        console.error("STT error:", data.message);
      }


      if (data.type === "health_report") {
  console.log(
    "📋 Health report received"
  );

  setHealthReport(data.report);
}

if (data.type === "screening_completed") {
  console.log(
    "✅ Screening completed"
  );
}
    };

    socket.onclose = (event) => {
      console.log("Disconnected from server");

      setConnected(false);
      setSttConnected(false);
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return () => {
      console.log("🧹 Cleaning WebSocket");

      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close();
      }

      socketRef.current = null;
    };
  }, []);

  const sendMessage = (data) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(data));
    }
  };

  // Send microphone audio
  // const sendAudio = (audioBlob) => {
  //   if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
  //     socketRef.current.send(audioBlob);
  //   }
  // };

  const sendAudio = (audioData) => {
  if (
    socketRef.current &&
    socketRef.current.readyState === WebSocket.OPEN
  ) {
    console.log(
      "🎵 Sending audio:",
      audioData.byteLength || audioData.length
    );

    socketRef.current.send(audioData);
  }
};

  // clear transcript
  const clearTranscript = () => {
    setTranscript("");
  };

  return {
    connected,
    sttConnected,
    transcript,
    aiResponse,
    sendMessage,
    sendAudio,
    clearTranscript,
  };
};

export default useWebSocket;
