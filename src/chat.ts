import * as tf from '@tensorflow/tfjs';
import { ChessAITokenizer } from './tokenizer.js';
import * as fs from 'fs';
import * as readline from 'readline';

const tokenizer = new ChessAITokenizer();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

/**
 * Loads the trained brain and rebuilds the tokenizer vocabulary from disk
 */
async function loadAI() {
    console.log("Loading AI weights and vocabulary from disk...");
    
    // 1. Load the EXACT dictionary map generated during training
    const parsedData = JSON.parse(fs.readFileSync('./training_data.json', 'utf-8'));
    tokenizer.wordToId = parsedData.wordToId;
    tokenizer.idToWord = parsedData.idToWord;

    // 2. Custom Pure JS Node Loader
    const model = await tf.loadLayersModel({
        load: async () => {
            const modelJson = JSON.parse(fs.readFileSync('./model_output/model.json', 'utf-8'));
            const weightBuffer = fs.readFileSync('./model_output/weights.bin');
            
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

    console.log(`AI successfully loaded! Vocabulary Size: ${tokenizer.vocabSize} words ready to chat!\n`);
    return model;
}

/**
 * Sequence-to-Sequence Generation
 * The LSTM translates the entire chess board state into a full sentence in ONE forward pass!
 */
async function generateResponse(model: tf.LayersModel, prompt: string) {
    // 1. Convert our text prompt into integer token IDs
    const inputTokens = tokenizer.encode(prompt);

    // Convert the prompt into a 2D tensor [1, sequenceLength]
    const inputTensor = tf.tensor2d([inputTokens], [1, inputTokens.length]);

    // 2. Predict the ENTIRE sentence in a single lightning-fast calculation
    const predictions = model.predict(inputTensor) as tf.Tensor;

    // Grab the winning word IDs across every single time step from 0 to 150
    const predictedIds = Array.from(await predictions.squeeze().argMax(-1).data());

    // Cleanup tensors immediately to keep memory clean
    inputTensor.dispose();
    predictions.dispose();

    // 3. Decode the full ID sequence back into text
    let rawSentence = tokenizer.decode(predictedIds);

    // 4. Clean up the output by chopping off padding and special control tags
    if (rawSentence.includes('<END>')) {
        rawSentence = rawSentence.split('<END>')[0];
    }

    const finalSentence = rawSentence
        .replace(/<START>/g, '')
        .replace(/<PAD>/g, '')
        .replace(/<UNK>/g, '')
        .trim();

    console.log(`AI: ${finalSentence || "[Could not generate confidence score]"}\n`);
}

async function startChat() {
    const model = await loadAI();

    console.log("==================================================");
    console.log("Try pasting a context string like this:");
    console.log("<EN> [MODE:OPPONENT] [STAGE:USER_MOVE] [EVAL:-5] [SITUATION:BLUNDER]");
    console.log("==================================================\n");

    const askQuestion = () => {
        rl.question('You (Context Prompt): ', async (prompt) => {
            if (prompt.toLowerCase() === 'exit') {
                rl.close();
                return;
            }
            await generateResponse(model, prompt);
            askQuestion();
        });
    };

    askQuestion();
}

startChat();