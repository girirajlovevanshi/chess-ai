"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.assembleProductionDataset = assembleProductionDataset;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const tokenizer_js_1 = require("./tokenizer.js");
// ── GLOBAL PRODUCTION PIPELINE CONFIGURATION ──
// Scaled to 384 to guarantee deep analytical FEN explanations and classroom
// teaching lessons never get clipped or truncated mid-sentence during training.
const MAX_SEQUENCE_LENGTH = 384;
const DATA_CHUNKS_DIR = './data_chunks';
const OUTPUT_DATA_PATH = './training_data.json';
/**
 * Scans the external data_chunks/ directory, reads every decoupled JSON file,
 * and dynamically builds a complete, hallucination-free vocabulary map.
 */
function compileVocabulary(tokenizer, rawRows) {
    console.log(`[Vocabulary] Fitting dictionary across ${rawRows.length} total chunk rows...`);
    const allTextBuffer = [];
    for (const row of rawRows) {
        // Fit on both target commentary AND input FEN/algebraic notation prompts
        allTextBuffer.push(row.input);
        allTextBuffer.push(row.target);
    }
    tokenizer.fitOnText(allTextBuffer);
    console.log(`[Vocabulary] Complete! Registered Master Vocabulary Size: ${tokenizer.vocabSize} tokens.`);
}
/**
 * Reads all decoupled data chunks from disk, merges them into a single raw array,
 * and automatically oversamples conversational/teaching rows to prevent data imbalance.
 */
function ingestDataChunks() {
    console.log(`[Data Ingestion] Scanning directory '${DATA_CHUNKS_DIR}'...`);
    if (!fs.existsSync(DATA_CHUNKS_DIR)) {
        throw new Error(`[Critical Error] Missing target directory '${DATA_CHUNKS_DIR}'. Create it and add your JSON chunks.`);
    }
    const files = fs.readdirSync(DATA_CHUNKS_DIR);
    const jsonFiles = files.filter(f => path.extname(f).toLowerCase() === '.json');
    if (jsonFiles.length === 0) {
        throw new Error(`[Critical Error] No JSON data files found inside '${DATA_CHUNKS_DIR}'.`);
    }
    const aggregatedRows = [];
    for (const file of jsonFiles) {
        const filePath = path.join(DATA_CHUNKS_DIR, file);
        console.log(`[Data Ingestion] Ingesting chunk: ${file}`);
        try {
            const rawContent = fs.readFileSync(filePath, 'utf-8');
            const parsedChunk = JSON.parse(rawContent);
            if (!Array.isArray(parsedChunk)) {
                console.warn(`[Warning] Chunk '${file}' is not a valid JSON array. Skipping.`);
                continue;
            }
            for (const row of parsedChunk) {
                if (row && typeof row.input === 'string' && typeof row.target === 'string') {
                    const cleanInput = row.input.trim();
                    const cleanTarget = row.target.trim();
                    // Standard push
                    aggregatedRows.push({ input: cleanInput, target: cleanTarget });
                    // OVERSAMPLING BOOST: If it's a teacher lesson, puzzle hint, or chatbot QA,
                    // duplicate it 15 times in the training pipeline so standard chess moves don't drown it out!
                    const isConversationalOrTeaching = cleanInput.includes('[MODE:TEACHER]') ||
                        cleanInput.includes('[MODE:CHATBOT]') ||
                        cleanInput.includes('[SITUATION:GREETING]') ||
                        cleanInput.includes('[SITUATION:IDENTITY]') ||
                        cleanInput.includes('[SITUATION:PUZZLE_HINT]');
                    if (isConversationalOrTeaching) {
                        for (let boost = 0; boost < 14; boost++) {
                            aggregatedRows.push({ input: cleanInput, target: cleanTarget });
                        }
                    }
                }
            }
        }
        catch (err) {
            console.error(`[Error] Failed to parse JSON chunk '${file}':`, err);
        }
    }
    console.log(`[Data Ingestion] Successfully aggregated and balanced ${aggregatedRows.length} total rows from ${jsonFiles.length} chunk files.`);
    return aggregatedRows;
}
/**
 * Transforms raw text strings into padded mathematical tensor matrices.
 */
function buildTensorMatrices(tokenizer, rawRows) {
    console.log(`[Matrix Encoding] Converting text strings into uniform sequence matrices (Max Len: ${MAX_SEQUENCE_LENGTH})...`);
    const encodedDataset = [];
    for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i];
        // Encode input prompt and target response using the production sequence window
        const inputTokens = tokenizer.encode(row.input, MAX_SEQUENCE_LENGTH);
        const targetTokens = tokenizer.encode(row.target, MAX_SEQUENCE_LENGTH);
        encodedDataset.push({
            input: inputTokens,
            target: targetTokens
        });
        if ((i + 1) % 50000 === 0) {
            console.log(`[Matrix Encoding] Processed ${i + 1}/${rawRows.length} rows...`);
        }
    }
    return encodedDataset;
}
/**
 * Master execution sequence for preparing the dataset.
 */
function assembleProductionDataset() {
    console.log("\n========================================================");
    console.log("       INITIALIZING V1 CHESS AI DATASET ASSEMBLER       ");
    console.log("========================================================\n");
    const tokenizer = new tokenizer_js_1.ChessAITokenizer();
    // 1. Ingest all decoupled data chunk files from disk with automatic balancing
    const rawRows = ingestDataChunks();
    if (rawRows.length === 0) {
        throw new Error("[Critical Error] Aggregated dataset is empty. Aborting compilation.");
    }
    // 2. Expand vocabulary dynamically across all personas and languages
    compileVocabulary(tokenizer, rawRows);
    // 3. Encode text strings into numerical sequence arrays
    const encodedDataset = buildTensorMatrices(tokenizer, rawRows);
    // 4. Assemble final compilation payload
    const finalPayload = {
        vocabSize: tokenizer.vocabSize,
        wordToId: tokenizer.wordToId,
        idToWord: tokenizer.idToWord,
        dataset: encodedDataset
    };
    // 5. Write artifacts safely to disk
    console.log(`[Exporting] Serializing compiled dataset to '${OUTPUT_DATA_PATH}'...`);
    fs.writeFileSync(OUTPUT_DATA_PATH, JSON.stringify(finalPayload, null, 2), 'utf-8');
    console.log("\n========================================================");
    console.log(` SUCCESS! Compiled ${encodedDataset.length} rows ready for model training! `);
    console.log("========================================================\n");
}
// Automatically execute if run directly via Node (supports both CommonJS and ESM paths)
if (require.main === module || (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('dist/dataset.js'))) {
    try {
        assembleProductionDataset();
        process.exit(0);
    }
    catch (err) {
        console.error("\n[CRITICAL FAILURE] Dataset assembly aborted:", err);
        process.exit(1);
    }
}
