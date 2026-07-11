export interface CompiledDatasetPayload {
    vocabSize: number;
    wordToId: Record<string, number>;
    idToWord: Record<number, string>;
    dataset: {
        input: number[];
        target: number[];
    }[];
}
/**
 * Master execution sequence for preparing the dataset.
 */
export declare function assembleProductionDataset(): void;
