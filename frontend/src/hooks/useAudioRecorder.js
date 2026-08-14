import { useRef, useState } from "react";
import audioProcessorUrl from "../utils/audioProcessor.js?url";

const useAudioRecorder = (sendAudio) => {
  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);

  const startRecording = async () => {
    if (streamRef.current) return;

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

      streamRef.current = stream;

      const audioContext =
        new AudioContext({
          sampleRate: 16000,
        });

      audioContextRef.current = audioContext;

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      await audioContext.audioWorklet.addModule(
        audioProcessorUrl
      );

      const source =
        audioContext.createMediaStreamSource(
          stream
        );

      sourceRef.current = source;

      const processor =
        new AudioWorkletNode(
          audioContext,
          "pcm-processor"
        );

      processorRef.current = processor;

      processor.port.onmessage = (event) => {
        if (!streamRef.current) return;

        sendAudio(event.data);
      };

      source.connect(processor);

      processor.connect(
        audioContext.destination
      );

      setIsRecording(true);

      console.log("🎙️ Listening...");
    } catch (error) {
      console.error(
        "❌ Microphone error:",
        error
      );

      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (!streamRef.current) return;

    console.log("🎙️ Microphone stopped");

    if (processorRef.current) {
      processorRef.current.port.onmessage =
        null;

      processorRef.current.disconnect();

      processorRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();

      sourceRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((track) => {
          track.stop();
        });

      streamRef.current = null;
    }

    if (audioContextRef.current) {
      await audioContextRef.current.close();

      audioContextRef.current = null;
    }

    setIsRecording(false);
  };

  return {
    isRecording,
    startRecording,
    stopRecording,
  };
};

export default useAudioRecorder;