import * as tf from '@tensorflow/tfjs';
import * as fs from 'fs';

// 1. DATA LOADING & PREPARATION
async function loadData() {
    console.log("Loading training data from disk...");
    const rawData = fs.readFileSync('./training_data.json', 'utf-8');
    const parsedData = JSON.parse(rawData);

    const vocabSize = parsedData.vocabSize;
    const dataset = parsedData.dataset;

    // We convert our standard JavaScript arrays into TensorFlow 2D Tensors (Matrices)
    // Shape: [numberOfExamples, sequenceLength]
    const inputs = [];
    const targets = [];

    for (const row of dataset) {
        inputs.push(row.input);
        targets.push(row.target);
    }

    const inputTensor = tf.tensor2d(inputs, [inputs.length, inputs[0].length]);
    const targetTensor = tf.tensor2d(targets, [targets.length, targets[0].length]).expandDims(-1);

    console.log(`Data loaded! Total Examples: ${inputs.length}`);
    console.log(`Vocabulary Size: ${vocabSize}`);

    return { inputTensor, targetTensor, vocabSize };
}

// 2. NEURAL NETWORK ARCHITECTURE
function buildModel(vocabSize: number, sequenceLength: number) {
    console.log("Building the AI Architecture (Stacked LSTM)...");
    const model = tf.sequential();

    // Layer 1: Embedding
    // Translates our token IDs (e.g., 345) into dense vectors (e.g., [0.1, -0.4, ...])
    model.add(tf.layers.embedding({
        inputDim: vocabSize,
        outputDim: 64, // The depth of the AI's "understanding" per word
        inputLength: sequenceLength
    }));

    // Layer 2: First LSTM (Memory)
    // returnSequences: true means it passes the full history to the next layer
    model.add(tf.layers.lstm({
        units: 128,
        returnSequences: true
    }));

    // Layer 3: Second LSTM (Deep Context)
    // Stacking LSTMs makes the AI significantly smarter at understanding long FEN strings
    model.add(tf.layers.lstm({
        units: 128,
        returnSequences: true
    }));

    // Layer 4: Dense Output
    // Maps the LSTM thoughts back to our vocabulary to predict the correct words
    model.add(tf.layers.dense({
        units: vocabSize,
        activation: 'softmax' // Softmax converts the output into percentages (probabilities)
    }));

    // Compile the brain with an optimizer and a loss function
    model.compile({
        optimizer: tf.train.adam(0.01), // Adam is a smart algorithm that adjusts learning speed
        loss: 'sparseCategoricalCrossentropy', // Perfect for text generation math
        metrics: ['accuracy']
    });

    model.summary(); // This will print a cool architectural diagram in your terminal
    return model;
}

// 3. THE TRAINING LOOP
async function runTraining() {
    const { inputTensor, targetTensor, vocabSize } = await loadData();
    const sequenceLength = inputTensor.shape[1] as number;

    const model = buildModel(vocabSize, sequenceLength);

    console.log("\nStarting the training process... This may take a minute.");

    // model.fit() is where the actual learning happens
    await model.fit(inputTensor, targetTensor, {
        epochs: 20,           // How many times it reads the entire dataset
        batchSize: 64,        // How many examples it looks at simultaneously
        shuffle: true,        // Mixes up the games so it doesn't memorize them in order
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                // This gives us a live update of the AI getting smarter
                console.log(`Epoch ${epoch + 1}/10 - Loss: ${logs?.loss.toFixed(4)} - Accuracy: ${(logs?.acc! * 100).toFixed(2)}%`);
            }
        }
    });

    console.log("\nTraining complete! AI has successfully learned chess commentary.");

    // 4. EXPORTING THE 
    const outputDir = './model_output';
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    console.log(`Saving the trained brain to: ${outputDir}`);
    // We pass a custom IOHandler to TensorFlow so pure JS knows how to write to Node's hard drive
    await model.save(tf.io.withSaveHandler(async (artifacts) => {
        // 1. Save the JSON architecture
        fs.writeFileSync(
            `${outputDir}/model.json`,
            JSON.stringify(artifacts.modelTopology, null, 2)
        );

        // 2. Save the weights manifest (tells TF where to find the binary numbers)
        const weightManifest = [{
            paths: ['weights.bin'],
            weights: artifacts.weightSpecs
        }];

        const modelJson = JSON.parse(fs.readFileSync(`${outputDir}/model.json`, 'utf-8'));
        modelJson.weightsManifest = weightManifest;
        fs.writeFileSync(`${outputDir}/model.json`, JSON.stringify(modelJson, null, 2));

        // 3. Save the actual neural weights into a binary .bin file
        if (artifacts.weightData) {
            fs.writeFileSync(
                `${outputDir}/weights.bin`,
                Buffer.from(artifacts.weightData as ArrayBuffer)
            );
        }

        return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: 'JSON' } };
    }));

    console.log("Model successfully exported! Look inside the model_output folder!");
}

// Start the sequence
runTraining();