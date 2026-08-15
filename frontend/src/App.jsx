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
    ttsPlaying,
    quotaExceeded,
    quotaMessage,
    clearQuotaExceeded,
    aiError,
    clearAiError,
    stopAudioPlayback,
    clearTranscript,
    clearAiResponse,
  } = useWebSocket();

  const {
    isRecording,
    startRecording,
    stopRecording,
  } = useAudioRecorder(sendAudio);

  const [isCallActive, setIsCallActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [conversationState, setConversationState] =
    useState("idle");

  const [showReport, setShowReport] = useState(false);
  const [report, setReport] = useState(null);

  const isRecordingRef = useRef(false);
  const isCallActiveRef = useRef(false);
  const previousAiResponseRef = useRef("");
  const waitingForSttRef = useRef(false);

  /*
   * Holds the health report while we wait for the closing
   * message's audio to actually finish playing. Set when
   * `healthReport` arrives, consumed by the `niva-tts-end`
   * handler once Niva has actually finished speaking it.
   */
  const pendingReportRef = useRef(null);

  useEffect(() => {
    isCallActiveRef.current = isCallActive;
  }, [isCallActive]);

  /*
   * Start microphone ONLY when:
   *
   * 1. Call is active
   * 2. Niva has finished speaking
   * 3. Deepgram is connected
   * 4. Microphone is not already recording
   */
  const startListening = async () => {
    if (!isCallActiveRef.current) {
      return;
    }

    if (ttsPlaying) {
      console.log("⛔ Niva is still speaking");
      return;
    }

    if (!sttConnected) {
      console.log("⏳ Waiting for Speech Recognition...");
      waitingForSttRef.current = true;
      return;
    }

    if (isRecordingRef.current) {
      return;
    }

    try {
      console.log("🎙️ Starting microphone...");

      isRecordingRef.current = true;

      await startRecording();

      setIsListening(true);
      setConversationState("listening");

      console.log("🎙️ Microphone started");
    } catch (error) {
      console.error(
        "❌ Failed to start microphone:",
        error
      );

      isRecordingRef.current = false;
      setIsListening(false);
      setConversationState("waiting");
    }
  };

  /*
   * Stop microphone.
   */
  const stopListening = async () => {
    if (!isRecordingRef.current) {
      return;
    }

    console.log("🛑 Stopping microphone...");

    isRecordingRef.current = false;

    try {
      await stopRecording();

      setIsListening(false);

      console.log("🛑 Microphone stopped");
    } catch (error) {
      console.error(
        "❌ Failed to stop microphone:",
        error
      );

      setIsListening(false);
    }
  };

  /*
   * CALL START
   */
  const handleCall = () => {
    if (isCallActiveRef.current) {
      handleEndCall();
      return;
    }

    if (!connected) {
      console.log(
        "❌ WebSocket not connected"
      );
      return;
    }

    console.log("📞 Starting call...");

    previousAiResponseRef.current = "";
    waitingForSttRef.current = false;
    pendingReportRef.current = null;

    setReport(null);
    setShowReport(false);

    isCallActiveRef.current = true;

    setIsCallActive(true);
    setIsListening(false);
    setConversationState("ai-speaking");

    /*
     * IMPORTANT:
     *
     * Do NOT start microphone here.
     *
     * Do NOT wait for stt_connected here.
     *
     * Niva must speak first.
     */
    sendMessage({
      type: "start_call",
    });

    console.log(
      "📞 Call started - waiting for Niva"
    );
  };

  /*
   * CALL END
   *
   * Manually ending the call must stop Niva's voice immediately,
   * not just tell the backend to stop — any audio chunks already
   * sent to the browser are sitting in the queue and would
   * otherwise keep playing themselves out.
   */
  const handleEndCall = async () => {
    console.log("📞 Ending call");

    stopAudioPlayback();

    await stopListening();

    sendMessage({
      type: "end_call",
    });

    waitingForSttRef.current = false;
    isCallActiveRef.current = false;
    pendingReportRef.current = null;
    previousAiResponseRef.current = "";

    setIsCallActive(false);
    setIsListening(false);
    setConversationState("idle");

    clearTranscript();
    clearAiResponse();

    console.log("📞 Call ended");
  };

  /*
   * GEMINI RESPONSE
   *
   * Gemini response means Niva will speak.
   *
   * NEVER start microphone here.
   */
  useEffect(() => {
    if (!isCallActive) {
      return;
    }

    if (!aiResponse) {
      return;
    }

    if (
      previousAiResponseRef.current ===
      aiResponse
    ) {
      return;
    }

    previousAiResponseRef.current =
      aiResponse;

    console.log(
      "🤖 AI response received"
    );

    setConversationState(
      "ai-speaking"
    );

    setIsListening(false);

    if (isRecordingRef.current) {
      stopListening();
    }
  }, [aiResponse, isCallActive]);

  /*
   * NIVA FINISHED SPEAKING
   *
   * This is the ONLY place where we either:
   *   - restart the microphone (normal question turn), OR
   *   - finalize the call and show the report (closing message
   *     turn, i.e. a report was left pending for us)
   */
  useEffect(() => {
    const handleTtsEnd = async () => {
      if (!isCallActiveRef.current) {
        return;
      }

      console.log(
        "🔊 Niva finished actual audio playback"
      );

      /*
       * If a report is waiting, the audio that just finished
       * was the closing message — finalize the call now instead
       * of restarting the mic.
       */
      if (pendingReportRef.current) {
        console.log(
          "📋 Finalizing call after closing message"
        );

        const finalReport = pendingReportRef.current;
        pendingReportRef.current = null;

        await stopListening();

        sendMessage({
          type: "end_call",
        });

        waitingForSttRef.current = false;
        isCallActiveRef.current = false;
        previousAiResponseRef.current = "";

        setIsCallActive(false);
        setIsListening(false);
        setConversationState("idle");

        clearTranscript();
        clearAiResponse();

        setReport(finalReport);
        setShowReport(true);

        console.log("📋 Report ready");

        return;
      }

      setConversationState("waiting");
      setIsListening(false);

      /*
       * Ask backend to start Deepgram NOW.
       *
       * Deepgram should NOT have been connected
       * while Niva was speaking.
       */
      waitingForSttRef.current = true;

      console.log(
        "🎙️ Requesting Speech Recognition..."
      );

      sendMessage({
        type: "start_recording",
      });
    };

    window.addEventListener(
      "niva-tts-end",
      handleTtsEnd
    );

    return () => {
      window.removeEventListener(
        "niva-tts-end",
        handleTtsEnd
      );
    };
  }, [sendMessage]);

  /*
   * DEEPGRAM CONNECTED
   *
   * This does NOT automatically start microphone
   * unless we are waiting for STT after Niva finished.
   */
  useEffect(() => {
    if (!isCallActive) {
      return;
    }

    if (!sttConnected) {
      console.log(
        "🔌 Speech recognition disconnected"
      );
      return;
    }

    console.log(
      "🔌 Speech recognition connected"
    );

    if (!waitingForSttRef.current) {
      return;
    }

    if (ttsPlaying) {
      console.log(
        "⛔ STT connected but Niva is speaking"
      );
      return;
    }

    waitingForSttRef.current = false;

    startListening();
  }, [
    sttConnected,
    isCallActive,
    ttsPlaying,
  ]);

  /*
   * FINAL HEALTH REPORT
   *
   * Don't end the call the moment this arrives — the closing
   * message audio may still be streaming/playing. Just stash
   * the report; `handleTtsEnd` finalizes the call once Niva
   * has actually finished speaking it.
   */
  useEffect(() => {
    if (!healthReport) {
      return;
    }

    if (!isCallActiveRef.current) {
      return;
    }

    console.log(
      "📋 Report received, waiting for closing audio to finish..."
    );

    pendingReportRef.current = healthReport;
  }, [healthReport]);

  /*
   * AI ERROR
   *
   * A generic Gemini/pipeline failure (not a quota issue). Stop
   * any audio and free up the mic so the user isn't stuck waiting
   * on a response that's never coming.
   */
  useEffect(() => {
    if (!aiError) {
      return;
    }

    console.log("❌ AI error surfaced to UI:", aiError);

    stopAudioPlayback();

    waitingForSttRef.current = false;
  }, [aiError]);

  /*
   * Cleanup
   */
  useEffect(() => {
    return () => {
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
          about{" "}
          <span className="text-teal-600">
            your health.
          </span>
        </h1>

        <p className="mt-5 max-w-xl text-sm leading-7 text-slate-500 sm:text-base">
          Talk naturally with Niva. She'll listen carefully,
          ask thoughtful questions, and help organize what
          you're experiencing.
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
              : conversationState ===
                "ai-speaking"
              ? "I'm speaking..."
              : conversationState ===
                "waiting"
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
                : ttsPlaying
                ? "NIVA SPEAKING"
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
                onClick={() =>
                  setShowReport(false)
                }
                className="rounded-full px-3 py-2 text-slate-500 transition hover:bg-slate-100"
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

            {report.possibleConcerns &&
              report.possibleConcerns.length >
                0 && (
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

            {report.cautions &&
              report.cautions.length >
                0 && (
                <section className="mb-6">

                  <h3 className="mb-3 text-lg font-bold text-teal-950">
                    Cautions
                  </h3>

                  <div className="space-y-2">

                    {report.cautions.map(
                      (caution, index) => (
                        <div
                          key={index}
                          className="rounded-xl bg-amber-50 p-3 text-slate-700"
                        >
                          {caution}
                        </div>
                      )
                    )}

                  </div>

                </section>
              )}

            {report.recommendations &&
              report.recommendations.length >
                0 && (
                <section className="mb-6">

                  <h3 className="mb-3 text-lg font-bold text-teal-950">
                    What you can do
                  </h3>

                  <ul className="space-y-2">

                    {report.recommendations.map(
                      (
                        recommendation,
                        index
                      ) => (
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
              This report is an informational health screening
              summary and is not a medical diagnosis.

              If your symptoms are concerning, severe, or
              persistent, consider speaking with a qualified
              healthcare professional.
            </div>

            <button
              onClick={() =>
                setShowReport(false)
              }
              className="mt-6 w-full rounded-xl bg-teal-700 py-3 font-semibold text-white transition hover:bg-teal-800"
            >
              Done
            </button>

          </div>
        </div>
      )}

      {quotaExceeded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">

          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl sm:p-8">

            <p className="text-xs font-bold tracking-[0.16em] text-amber-600">
              USAGE LIMIT REACHED
            </p>

            <h2 className="mt-3 text-2xl font-bold text-teal-950">
              Out of free AI usage
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              {quotaMessage || "Please try again later."}
            </p>

            <button
              onClick={() => {
                handleEndCall();
                clearQuotaExceeded();
              }}
              className="mt-6 w-full rounded-xl bg-teal-700 py-3 font-semibold text-white transition hover:bg-teal-800"
            >
              Close
            </button>

          </div>
        </div>
      )}

      {aiError && !quotaExceeded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">

          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl sm:p-8">

            <p className="text-xs font-bold tracking-[0.16em] text-red-600">
              SOMETHING WENT WRONG
            </p>

            <h2 className="mt-3 text-2xl font-bold text-teal-950">
              Niva ran into a problem
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              {aiError}
            </p>

            <button
              onClick={() => {
                clearAiError();
              }}
              className="mt-6 w-full rounded-xl bg-teal-700 py-3 font-semibold text-white transition hover:bg-teal-800"
            >
              Close
            </button>

          </div>
        </div>
      )}
    </div>
  );
};

export default App;