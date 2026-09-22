export function textByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}
