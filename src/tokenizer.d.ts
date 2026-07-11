export declare class ChessAITokenizer {
    private specialTokens;
    wordToId: Record<string, number>;
    idToWord: Record<number, string>;
    private nextId;
    constructor();
    private initVocabulary;
    fitOnText(textArray: string[]): void;
    encode(inputString: string, maxLength?: number): number[];
    decode(tokenIds: number[]): string;
    get vocabSize(): number;
}
