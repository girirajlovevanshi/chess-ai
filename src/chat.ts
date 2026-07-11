import * as tf from '@tensorflow/tfjs';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { ChessAITokenizer } from './tokenizer.js';

// ── GLOBAL PRODUCTION TARGET CONSTRAINTS ──────────────────────────────────
// Must explicitly match the sequence length set in dataset.ts and train.ts
const MAX_SEQUENCE_LENGTH = 384;
const VOCAB_PATH = './model_output/vocab.json';
const MODEL_DIR = './model_output';

const tokenizer = new ChessAITokenizer();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

/**
 * Loads the compiled model topology, binary weights, and exact vocabulary map from disk.
 */
async function loadProductionAI(): Promise<tf.LayersModel> {
    console.log("[Inference Engine] Loading neural architecture and vocabulary from disk...");

    if (!fs.existsSync(VOCAB_PATH)) {
        throw new Error(`[Critical Error] Missing '${VOCAB_PATH}'. Run your training sequence first.`);
    }

    // 1. Load the immutable vocabulary map exported directly from train.ts
    const vocabPayload = JSON.parse(fs.readFileSync(VOCAB_PATH, 'utf-8'));
    tokenizer.wordToId = vocabPayload.wordToId;
    tokenizer.idToWord = vocabPayload.idToWord;
    const vocabSize = Object.keys(tokenizer.wordToId).length;

    // 2. Custom Pure JS Node Loader (Bypasses C++ binding constraints)
    const model = await tf.loadLayersModel({
        load: async () => {
            const modelJsonPath = path.join(MODEL_DIR, 'model.json');
            const weightsBinPath = path.join(MODEL_DIR, 'weights.bin');

            if (!fs.existsSync(modelJsonPath) || !fs.existsSync(weightsBinPath)) {
                throw new Error(`[Critical Error] Missing model artifacts inside '${MODEL_DIR}'.`);
            }

            const modelJson = JSON.parse(fs.readFileSync(modelJsonPath, 'utf-8'));
            const weightBuffer = fs.readFileSync(weightsBinPath);

            const weightData = weightBuffer.buffer.slice(
                weightBuffer.byteOffset,
                weightBuffer.byteOffset + weightBuffer.byteLength
            ) as ArrayBuffer;

            return {
                modelTopology: modelJson.modelTopology || modelJson,
                weightSpecs: modelJson.weightsManifest[0].weights,
                weightData: weightData
            };
        }
    });

    console.log(`[Inference Engine] AI successfully loaded! Vocabulary Matrix: ${vocabSize} words ready.\n`);
    return model;
}

/**
 * Executes a single forward inference pass to generate clean commentary.
 */
async function generateResponse(model: tf.LayersModel, prompt: string): Promise<void> {
    // Encode input prompt using the exact production sequence window
    const inputTokens = tokenizer.encode(prompt, MAX_SEQUENCE_LENGTH);
    const inputTensor = tf.tensor2d([inputTokens], [1, MAX_SEQUENCE_LENGTH]);

    const predictions = model.predict(inputTensor) as tf.Tensor;
    const predictedIds = Array.from(await predictions.squeeze().argMax(-1).data());

    // Dispose of memory tensors immediately after prediction to prevent RAM bloat
    inputTensor.dispose();
    predictions.dispose();

    // 1. Map numerical IDs directly to vocabulary words and filter out systemic control tokens
    const words = predictedIds
        .map(id => tokenizer.idToWord[id] || '')
        .filter(word => !['<PAD>', '<START>', '<END>', '<UNK>', ''].includes(word));

    // 2. Consecutive deduplication filter (Stops repetitive word stuttering like 'advisor advisor')
    const cleanWords = words.filter((word, idx) => word !== words[idx - 1]);

    // 3. Format spacing cleanly around punctuation and chess notation
    const finalSentence = cleanWords
        .join(' ')
        .replace(/\s+([.,!?\])\]])/g, '$1')
        .trim();

    console.log(`AI: ${finalSentence || "[Could not generate confidence score]"}\n`);
}

/**
 * Master interactive chat loop for terminal testing.
 */
async function startInteractivePlayground(): Promise<void> {
    try {
        const model = await loadProductionAI();

        console.log("====================================================================");
        console.log(" V1 PRODUCTION CHESS AI INTERACTIVE PLAYGROUND                      ");
        console.log("====================================================================");
        console.log("Try pasting test prompts representing your app's core personas:");
        console.log(" 1. <EN> [MODE:OPPONENT] [STAGE:USER_MOVE] [SITUATION:BLUNDER] EVAL:-5.2");
        console.log(" 2. <HI> [MODE:OPPONENT] [STAGE:USER_MOVE] [SITUATION:CHECK] EVAL:0.0");
        console.log(" 3. <EN> [MODE:ADVISOR] [STAGE:USER_MOVE] [SITUATION:NORMAL] EVAL:+0.4");
        console.log(" 4. <EN> [MODE:CHATBOT] [STAGE:STARTUP] USER:hello tell me who you are");
        console.log(" 5. <HI> [MODE:TEACHER] [STAGE:AI_PONDER] [SITUATION:PUZZLE_HINT]");
        console.log("Type 'exit' to shut down the playground.");
        console.log("====================================================================\n");

        const askQuestion = () => {
            rl.question('You (Context Prompt): ', async (prompt) => {
                const cleanPrompt = prompt.trim();
                if (cleanPrompt.toLowerCase() === 'exit') {
                    console.log("[Inference Engine] Shutting down playground. Good luck with the app release!");
                    rl.close();
                    process.exit(0);
                }
                if (cleanPrompt.length > 0) {
                    await generateResponse(model, cleanPrompt);
                }
                askQuestion();
            });
        };

        askQuestion();
    } catch (err) {
        console.error("\n[CRITICAL FAILURE] Inference playground aborted:", err);
        rl.close();
        process.exit(1);
    }
}

startInteractivePlayground();