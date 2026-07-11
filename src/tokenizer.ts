export class ChessAITokenizer {
    // immutable control tags that guide the ai;s persona and language
    private specialTokens : string[] = [
        '<START>', '<END>', '<PAD>',
        '<EN>', '<HI>',
        '[MODE:OPPONENT]', '[MODE:ADVISOR]', '[MODE:CHATBOT]',
        '[STAGE:USER_MOVE]','[STAGE:AI_PONDER]','[STAGE:AI_MOVE]','[STAGE:STARTUP]'
    ];

    public wordToId: Record<string, number> = {};
    public idToWord: Record<number, string> = {};
    private nextId: number = 0;

    constructor(){
        this.initVocabulary();
    }

    // Initializes with the base vocabulary with the static controal tags  
    // every single structural charcter that can appear in the chess FEN or move notation
    private initVocabulary(): void{
        // Register Speical tokens 
        this.specialTokens.forEach(token =>{
            this.wordToId[token] = this.nextId;
            this.idToWord[this.nextId] = token;
            this.nextId++;
        });

        // Register every single vaild chess FEN and algebraic notation character
        const baseChessChars = 'abcdefgh12345678RNBQKPrnbqkp/ -+x#=0123456789:.[]_'.split('');
        baseChessChars.forEach(char => {
            if (!(char in this.wordToId)) {
                this.wordToId[char] = this.nextId;
                this.idToWord[this.nextId] = char;
                this.nextId++;
            }
        });
    }
    
    // Reads an entire array of raw target commentary sententaces ( Hindi , english, etc.)
    // and expands the dictionary vocabulary dynamically.

    public fitOnText(textArray: string[]): void{
        textArray.forEach(sentence => {
            // Split text by space, but keep brackets and tags groundup cleanly
            const tokens = sentence.split(/(\s+)/).filter(t => t.trim().length > 0);
            tokens.forEach(token => {
                if (!(token in this.wordToId)) {
                    this.wordToId[token] = this.nextId;
                    this.idToWord[this.nextId] = token;
                    this.nextId++;
                }
            });
        });
    }

    // Converts a descriptive chess state prompt into a fixed length mathematical array of numbers
    public encode(inputString: string, maxLength: number = 150): number[] {
        const encodeTokens: number[] = [];

        // Regex splits string by white spaces, structural control brackets []. and tags <>
        const chunks = inputString.split(/(\s+|\[.*?\]|<.*?>)/).filter(c => c && c.trim().length > 0);

        chunks.forEach(chunk =>{
            if(chunk in this.wordToId){
                encodeTokens.push(this.wordToId[chunk]);
            } else {
                // character fallback falllback : if a word ( liek a raw FEN) isn't in our disctionary 
                // serialize it down its individual strings components.
                for ( const char of chunk){
                    if ( char in this.wordToId){
                        encodeTokens.push(this.wordToId[char]);
                    }
                }
            }
        });

        // Padding loop: TensorFlow requires uniform sequence arrays.
        // we pad the tail with our explicit <PAD> token id (0) if the input is too short.
        while(encodeTokens.length < maxLength){
            encodeTokens.push(this.wordToId['<PAD>']);
        }
        return encodeTokens.slice(0, maxLength);
    } 

    // turns the numerical arrays gernerated by the neural network back into natural language sentences 
    public decode(tokenIds : number[]) : string {
        return tokenIds.map(id => this.idToWord[id] || '')
        //strip out organizational padding and layout tokens from final output string 
        .filter(word => !['<PAD>', '<START>', '<END>'].includes(word))
        .join(' ')
        // Regex cleans up formatting spaces around chess boards, notation, and hyphens 
        .replace(/\s+(?=[a-z0-9/_\-\].:])/gi, "")
        .trim();
    }

    // Gets total number of unique words/characters registered in the AI's brain

    public get vocabSize(): number {
        return this.nextId;
    }
}


