export declare function formatJson(value: unknown): string;
export declare function formatNdjson(values: readonly unknown[]): string;
export declare function writeJson(value: unknown, output?: Pick<NodeJS.WriteStream, 'write'>): void;
export declare function writeNdjson(values: readonly unknown[], output?: Pick<NodeJS.WriteStream, 'write'>): void;
