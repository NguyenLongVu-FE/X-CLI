export interface PkceValues {
    verifier: string;
    challenge: string;
    state: string;
}
export declare function createPkce(): PkceValues;
