import { useEffect, useRef, useState } from "react";

const useWebSocket = () => {
  const socketRef = useRef(null);

  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const currentAudioRef = useRef(null);
  const ttsFinishedRef = useRef(false);

  const [connected, setConnected] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [sttConnected, setSttConnected] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [healthReport, setHealthReport] = useState(null);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [quotaMessage, setQuotaMessage] = useState("");
  const [aiError, setAiError] = useState("");

  const notifyTtsFinished = () => {
    if (
      !ttsFinishedRef.current ||
      isPlayingRef.current ||
      audioQueueRef.current.length > 0
    ) {
      return;
    }

    console.log("🔊 Niva finished speaking completely");

    ttsFinishedRef.current = false;

    setTtsPlaying(false);

    window.dispatchEvent(new CustomEvent("niva-tts-end"));
  };

  const playNextAudio = () => {
    if (isPlayingRef.current) {
      return;
    }

    const audioBlob = audioQueueRef.current.shift();

    if (!audioBlob) {
      notifyTtsFinished();
      return;
    }

    setTtsPlaying(true);

    const audioUrl = URL.createObjectURL(audioBlob);

    const audio = new Audio(audioUrl);

    currentAudioRef.current = audio;

    isPlayingRef.current = true;

    console.log("▶️ Playing TTS audio");

    audio.onended = () => {
      console.log("▶️ TTS chunk finished");

      URL.revokeObjectURL(audioUrl);

      currentAudioRef.current = null;

      isPlayingRef.current = false;

      if (audioQueueRef.current.length > 0) {
        playNextAudio();
      } else {
        notifyTtsFinished();
      }
    };

    audio.onerror = (error) => {
      console.error("❌ Audio playback error:", error);

      URL.revokeObjectURL(audioUrl);

      currentAudioRef.current = null;

      isPlayingRef.current = false;

      if (audioQueueRef.current.length > 0) {
        playNextAudio();
      } else {
        notifyTtsFinished();
      }
    };

    audio.play().catch((error) => {
      console.error("❌ Audio play failed:", error);

      URL.revokeObjectURL(audioUrl);

      currentAudioRef.current = null;

      isPlayingRef.current = false;

      if (audioQueueRef.current.length > 0) {
        playNextAudio();
      } else {
        notifyTtsFinished();
      }
    });
  };

  /*
   * Immediately stop any audio that's currently playing and clear
   * whatever is still queued. Used when the user manually ends the
   * call, so Niva doesn't keep talking after "end call" is pressed.
   */
  const stopAudioPlayback = () => {
    console.log("🛑 Stopping audio playback");

    audioQueueRef.current = [];

    ttsFinishedRef.current = false;

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = "";
      currentAudioRef.current = null;
    }

    isPlayingRef.current = false;

    setTtsPlaying(false);
  };

  const clearAiError = () => {
    setAiError("");
  };

  const clearQuotaExceeded = () => {
    setQuotaExceeded(false);
    setQuotaMessage("");
  };

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:3000");

    socketRef.current = socket;

    socket.onopen = () => {
      console.log("Connected to server");

      setConnected(true);
    };

    socket.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        console.log("Message from server:", data);

        if (data.type === "connected") {
          console.log("WebSocket connected");
        }

        /*
         * IMPORTANT:
         *
         * This only tells React that Deepgram
         * is connected.
         *
         * It DOES NOT start microphone.
         */
        if (data.type === "stt_connected") {
          console.log("Speech recognition connected");

          setSttConnected(true);
        }

        if (data.type === "stt_disconnected") {
          console.log("Speech recognition disconnected");

          setSttConnected(false);
        }

        if (data.type === "transcript") {
          console.log(
            data.isFinal ? "Final transcript:" : "Interim transcript:",
            data.text
          );

          setTranscript(data.text);
        }

        /*
         * New AI response.
         */
        if (data.type === "ai_response") {
          console.log("AI response:", data.text);

          setAiResponse(data.text);

          /*
           * New TTS generation.
           */
          audioQueueRef.current = [];

          ttsFinishedRef.current = false;
        }

        /*
         * TTS AUDIO
         */
        if (data.type === "tts_audio") {
          try {
            const binaryString = atob(data.audio);

            const bytes = new Uint8Array(binaryString.length);

            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }

            const audioBlob = new Blob([bytes], {
              type: "audio/mpeg",
            });

            audioQueueRef.current.push(audioBlob);

            console.log("🔊 Audio queued:", audioQueueRef.current.length);

            playNextAudio();
          } catch (error) {
            console.error("❌ TTS audio error:", error);
          }
        }

        /*
         * ElevenLabs has finished SENDING
         * audio.
         *
         * This does NOT mean audio has
         * finished PLAYING.
         */
        if (data.type === "tts_end") {
          console.log("🔊 ElevenLabs finished sending audio");

          ttsFinishedRef.current = true;

          /*
           * Check whether all chunks
           * have already finished playing.
           */
          notifyTtsFinished();
        }

        if (data.type === "tts_error") {
          console.error("TTS error:", data.message);

          ttsFinishedRef.current = false;

          setTtsPlaying(false);
        }

        if (data.type === "ai_error") {
          console.error("AI error:", data.message);

          setAiError(
            data.message || "Something went wrong. Please try again."
          );
        }

        if (data.type === "quota_exceeded") {
          console.error("Quota exceeded:", data.message);

          setQuotaExceeded(true);

          setQuotaMessage(
            data.message ||
              "We've run out of free AI usage for now. Please try again later."
          );
        }

        if (data.type === "health_report") {
          console.log("Health report received");

          setHealthReport(data.report);
        }

        if (data.type === "screening_completed") {
          console.log("Screening completed");
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    };

    socket.onclose = () => {
      console.log("Disconnected from server");

      setConnected(false);

      setSttConnected(false);
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return () => {
      console.log("Cleaning WebSocket");

      if (currentAudioRef.current) {
        currentAudioRef.current.pause();

        currentAudioRef.current.src = "";

        currentAudioRef.current = null;
      }

      audioQueueRef.current = [];

      isPlayingRef.current = false;

      ttsFinishedRef.current = false;

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
      console.log("📤 Sending:", data);

      socketRef.current.send(JSON.stringify(data));
    }
  };

  const sendAudio = (audioData) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(audioData);
    }
  };

  const clearTranscript = () => {
    setTranscript("");
  };

  const clearAiResponse = () => {
    setAiResponse("");
  };

  return {
    connected,
    sttConnected,
    transcript,
    aiResponse,
    healthReport,
    sendMessage,
    sendAudio,
    ttsPlaying,
    clearTranscript,
    clearAiResponse,
    quotaExceeded,
    quotaMessage,
    clearQuotaExceeded,
    aiError,
    clearAiError,
    stopAudioPlayback,
  };
};

export default useWebSocket;