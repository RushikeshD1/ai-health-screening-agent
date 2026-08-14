import { useEffect, useRef, useState } from "react";
import useWebSocket from "./hooks/useWebSocket";
import Header from "./components/Header";
import VoiceOrb from "./components/VoiceOrb";
import CallButton from "./components/CallButton";
import Transcript from "./components/Transcript";
import Footer from "./components/Footer";
import useAudioRecorder from "./hooks/useAudioRecorder";

const App = () => {
  const {
    connected,
    sttConnected,
    transcript,
    aiResponse,
    sendMessage,
    sendAudio,
    healthReport,
  } = useWebSocket();

  const { startRecording, stopRecording } =
    useAudioRecorder(sendAudio);

  const [isCallActive, setIsCallActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [conversationState, setConversationState] = useState("idle");
  const [showReport, setShowReport] = useState(false);
  const [report, setReport] = useState(null);

  const isRecordingRef = useRef(false);
  const previousAiResponseRef = useRef("");
  const pauseTimerRef = useRef(null);

  const wait = (ms) => {
    return new Promise((resolve) => {
      pauseTimerRef.current = setTimeout(() => {
        pauseTimerRef.current = null;
        resolve();
      }, ms);
    });
  };

  const startListening = async () => {
    if (!isCallActive || !sttConnected) {
      return;
    }

    if (isRecordingRef.current) {
      return;
    }

    setConversationState("waiting");
    setIsListening(false);

    await wait(500);

    if (!isCallActive || !sttConnected) {
      return;
    }

    if (isRecordingRef.current) {
      return;
    }

    try {
      isRecordingRef.current = true;

      await startRecording();

      sendMessage({
        type: "start_recording",
      });

      setIsListening(true);
      setConversationState("listening");

      console.log("🎙️ Listening");
    } catch (error) {
      console.error("❌ Recording error:", error);

      isRecordingRef.current = false;
      setIsListening(false);
      setConversationState("idle");
    }
  };

  const stopListening = async () => {
    if (!isRecordingRef.current) {
      return;
    }

    isRecordingRef.current = false;

    try {
      await stopRecording();

      sendMessage({
        type: "stop_recording",
      });

      setIsListening(false);

      console.log("🛑 Listening stopped");
    } catch (error) {
      console.error("❌ Stop recording error:", error);
    }
  };

  const handleCall = () => {
    if (isCallActive) {
      handleEndCall();
      return;
    }

    if (!connected) {
      console.log("❌ Server not connected");
      return;
    }

    previousAiResponseRef.current = "";

    setReport(null);
    setShowReport(false);

    sendMessage({
      type: "start_call",
    });

    setIsCallActive(true);
    setIsListening(false);
    setConversationState("ai-speaking");

    console.log("📞 Call started");
  };

  const handleEndCall = async () => {
    console.log("📞 Ending call");

    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }

    await stopListening();

    sendMessage({
      type: "end_call",
    });

    setIsCallActive(false);
    setIsListening(false);
    setConversationState("idle");

    console.log("📞 Call ended");
  };

  useEffect(() => {
    if (!isCallActive || !aiResponse) {
      return;
    }

    if (previousAiResponseRef.current === aiResponse) {
      return;
    }

    previousAiResponseRef.current = aiResponse;

    setConversationState("ai-speaking");
    setIsListening(false);

    stopListening();

    console.log("🤖 AI response received");

    const timer = setTimeout(() => {
      if (isCallActive) {
        startListening();
      }
    }, 1800);

    return () => clearTimeout(timer);
  }, [aiResponse, isCallActive]);

  useEffect(() => {
    if (!isCallActive || !sttConnected) {
      return;
    }

    if (conversationState !== "ai-speaking") {
      return;
    }

    const timer = setTimeout(() => {
      if (isCallActive) {
        startListening();
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [
    sttConnected,
    isCallActive,
    conversationState,
  ]);

  useEffect(() => {
    if (!healthReport) {
      return;
    }

    const finishScreening = async () => {
      console.log("📋 Final report received");
      console.log("📞 Automatically ending call");

      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
        pauseTimerRef.current = null;
      }

      await stopListening();

      sendMessage({
        type: "end_call",
      });

      setReport(healthReport);
      setIsCallActive(false);
      setIsListening(false);
      setConversationState("idle");
      setShowReport(true);

      console.log("📋 Report opened");
    };

    finishScreening();
  }, [healthReport]);

  useEffect(() => {
    return () => {
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
      }

      stopRecording();
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_50%_25%,rgba(83,190,177,0.18),transparent_30%),linear-gradient(145deg,#f8fdfc_0%,#eef9f6_50%,#e5f5f2_100%)] text-teal-950">
      <Header connected={connected} />

      <main className="mx-auto mt-10 flex w-[90%] max-w-4xl flex-1 flex-col items-center px-2 pt-12 text-center sm:pt-16">
        <div className="rounded-full bg-teal-700/7 px-3 py-2 text-[10px] font-bold tracking-[0.16em] text-teal-700">
          PRIVATE HEALTH SCREENING
        </div>

        <h1 className="mt-6 font-['Manrope'] text-5xl font-semibold leading-[1.03] tracking-[-0.06em] text-teal-950 sm:text-6xl md:text-7xl">
          A conversation
          <br />
          about <span className="text-teal-600">your health.</span>
        </h1>

        <p className="mt-5 max-w-xl text-sm leading-7 text-slate-500 sm:text-base">
          Talk naturally with Niva. She'll listen carefully, ask thoughtful
          questions, and help organize what you're experiencing.
        </p>

        <section className="mt-14 flex flex-col items-center">
          <VoiceOrb
            isCallActive={isCallActive}
            isListening={isListening}
          />

          <h2 className="mt-7 text-xl font-bold text-teal-950">
            Niva
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {!isCallActive
              ? "Ready when you are"
              : conversationState === "ai-speaking"
                ? "I'm speaking..."
                : conversationState === "thinking"
                  ? "I'm thinking..."
                  : conversationState === "waiting"
                    ? "Get ready..."
                    : isListening
                      ? "I'm listening..."
                      : "I'm here with you"}
          </p>

          <CallButton
            isCallActive={isCallActive}
            connected={connected}
            onClick={handleCall}
          />

          {isCallActive && (
            <div className="mt-4 flex items-center gap-2 text-[10px] font-bold tracking-[0.16em] text-slate-400">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isListening
                    ? "bg-emerald-500"
                    : "bg-slate-300"
                }`}
              />

              {isListening
                ? "LISTENING"
                : "MICROPHONE OFF"}
            </div>
          )}
        </section>

        <Transcript
          transcript={transcript}
          isListening={isListening}
          aiResponse={aiResponse}
        />
      </main>

      <Footer />

      {showReport && report && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 text-left shadow-2xl sm:p-8">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="text-xs font-bold tracking-[0.16em] text-teal-600">
                  NIVA HEALTH REPORT
                </p>

                <h2 className="mt-2 text-3xl font-bold text-teal-950">
                  Your screening summary
                </h2>
              </div>

              <button
                onClick={() => setShowReport(false)}
                className="rounded-full px-3 py-2 text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {report.summary && (
              <section className="mb-6">
                <h3 className="mb-2 text-lg font-bold text-teal-950">
                  Summary
                </h3>

                <p className="leading-7 text-slate-600">
                  {report.summary}
                </p>
              </section>
            )}

            {report.possibleConcerns?.length > 0 && (
              <section className="mb-6">
                <h3 className="mb-3 text-lg font-bold text-teal-950">
                  Possible concerns
                </h3>

                <div className="space-y-2">
                  {report.possibleConcerns.map(
                    (concern, index) => (
                      <div
                        key={index}
                        className="rounded-xl bg-teal-50 p-3 text-slate-700"
                      >
                        {concern}
                      </div>
                    )
                  )}
                </div>
              </section>
            )}

            {report.recommendations?.length > 0 && (
              <section className="mb-6">
                <h3 className="mb-3 text-lg font-bold text-teal-950">
                  What you can do
                </h3>

                <ul className="space-y-2">
                  {report.recommendations.map(
                    (recommendation, index) => (
                      <li
                        key={index}
                        className="rounded-xl bg-slate-50 p-3 text-slate-600"
                      >
                        {recommendation}
                      </li>
                    )
                  )}
                </ul>
              </section>
            )}

            {report.whenToSeekHelp && (
              <section className="mb-6">
                <h3 className="mb-2 text-lg font-bold text-teal-950">
                  When to seek professional help
                </h3>

                <p className="leading-7 text-slate-600">
                  {report.whenToSeekHelp}
                </p>
              </section>
            )}

            <div className="mt-6 rounded-2xl bg-teal-50 p-4 text-sm leading-6 text-teal-900">
              This report is an informational health screening summary and is
              not a medical diagnosis. If your symptoms are concerning, severe,
              or persistent, consider speaking with a qualified healthcare
              professional.
            </div>

            <button
              onClick={() => setShowReport(false)}
              className="mt-6 w-full rounded-xl bg-teal-700 py-3 font-semibold text-white hover:bg-teal-800"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;