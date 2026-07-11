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
const chess_js_1 = require("chess.js");
const fs = __importStar(require("fs"));
const tokenizer_js_1 = require("./tokenizer.js");
// Node already knows what require is, so we can just use it directly
const stockfish = require('stockfish');
const tokenizer = new tokenizer_js_1.ChessAITokenizer();
// 1. COMMENTARY TEMPLATES (THE AI'S MEMORY BANK)
// 1. COMMENTARY TEMPLATES (THE AI'S MEMORY BANK)
const templates = {
    en: {
        greeting: [
            "Hello! I am doing great. I am your AI Chess Assistant, ready to play!",
            "Hi there! How are you? I am a Chess AI powered by neural networks. Let's analyze a game.",
            "Greetings! I am doing well. I'm a chess AI trained on Stockfish evaluations. How can I help you today?"
        ],
        identity: [
            "I am a Universal Chess AI created to evaluate board positions and explain tactics.",
            "I am an artificial intelligence neural network trained to help you improve your chess game.",
            "I am your personal chess advisor and opponent, built with TypeScript and TensorFlow.js."
        ],
        blunder: [
            "That is a massive blunder.",
            "Terrible move. You just threw away your advantage.",
            "What a catastrophic mistake.",
            "You left a key piece completely undefended! Massive blunder.",
            "That move gives away the game. You need to be more careful!"
        ],
        check: [
            "Check! You need to defend your king immediately.",
            "The king is under direct fire.",
            "Watch out, your king is exposed to attack!",
            "Checkmate threat! Move your king or block the check right now."
        ],
        normal: [
            "A solid development move.",
            "Controlling the center safely.",
            "Standard positional play.",
            "Good piece development, preparing for the mid-game battle.",
            "A balanced and cautious strategic move."
        ]
    },
    hi: {
        greeting: [
            "नमस्ते! मैं बिल्कुल ठीक हूँ। मैं आपका चेस AI असिस्टेंट हूँ, आइए शतरंज खेलते हैं!",
            "हेलो! आप कैसे हैं? मैं एक चेस AI हूँ जिसे न्यूरल नेटवर्क से बनाया गया है। आइए खेल का विश्लेषण करें।",
            "नमस्कार! मैं बहुत अच्छा हूँ। मैं एक AI हूँ जो आपकी शतरंज की चालों को बेहतर बनाने में मदद करता हूँ।"
        ],
        identity: [
            "मैं एक यूनिवर्सल चेस AI हूँ जिसे शतरंज की चालों और रणनीतियों को समझने के लिए बनाया गया है।",
            "मैं एक आर्टिफिशियल इंटेलिजेंस हूँ जो आपके शतरंज के खेल को बेहतर बनाने में मदद करता हूँ।",
            "मैं आपका पर्सनल चेस एडवाइजर हूँ, जिसे टाइपस्क्रिप्ट और मशीन लर्निंग द्वारा बनाया गया है।"
        ],
        blunder: [
            "यह एक बहुत बड़ी भूल थी।",
            "आप क्या कर रहे हैं? आपने पूरा खेल गंवा दिया।",
            "यहाँ एक गंभीर चूक हुई है।",
            "आपने बिना किसी सुरक्षा के एक महत्वपूर्ण मोहरा छोड़ दिया! बहुत बड़ी गलती।",
            "इस चाल से मैच हाथ से निकल सकता है। आपको और सावधान रहने की जरूरत है!"
        ],
        check: [
            "शह! अपने राजा को तुरंत बचाएं।",
            "राजा पर सीधा हमला हुआ है।",
            "राजा खतरे में है!",
            "शह! अपने राजा को सुरक्षित स्थान पर ले जाएं या बीच में कोई मोहरा रखें।"
        ],
        normal: [
            "एक मजबूत और सोची-समझी चाल।",
            "केंद्र पर सुरक्षित नियंत्रण बनाना।",
            "सामान्य रणनीतिक कदम।",
            "मोहरों का अच्छा विकास, खेल के मध्य भाग की शानदार तैयारी।",
            "एक संतुलित और सुरक्षित रणनीतिक चाल।"
        ]
    }
};
// Feed templates into the tokenizer so it registers the word vocabulary
const allPhrases = [];
for (const lang of Object.values(templates)) {
    for (const situations of Object.values(lang)) {
        allPhrases.push(...situations);
    }
}
tokenizer.fitOnText(allPhrases);
// 2. ENGINE INITIALIZATION & EVALUATION
/**
 * Initializes Stockfish safely, handling promises and Node version quirks.
 */
async function initEngine() {
    try {
        let engine = stockfish();
        // If the newer stockfish version returns a promise, await it
        if (engine && typeof engine.then === 'function') {
            engine = await engine;
        }
        return engine;
    }
    catch (e) {
        console.warn("Stockfish initialization failed. Using Fallback Engine.");
        return null;
    }
}
/**
 * Fallback algorithm: If Stockfish fails on Node 24, we calculate the raw
 * material advantage on the board to generate our training evaluations.
 */
function getMaterialEvaluation(fen) {
    const pieceValues = {
        'p': -1, 'n': -3, 'b': -3, 'r': -5, 'q': -9,
        'P': 1, 'N': 3, 'B': 3, 'R': 5, 'Q': 9
    };
    let score = 0;
    // Only analyze the board layout part of the FEN
    const board = fen.split(' ')[0];
    for (const char of board) {
        if (pieceValues[char]) {
            score += pieceValues[char];
        }
    }
    return score;
}
/**
 * Sends a FEN string to Stockfish. If Stockfish is broken, uses the fallback.
 */
function getEvaluation(engine, fen) {
    return new Promise((resolve) => {
        // Bulletproof check: If engine is missing or postMessage doesn't exist, use fallback
        if (!engine || typeof engine.postMessage !== 'function') {
            resolve(getMaterialEvaluation(fen));
            return;
        }
        engine.onmessage = (line) => {
            const output = typeof line === 'string' ? line : line.data;
            if (!output)
                return;
            if (output.includes('score cp')) {
                const match = output.match(/score cp (-?\d+)/);
                if (match) {
                    engine.onmessage = null;
                    resolve(parseInt(match[1]) / 100);
                }
            }
            else if (output.includes('score mate')) {
                const match = output.match(/score mate (-?\d+)/);
                if (match) {
                    engine.onmessage = null;
                    resolve(output.includes('mate -') ? -99 : 99);
                }
            }
        };
        try {
            engine.postMessage(`position fen ${fen}`);
            engine.postMessage('go depth 10');
        }
        catch (e) {
            // If postMessage throws an error, fallback immediately
            resolve(getMaterialEvaluation(fen));
        }
    });
}
// 3. THE DATA GENERATION LOOP
/**
 * Simulates self-play matches and encodes the results for neural network training.
 */
async function generateDataset(numGames = 3) {
    console.log("Initializing Chess Engine...");
    const engine = await initEngine();
    console.log(`Starting generation of ${numGames} synthetic games...`);
    const dataset = [];
    for (let g = 0; g < numGames; g++) {
        const game = new chess_js_1.Chess();
        const history = [];
        let previousEval = 0;
        // Simulate the game up to a max of 40 moves to keep it snappy
        while (!game.isGameOver() && game.history().length < 40) {
            const moves = game.moves();
            const randomMove = moves[Math.floor(Math.random() * moves.length)];
            game.move(randomMove);
            history.push(randomMove);
            const currentFen = game.fen();
            // Get evaluation (Stockfish or Material Fallback)
            const currentEval = await getEvaluation(engine, currentFen);
            const evalDelta = currentEval - previousEval;
            previousEval = currentEval;
            // Classify the board state
            let situation = "normal";
            if (game.inCheck()) {
                situation = "check";
            }
            else if (Math.abs(evalDelta) > 3) {
                situation = "blunder";
            }
            const languages = ['<EN>', '<HI>'];
            const modes = ['[MODE:OPPONENT]', '[MODE:ADVISOR]'];
            // Generate matrix rows for the Neural Network
            for (const lang of languages) {
                for (const mode of modes) {
                    const langKey = lang === '<EN>' ? 'en' : 'hi';
                    const targetPhrases = templates[langKey][situation];
                    for (const phrase of targetPhrases) {
                        // The contextual prefix that gives our AI situational awareness
                        const prompt = `${lang} ${mode} [STAGE:USER_MOVE] [EVAL:${currentEval}] [SITUATION:${situation.toUpperCase()}] [MOVE:${randomMove}] HIST:${history.slice(-5).join(' ')} FEN:${currentFen}`;
                        dataset.push({
                            input: tokenizer.encode(prompt),
                            target: tokenizer.encode(`<START> ${phrase} <END>`)
                        });
                    }
                }
            }
        }
        console.log(`Game ${g + 1} finalized. Current data rows: ${dataset.length}`);
    }
    // Inject conversational training rows directly into the dataset
    console.log("Adding conversational personality data...");
    const languages = ['<EN>', '<HI>'];
    for (const lang of languages) {
        const langKey = lang === '<EN>' ? 'en' : 'hi';
        for (const phrase of templates[langKey].greeting) {
            dataset.push({
                input: tokenizer.encode(`${lang} [SITUATION:GREETING]`),
                target: tokenizer.encode(`<START> ${phrase} <END>`)
            });
        }
        for (const phrase of templates[langKey].identity) {
            dataset.push({
                input: tokenizer.encode(`${lang} [SITUATION:IDENTITY]`),
                target: tokenizer.encode(`<START> ${phrase} <END>`)
            });
        }
    }
    // Save the training array directly to disk
    // Save data AND the exact tokenizer memory maps directly to disk
    fs.writeFileSync('./training_data.json', JSON.stringify({
        vocabSize: tokenizer.vocabSize,
        wordToId: tokenizer.wordToId, // SAVING THE WORD DICTIONARY!
        idToWord: tokenizer.idToWord, // SAVING THE REVERSE DICTIONARY!
        dataset
    }, null, 2));
    console.log(`\nSuccess! Created ${dataset.length} training rows inside training_data.json`);
    process.exit(0);
}
// Start the process (Generates 5 games for a solid dataset)
generateDataset(5);
