# chess-ai
# Universal Chess AI Commentator

A lightweight, open-source Chess AI built entirely in JavaScript/TypeScript using TensorFlow.js. It evaluates FEN strings and dynamically generates human-like commentary (in English or Hindi) based on the board state.

## Features
- **Tiny Footprint:** Runs locally in the browser or React Native.
- **Multi-Lingual:** Supports English `` and Hindi ``.
- **Context Aware:** Understands Blunders, Checks, and Evaluation swings.
- **Multi-Persona:** Can act as an `[OPPONENT]` or an `[ADVISOR]`.

## How to Use

1. **Install Dependencies:**
   `npm install`
2. **Generate the Synthetic Dataset:**
   `npm run generate` (Plays 5 games against itself to build the brain data)
3. **Train the Neural Network:**
   `npm run train` (Compiles the LSTM and exports the model)
4. **Chat with the AI:**
   `npm run chat`