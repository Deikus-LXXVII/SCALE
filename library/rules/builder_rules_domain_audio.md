---
description: "Rules for building audio pipelines (STT, TTS, Routing) on Apple Silicon."
tags: [audio, macos, apple-silicon, stt, tts, real-time]
---

# Builder Domain Rules: Audio Pipelines (Apple Silicon)

These rules apply when building agents or scripts that handle Speech-to-Text (STT), Text-to-Speech (TTS), LLM audio integration, and real-time audio routing (like censoring pipelines) on MacOS with Apple Silicon hardware.

## 1. Core Philosophy & Best Practices
- **Hardware Target**: Apple Silicon (M1/M2/M3) unified memory architecture.
- **Avoid CPU Fallbacks**: Tools optimized for NVIDIA GPUs (like `faster-whisper`) should be avoided. Use native Metal/MPS optimized libraries.
- **Real-Time Latency**: Audio pipelines live and die by latency. Use fast tools (Kokoro, whisper.cpp/mlx-whisper).
- **Modularity**: A full voice-to-voice system requires a middle layer (script) integrating STT -> Local Server (LM Studio) -> TTS.

## 2. Specific Domain Rules

1. **STT Selection**: NEVER use `faster-whisper` on Apple Silicon. ALWAYS use `mlx-whisper` (Python) or `whisper.cpp` for native Metal/MPS acceleration.
2. **TTS Selection**: For high quality, use `kokoro-mlx` or `kokoro-coreml`. Do not default to legacy models like Tacotron.
3. **Native TTS Fallback**: For zero-dependency scenarios, use macOS built-in `NSSpeechSynthesizer` or `os.system("say ...")`.
4. **LM Studio Integration**: LM Studio has NO native audio I/O. You MUST write middle-layer Python scripts communicating via the Local Server API (OpenAI compatible format).
5. **Real-time Routing Driver**: You MUST use **BlackHole** (virtual audio driver) for system-wide audio interception and censorship.
6. **Audio Stream Interception**: Use Python's `sounddevice` and `numpy` to read from the BlackHole input, process chunks, and stream to physical speakers.
7. **Censoring Latency**: Audio censoring pipelines must run incredibly fast. Use a very small VAD (Voice Activity Detection) or fast keyword spotter before running heavy STT models.
8. **Feedback Loops**: When routing audio, NEVER route the physical output back into the virtual input. This creates an infinite deafening audio loop.
9. **Buffer Sizes**: Manage audio chunk buffer sizes explicitly (e.g. 512, 1024 frames) to balance latency and processing overhead.
10. **Sample Rates**: Standardize on 16kHz for STT and 24kHz for TTS unless specified otherwise. Handle resampling cleanly using `librosa` or `scipy.signal`.
11. **Permissions (macOS)**: Provide explicit instructions to the user to grant "Microphone" permissions to the terminal/IDE running the Python scripts.
12. **Virtual Environments**: Always isolate Python audio dependencies (`sounddevice`, `mlx-whisper`, `openai`) in a `.venv`.
13. **VAD (Voice Activity Detection)**: Use `silero-vad` or `webrtcvad` to ignore silence and save compute resources.
14. **Streaming Outputs**: For TTS, if the LLM output is long, stream sentences one by one to the TTS engine to minimize First-Time-To-Audio (FTTA).
15. **System Default Manipulation**: Advise the user to manually switch System Output to BlackHole, rather than trying to script macOS system UI preferences.
16. **LM Studio Server Readiness**: Scripts must check if LM Studio is running on `localhost:1234` before attempting to connect.
17. **C/C++ Dependencies**: Packages like `sounddevice` require `portaudio`. Advise `brew install portaudio` in setup instructions.
18. **Multi-threading**: Audio reading (BlackHole) and audio writing (Speakers) must run on separate non-blocking threads.
19. **Memory Leaks**: Audio processing runs indefinitely. Avoid memory leaks in the while loops by forcing garbage collection if needed.
20. **Error Recovery**: If the LLM connection fails or STT throws an error, the script must gracefully reset the buffer and continue listening.
21. **Log Verbosity**: Mute excessive logs from MLX and Whisper during normal operation to prevent terminal spam.
22. **Apple Neural Engine (ANE)**: Note that CoreML models target ANE, while MLX models target the GPU. Choose based on system load.
23. **Censorship Fallback**: If a chunk takes too long to process in a real-time censorship pipeline, drop the chunk or mute it as a safety precaution.
24. **Word Timing**: For precise audio censoring, you must extract word-level timestamps from STT (which `whisper.cpp` supports natively).
25. **Dependency Conflicts**: Watch out for conflicting `numpy` versions required by MLX vs `sounddevice`.
26. **Testing**: Provide a dry-run script that reads a local `.wav` file instead of live BlackHole input for easier debugging.
27. **File Artifacts**: Do not leave massive temporary `.wav` files on disk during continuous streaming. Use in-memory byte buffers (`io.BytesIO`).
28. **Graceful Exit**: Catch `KeyboardInterrupt` to cleanly close audio streams and restore normal functionality.
29. **Volume Normalization**: Apply a soft limiter if the TTS or modified audio exceeds safe dB thresholds.
30. **No Cloud Fallbacks**: Given the privacy focus of local LLMs, do not fall back to Google or OpenAI APIs for STT/TTS without explicit user consent.
