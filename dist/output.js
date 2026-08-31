export function formatJson(value) {
    return `${JSON.stringify(value)}\n`;
}
export function formatNdjson(values) {
    return values.length === 0 ? '' : `${values.map((value) => JSON.stringify(value)).join('\n')}\n`;
}
export function writeJson(value, output = process.stdout) {
    output.write(formatJson(value));
}
export function writeNdjson(values, output = process.stdout) {
    output.write(formatNdjson(values));
}
