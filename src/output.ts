export function formatJson(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

export function formatNdjson(values: readonly unknown[]): string {
  return values.length === 0 ? '' : `${values.map((value) => JSON.stringify(value)).join('\n')}\n`;
}

export function writeJson(value: unknown, output: Pick<NodeJS.WriteStream, 'write'> = process.stdout): void {
  output.write(formatJson(value));
}

export function writeNdjson(values: readonly unknown[], output: Pick<NodeJS.WriteStream, 'write'> = process.stdout): void {
  output.write(formatNdjson(values));
}
