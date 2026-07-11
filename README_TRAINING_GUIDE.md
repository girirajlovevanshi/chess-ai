# V1 Universal Chess AI Engine (Multi-Persona & Multi-Language)

This is the core training, data processing, and inference engine for the V1 mobile Chess AI. The architecture is 100% decoupled from static templates: all training data lives in external JSON files, vocabulary is mapped dynamically, and the neural network utilizes stacked bidirectional sequence layers optimized for on-device mobile inference (React Native / Expo).

## 📁 Project Architecture

```text
chess-ai/
├── data_chunks/               <-- ALL TRAINING DATA LIVES HERE (Drop new JSON files here)
│   ├── opponent_gameplay.json <-- Banter, blunder calling, taunts, checkmate threats
│   ├── advisor_analysis.json  <-- Positional breakdowns, tactical evaluations
│   └── teacher_lessons.json   <-- Puzzle hints, Socratic explanations, general QA
├── model_output/              <-- AUTO-GENERATED EXPORTS (Do not manually touch)
│   ├── vocab.json             <-- Immutable word-to-ID mapping
│   ├── model.json             <-- Neural network topology & weight manifests
│   └── weights.bin            <-- Quantization-ready mathematical weights
├── src/                       <-- CORE ENGINE SCRIPTS
│   ├── tokenizer.ts           <-- Subword/character fallback sequence encoder
│   ├── dataset.ts             <-- Data ingestion, balancing, and matrix assembler
│   ├── train.ts               <-- Bidirectional LSTM architecture & trainer
│   └── chat.ts                <-- Terminal inference playground for validation
├── dist/                      <-- Compiled JavaScript output (generated via tsc)
├── training_data.json         <-- Auto-generated master dataset (ignored in git)
├── package.json
└── tsconfig.json

```

---

## ⚡ Quick Start: Running Local Validation (Mac / PC)

To verify the pipeline locally before pushing to a cloud server, open your terminal in the root directory and execute these 4 commands sequentially:

### 1. Compile TypeScript to JavaScript

```bash
npx tsc

```

*Compiles all scripts from `src/` into the `dist/` directory.*

### 2. Assemble and Balance the Data

```bash
node dist/dataset.js

```

*Scans `data_chunks/`, fits the master dictionary, automatically oversamples teaching/conversational rows to prevent data imbalance, and outputs `training_data.json`.*

### 3. Train the Neural Network

```bash
node dist/train.js

```

*Loads the compiled tensor matrices, trains for 15 epochs (local validation default), and exports the mobile-ready bundle (`vocab.json`, `model.json`, `weights.bin`) into `model_output/`.*

### 4. Test in the Interactive Playground

```bash
node dist/chat.js

```

*Boots an interactive terminal interface. Paste test strings like `<EN> [MODE:OPPONENT] [STAGE:USER_MOVE] [SITUATION:BLUNDER] EVAL:-5.2` to chat with the V1 brain.*

---

## 🚀 How to Make the Model Smarter (Scaling Up)

To upgrade the AI from a validation prototype to a production-grade Play Store engine, you must upgrade **1. The Fuel (Data)** and **2. The Engine (Hyperparameters)**.

### Part 1: Scaling the Data (Zero Code Changes Required)

You do **not** need to edit `src/dataset.ts` or `src/tokenizer.ts` to add more training data. The data assembler is built to dynamically ingest any JSON file dropped into the `data_chunks/` directory.

#### How to Add New Data:

1. Create a new `.json` file inside `data_chunks/` (e.g., `data_chunks/openings_theory.json` or `data_chunks/endgame_taunts.json`).
2. Follow the exact structured JSON array format:

```json
[
  {
    "input": "<EN> [MODE:ADVISOR] [STAGE:USER_MOVE] [SITUATION:NORMAL] EVAL:+1.5 HIST:e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7",
    "target": "<START> Excellent Ruy Lopez opening! Developing the bishop and putting immediate pressure on the knight. <END>"
  },
  {
    "input": "<HI> [MODE:TEACHER] [STAGE:AI_PONDER] [SITUATION:PUZZLE_HINT] FEN:4r1k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
    "target": "<START> अंतिम पंक्ति (Back-rank) की कमजोरी को देखें। दुश्मन राजा फंसा हुआ है। <END>"
  }
]

```

3. **Strict Formatting Rules:**
* **Always** wrap the target sentence in `<START> ` and ` <END>`.
* **Always** include explicit language (`<EN>`, `<HI>`) and mode (`[MODE:OPPONENT]`, `[MODE:ADVISOR]`, etc.) tags in the input prompt.
* Add as many rows as you want (50,000 to 500,000+ rows is ideal for cloud training).



---

### Part 2: Upgrading Hyperparameters for Google Cloud

When training locally on a Mac, we use small parameters so your computer doesn't run out of memory. When you deploy this code to a **Google Cloud GPU Virtual Machine**, open **`src/train.ts`** and modify these exact variables to unleash the full capacity of the neural network:

| Variable / Parameter | Location in `src/train.ts` | Mac (Local Prototype) | Google Cloud GPU (Production Scale) | Why Change It? |
| --- | --- | --- | --- | --- |
| **`outputDim`** (Embedding) | `buildProductionModel` -> Layer 1 | `128` | **`256` or `512**` | Increases the depth of word/character association, making grammar significantly smoother. |
| **`units`** (LSTM Layer 1) | `buildProductionModel` -> Layer 2 | `128` | **`256` or `512**` | Expands the short-term memory capacity for complex, 40-move FEN histories. |
| **`units`** (LSTM Layer 2) | `buildProductionModel` -> Layer 3 | `128` | **`256` or `512**` | Expands deep context reasoning (keeps persona tone completely separated from tactical logic). |
| **`epochs`** | `runProductionTrainingSequence` -> `model.fit()` | `15` | **`30` to `50**` | Forces the network to read the massive dataset multiple times until accuracy locks above 92%. |
| **`batchSize`** | `runProductionTrainingSequence` -> `model.fit()` | `32` | **`64` or `128**` | Speeds up GPU matrix math by processing more games simultaneously per step. |
| **`MAX_SEQUENCE_LENGTH`** | Global Const in `dataset.ts`, `train.ts`, `chat.ts` | `384` | **`384` or `512**` | Increase to `512` only if you add extremely long Socratic teaching essays or 60-move histories. |

#### Example Cloud Architecture Block (`src/train.ts`):

```typescript
function buildProductionModel(vocabSize: number, sequenceLength: number): tf.LayersModel {
    const model = tf.sequential();

    // High-capacity 256-dimensional embedding
    model.add(tf.layers.embedding({
        inputDim: vocabSize,
        outputDim: 256, 
        inputLength: sequenceLength
    }));

    // Deep Bidirectional Layer 1 (256 units per direction = 512 total vector depth)
    model.add(tf.layers.bidirectional({
        layer: tf.layers.lstm({ units: 256, returnSequences: true })
    }));

    // Deep Bidirectional Layer 2
    model.add(tf.layers.bidirectional({
        layer: tf.layers.lstm({ units: 256, returnSequences: true })
    }));

    model.add(tf.layers.timeDistributed({
        layer: tf.layers.dense({ units: vocabSize, activation: 'softmax' })
    }));

    model.compile({
        optimizer: tf.train.adam(0.0005), // Slightly lower learning rate for deep convergence
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
    });

    return model;
}

```

---

## ☁️ Google Cloud GPU Deployment Workflow

When your dataset reaches 100,000+ rows, train on Google Cloud using an **NVIDIA T4, L4, or A100 GPU instance**:

1. **Provision VM:** Launch an Ubuntu 22.04 LTS instance on Google Cloud Compute Engine with GPU access enabled.
2. **Install Node.js & GPU Dependencies:**
```bash
sudo apt update && sudo apt install -y nodejs npm git
# Install TensorFlow GPU system drivers (CUDA/cuDNN automatically handled by TFJS-Node-GPU if configured)

```


3. **Upload / Clone Project:**
```bash
git clone <your-repo-url>
cd chess-ai
npm install

```


4. **Execute High-Capacity Cloud Build:**
```bash
npx tsc
node dist/dataset.js
# Run training detached so it doesn't stop if your SSH disconnects:
nohup node dist/train.js > train.log 2>&1 &

```


5. **Monitor Live Training Progress:**
```bash
tail -f train.log

```


6. **Download Mobile Bundle:** Once training completes, download the `model_output/` folder (`vocab.json`, `model.json`, `weights.bin`) directly into your React Native app's local assets directory.

---

## 📱 Mobile App (React Native) Integration Notice

When deploying the exported `model_output/` bundle into your React Native application:

* Load the brain locally using `@tensorflow/tfjs-react-native` and `bundleResourceIO`.
* Keep `MAX_SEQUENCE_LENGTH` identical between your app's local tokenizer and the value used during compilation.
* Use the consecutive deduplication filter (included in `chat.ts`) inside your mobile UI rendering handler to ensure 100% human-sounding, stutter-free speech.

```
