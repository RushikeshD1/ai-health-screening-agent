# Niva — AI Health Screening Voice Assistant

**Niva** is an AI voice assistant designed to conduct a basic health screening conversation.

When the user starts a call, Niva introduces herself and asks simple health-related questions. The user responds using their microphone, and the application converts the user's speech into text.

The text is then sent to the AI model, which generates the next response. The response is converted into speech and played back to the user.

Niva continues the conversation for approximately **2–4 questions depending on the user's responses**, and then provides a final screening summary.

> **Note:** Niva is intended for basic informational screening only and does not provide a medical diagnosis.

---

# ✨ Features

## 🎙️ Voice Conversation

The application supports a complete voice conversation between the user and Niva.

The user does not need to type responses. They can simply speak naturally through their microphone.

---

## 🗣️ Speech-to-Text

User speech is processed using **Deepgram Speech-to-Text**.

The application supports:

* Real-time speech recognition
* Interim transcripts
* Final transcripts
* English language recognition
* Automatic endpointing
* Smart formatting

---

## 🧠 AI-Powered Responses

The project uses **Google Gemini** to generate Niva's responses.

Gemini is instructed to:

* Act as a friendly health screening assistant
* Ask simple health-related questions
* Keep responses concise and natural
* Continue the screening based on the user's answers
* Ask approximately 2–4 questions
* Generate a final screening summary after collecting enough information

---

## 🔊 Text-to-Speech

Niva's responses are converted into speech using **ElevenLabs**.

The application receives audio chunks from ElevenLabs and plays them sequentially in the browser.

This allows Niva to speak naturally rather than displaying only text responses.

---

## 🔄 Real-Time WebSocket Communication

The frontend and backend communicate using WebSockets.

WebSockets are used for:

* Call events
* Speech recognition status
* Audio transmission
* Transcripts
* AI responses
* TTS audio
* Screening completion
* Health report delivery

This allows the application to maintain a real-time voice interaction.

---

## 🎧 TTS Audio Queue

ElevenLabs can return speech as multiple audio chunks.

The application therefore maintains an audio queue to ensure that:

1. Audio chunks are received.
2. Chunks are added to the queue.
3. Audio is played sequentially.
4. The next chunk starts only after the previous chunk finishes.
5. Listening starts only after Niva has completely finished speaking.

This prevents the user microphone from starting while Niva is still speaking.

---

## 🎤 Conversation State Management

The application manages different conversation states:

* `idle`
* `ai-speaking`
* `waiting`
* `listening`

This ensures that the microphone is not activated while Niva is speaking.

The intended flow is:

```text
Call Started
     ↓
Niva Speaks
     ↓
Niva Finishes Speaking
     ↓
Microphone Starts
     ↓
User Speaks
     ↓
Speech Recognition
     ↓
Gemini Response
     ↓
Niva Speaks Again
     ↓
Next Question
```

---

## 📋 Live Transcript

The application displays the user's recognized speech during the conversation.

Both interim and final speech recognition results can be handled.

---

## 🏥 Final Health Screening Report

After enough information has been collected, the application displays a final health screening summary.

The report can include:

* Summary
* Possible concerns
* Recommendations
* When to seek professional help

The report also clearly indicates that it is an informational screening summary and not a medical diagnosis.

---

## 🎨 User Interface

The frontend includes:

* Modern health-focused interface
* Niva voice assistant display
* Animated voice orb
* Call start/end button
* Listening status
* Niva speaking status
* Microphone status
* Live transcript
* Final health report modal
* Responsive layout

---

# 🛠️ Technology Stack

## Frontend

* React
* Vite
* JavaScript
* Tailwind CSS
* WebSocket Client
* Browser Audio APIs

## Backend

* Node.js
* Express.js
* WebSocket (`ws`)
* REST/WebSocket server architecture

## AI & Voice Services

* Google Gemini — AI response generation
* Deepgram — Speech-to-Text
* ElevenLabs — Text-to-Speech

---

# 🏗️ Project Architecture

```text
                    ┌─────────────────────┐
                    │       User          │
                    │   Speaks into Mic   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │      Frontend       │
                    │       React         │
                    └──────────┬──────────┘
                               │
                         WebSocket
                               │
                               ▼
                    ┌─────────────────────┐
                    │       Backend       │
                    │       Node.js       │
                    └──────┬──────┬───────┘
                           │      │
             ┌─────────────┘      └──────────────┐
             ▼                                    ▼
     ┌─────────────────┐                 ┌─────────────────┐
     │    Deepgram     │                 │     Gemini      │
     │  Speech-to-Text │                 │   AI Response   │
     └────────┬────────┘                 └────────┬────────┘
              │                                   │
              │                                   ▼
              │                          ┌─────────────────┐
              │                          │   ElevenLabs    │
              │                          │  Text-to-Speech │
              │                          └────────┬────────┘
              │                                   │
              └──────────────────┬────────────────┘
                                 ▼
                         ┌─────────────────┐
                         │     Frontend    │
                         │  Audio Playback │
                         └─────────────────┘
```

---

# 📂 Project Structure

```text
ai-health/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx
│   │   │   ├── VoiceOrb.jsx
│   │   │   ├── CallButton.jsx
│   │   │   ├── Transcript.jsx
│   │   │   └── Footer.jsx
│   │   │
│   │   ├── hooks/
│   │   │   ├── useWebSocket.js
│   │   │   └── useAudioRecorder.js
│   │   │
│   │   └── App.jsx
│   │
│   └── package.json
│
├── backend/
│   ├── services/
│   │   ├── GeminiService.js
│   │   ├── DeepgramService.js
│   │   └── ElevenLabsService.js
│   │
│   ├── index.js
│   ├── package.json
│   └── .env
│
└── README.md
```

> The exact folder names may vary slightly depending on the final repository structure.

---

# ⚙️ Local Setup

## 1. Clone the Repository

```bash
git clone YOUR_PUBLIC_GITHUB_REPOSITORY_URL
cd ai-health
```

---

# 🔹 Backend Setup

Navigate to the backend:

```bash
cd backend
```

Install dependencies:

```bash
npm install
```

Create a `.env` file inside the `backend` directory.

```env
GEMINI_API_KEY=
DEEPGRAM_API_KEY=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
PORT=
```

Start the backend:

```bash
npm start
```

For development:

```bash
npm run dev
```

The backend will run locally on:

```text
http://localhost:3000
```

The WebSocket server will use:

```text
ws://localhost:3000
```

---

# 🔹 Frontend Setup

Open another terminal and navigate to the frontend:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The frontend will normally be available at:

```text
http://localhost:5173
```

---

# 🔐 API Keys Required

The project requires API keys for the following services.

## Google Gemini

Used for generating AI responses and health screening questions.

Environment variable:

```env
GEMINI_API_KEY=
```

---

## Deepgram

Used for converting the user's voice into text.

Environment variable:

```env
DEEPGRAM_API_KEY=
```

---

## ElevenLabs

Used for converting Niva's AI responses into speech.

Environment variables:

```env
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
```

---

# ⚠️ Environment Variables & Security

API keys should **never be committed to GitHub**.

The `.env` file should be added to `.gitignore`:

```gitignore
.env
node_modules/
dist/
```

For deployment, configure the same environment variables through the hosting platform's environment variable settings.

---

# 🔄 Application Flow

When the user clicks **Start Call**:

```text
1. Frontend connects to backend
              ↓
2. Call starts
              ↓
3. Niva generates an introduction
              ↓
4. Gemini generates the response
              ↓
5. ElevenLabs converts response to audio
              ↓
6. Frontend plays Niva's audio
              ↓
7. Niva finishes speaking
              ↓
8. Microphone becomes active
              ↓
9. User answers
              ↓
10. Deepgram converts speech to text
              ↓
11. Gemini processes the answer
              ↓
12. Niva asks the next question
              ↓
13. Steps repeat for approximately 2–4 questions
              ↓
14. Final health screening report is generated
```

---

# 🎤 Voice Interaction Logic

A key part of the implementation is preventing the microphone from listening while Niva is speaking.

The application follows this rule:

```text
Niva Speaking
      ↓
Microphone OFF
      ↓
TTS Audio Completely Finished
      ↓
Microphone ON
      ↓
User Speaking
```

The `stt_connected` event only indicates that the speech recognition connection is available.

It does **not** automatically start the microphone.

The microphone starts only after the `niva-tts-end` event confirms that the complete TTS audio queue has finished playing.

---

# 🌐 Deployment

The application has been deployed using:

* Frontend: Vercel
* Backend: Render

## 🚀 Live Demo

**Live Application:**

https://ai-health-screening-agent-beryl.vercel.app/

The live demo can be used to review the complete AI voice screening flow.

---

# 🧪 Testing the Application

After starting the application:

1. Open the Live Demo or local frontend.
2. Allow microphone permission.
3. Click **Start Call**.
4. Wait for Niva to introduce herself.
5. Allow Niva to finish speaking.
6. Answer the question using your microphone.
7. Continue the conversation.
8. Observe the live transcript.
9. Listen to Niva's responses.
10. Complete the screening.
11. Review the final health screening summary.

---

# 🔒 Privacy & Security

This project is intended as a demonstration of an AI voice screening workflow.

* API keys are stored as environment variables.
* API keys are not included in the source code.
* No API keys should be committed to the public repository.
* The application does not provide a medical diagnosis.

---

# ⚠️ Disclaimer

Niva is an AI-based health screening assistant created for demonstration and informational purposes.

The generated screening summary should **not be considered a medical diagnosis or a substitute for professional medical advice**.

Users experiencing serious, severe, or persistent symptoms should consult a qualified healthcare professional.

---

# 👨‍💻 Project Summary

This project demonstrates how multiple real-time AI and voice technologies can be integrated into a single application.

The core pipeline is:

```text
User Voice
    ↓
Deepgram Speech-to-Text
    ↓
Gemini AI
    ↓
ElevenLabs Text-to-Speech
    ↓
Audio Playback
    ↓
User
```

The project focuses on creating a natural voice interaction where the AI agent speaks, waits for the user, understands the user's response, asks follow-up questions, and finally produces a structured health screening summary.

---
