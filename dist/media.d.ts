export interface MediaDescriptor {
    path: string;
    size: number;
    sha256: string;
}
export declare function describeMedia(paths: readonly string[]): Promise<MediaDescriptor[]>;
export declare function verifyMedia(descriptors: readonly MediaDescriptor[]): Promise<void>;
