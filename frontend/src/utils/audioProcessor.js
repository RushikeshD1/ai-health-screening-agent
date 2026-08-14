class AudioProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];

    if (input && input[0]) {
      const float32Data = input[0];

      const int16Data = new Int16Array(
        float32Data.length
      );

      for (let i = 0; i < float32Data.length; i++) {
        let sample = float32Data[i];

        // Keep sample between -1 and 1
        sample = Math.max(-1, Math.min(1, sample));

        // Convert Float32 → Int16 PCM
        int16Data[i] =
          sample < 0
            ? sample * 0x8000
            : sample * 0x7fff;
      }

      // Send raw Int16 PCM bytes
      this.port.postMessage(
        int16Data.buffer,
        [int16Data.buffer]
      );
    }

    return true;
  }
}

registerProcessor(
  "pcm-processor",
  AudioProcessor
);