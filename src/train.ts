import * as tf from '@tensorflow/tfjs';
import * as fs from 'fs';
import * as path from 'path';
import { CompiledDatasetPayload } from './dataset.js';

// ── GLOBAL PRODUCTION TARGET CONSTRAINTS ──────────────────────────────────
const INPUT_DATA_PATH = './training_data.json';
const OUTPUT_DIR = './model_output';

/**
 * Loads the compiled training dataset and vocabulary payload from disk.
 */
async function loadProductionData(): Promise<{
    inputTensor: tf.Tensor2D,
    targetTensor: tf.Tensor3D,
    vocabSize: number,
    sequenceLength: number,
    payload: CompiledDatasetPayload
}> {
    console.log(`[Data Ingestion] Loading compiled dataset from '${INPUT_DATA_PATH}'...`);

    if (!fs.existsSync(INPUT_DATA_PATH)) {
        throw new Error(`[Critical Error] Missing '${INPUT_DATA_PATH}'. Run 'node dist/dataset.js' first to compile your data chunks.`);
    }

    const rawData = fs.readFileSync(INPUT_DATA_PATH, 'utf-8');
    const payload: CompiledDatasetPayload = JSON.parse(rawData);

    const vocabSize = payload.vocabSize;
    const dataset = payload.dataset;

    if (!dataset || dataset.length === 0) {
        throw new Error("[Critical Error] The loaded dataset array is empty. Aborting training.");
    }

    const inputs: number[][] = [];
    const targets: number[][] = [];

    for (const row of dataset) {
        inputs.push(row.input);
        targets.push(row.target);
    }

    const sequenceLength = inputs[0].length;
    console.log(`[Data Ingestion] Dataset loaded successfully! Total Matrix Rows: ${inputs.length}`);
    console.log(`[Data Ingestion] Registered Vocabulary Size: ${vocabSize} | Sequence Window: ${sequenceLength}`);

    // 1. Compile Input Tensor (2D Matrix: [batchSize, sequenceLength])
    const inputTensor = tf.tensor2d(inputs, [inputs.length, sequenceLength], 'int32');

    // 2. NATIVE MEMORY OPTIMIZATION: Use tf.oneHot on the backend hardware instead of JS array loops!
    // This prevents Node.js fatal heap out-of-memory crashes when processing 500,000+ rows on Google Cloud.
    console.log("[Data Ingestion] Allocating categorical One-Hot target matrices in native hardware memory...");
    const targetIndicesTensor = tf.tensor2d(targets, [targets.length, sequenceLength], 'int32');
    const targetTensor = tf.oneHot(targetIndicesTensor, vocabSize) as tf.Tensor3D;

    // Clean up intermediate indices tensor to free RAM immediately
    targetIndicesTensor.dispose();

    return { inputTensor, targetTensor, vocabSize, sequenceLength, payload };
}

/**
 * Compiles a production-grade Bidirectional Stacked Architecture.
 */
function buildProductionModel(vocabSize: number, sequenceLength: number): tf.LayersModel {
    console.log("[Architecture] Compiling Stacked Bidirectional Sequence Brain...");
    const model = tf.sequential();

    // Layer 1: Word/Character Embedding Matrix
    model.add(tf.layers.embedding({
        inputDim: vocabSize,
        outputDim: 128, // High dimensional mapping for chess concepts & Hindi/English grammar
        inputLength: sequenceLength
    }));

    // Layer 2: First Bidirectional LSTM (Reads FEN and history forwards and backwards)
    model.add(tf.layers.bidirectional({
        layer: tf.layers.lstm({ units: 128, returnSequences: true })
    }));

    // Layer 3: Deep Context Bidirectional LSTM (Locks down persona tone & teaching Socratic logic)
    model.add(tf.layers.bidirectional({
        layer: tf.layers.lstm({ units: 128, returnSequences: true })
    }));

    // Layer 4: Time-Distributed Dense Output (Predicts exact next vocabulary token per step)
    model.add(tf.layers.timeDistributed({
        layer: tf.layers.dense({ units: vocabSize, activation: 'softmax' })
    }));

    model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
    });

    model.summary();
    return model;
}

/**
 * Master execution sequence for neural network training and mobile artifact exporting.
 */
async function runProductionTrainingSequence(): Promise<void> {
    console.log("\n========================================================");
    console.log("       INITIALIZING V1 CHESS AI TRAINING PIPELINE       ");
    console.log("========================================================\n");

    const { inputTensor, targetTensor, vocabSize, sequenceLength, payload } = await loadProductionData();

    const model = buildProductionModel(vocabSize, sequenceLength);

    console.log("\n[Training] Starting neural network optimization... This will scale cleanly on Cloud GPUs.");

    // Set to 15 epochs for local Mac validation. When deploying to Google Cloud,
    // simply change epochs to 25 or 30 for deep convergence on massive datasets!
    await model.fit(inputTensor, targetTensor, {
        epochs: 15,
        batchSize: 32,
        shuffle: true,
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                console.log(`Epoch ${epoch + 1}/15 - Loss: ${logs?.loss.toFixed(4)} - Accuracy: ${(logs?.acc! * 100).toFixed(2)}%`);
            }
        }
    });

    console.log("\n[Training] Network optimization complete! Serializing production artifacts...");

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // 1. Save exact Tokenizer Vocabulary directly to model_output/vocab.json
    // This ensures your mobile app or local chat runner has the exact same word dictionary!
    const vocabularyPayload = {
        vocabSize: payload.vocabSize,
        wordToId: payload.wordToId,
        idToWord: payload.idToWord
    };
    fs.writeFileSync(path.join(OUTPUT_DIR, 'vocab.json'), JSON.stringify(vocabularyPayload, null, 2), 'utf-8');
    console.log(`[Exporting] Saved immutable vocabulary dictionary to '${path.join(OUTPUT_DIR, 'vocab.json')}'.`);

    // 2. BULLETPROOF EXPORT: Use official TFJS SaveHandler to guarantee weightsManifest exists!
    await model.save(tf.io.withSaveHandler(async (artifacts) => {
        // Save model topology and weight specifications together
        const modelJsonPayload = {
            modelTopology: artifacts.modelTopology,
            weightsManifest: [{
                paths: ['weights.bin'],
                weights: artifacts.weightSpecs
            }]
        };
        fs.writeFileSync(path.join(OUTPUT_DIR, 'model.json'), JSON.stringify(modelJsonPayload, null, 2), 'utf-8');
        console.log(`[Exporting] Saved neural topology and weights manifest to '${path.join(OUTPUT_DIR, 'model.json')}'.`);

        // Save raw binary mathematical weights buffer
        if (artifacts.weightData) {
            fs.writeFileSync(
                path.join(OUTPUT_DIR, 'weights.bin'),
                Buffer.from(artifacts.weightData as ArrayBuffer)
            );
            console.log(`[Exporting] Saved binary mathematical weights to '${path.join(OUTPUT_DIR, 'weights.bin')}'.`);
        }

        return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: 'JSON' } };
    }));

    // Clean up allocated system memory tensors to prevent RAM saturation
    inputTensor.dispose();
    targetTensor.dispose();

    console.log("\n========================================================");
    console.log(" SUCCESS! V1 Chess AI Brain Exported & Ready for Chat!  ");
    console.log("========================================================\n");
    process.exit(0);
}

// Execute training sequence
runProductionTrainingSequence().catch(err => {
    console.error("\n[CRITICAL FAILURE] Training pipeline aborted:", err);
    process.exit(1);
});