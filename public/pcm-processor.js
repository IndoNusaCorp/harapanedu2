/**
 * PCM Audio Processor for LibraAI Voice
 * 
 * Converts Float32 audio samples from the microphone into Int16 PCM format for Gemini Live API.
 */
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(0);
    // Send chunks every ~100ms worth of audio at 16kHz = 1600 samples
    this._chunkSize = 1600;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const channelData = input[0]; // mono
    if (!channelData || channelData.length === 0) return true;

    // Append to buffer
    const newBuffer = new Float32Array(this._buffer.length + channelData.length);
    newBuffer.set(this._buffer);
    newBuffer.set(channelData, this._buffer.length);
    this._buffer = newBuffer;

    // When we have enough samples, send a chunk
    while (this._buffer.length >= this._chunkSize) {
      const chunk = this._buffer.slice(0, this._chunkSize);
      this._buffer = this._buffer.slice(this._chunkSize);

      // Convert Float32 [-1, 1] to Int16 [-32768, 32767]
      const int16 = new Int16Array(chunk.length);
      for (let i = 0; i < chunk.length; i++) {
        const s = Math.max(-1, Math.min(1, chunk[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      this.port.postMessage(int16.buffer, [int16.buffer]);
    }

    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
