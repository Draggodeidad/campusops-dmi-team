/** Preserve the first object and order of each exact ID; never generate IDs. */
export function deduplicateOperations<T extends Readonly<{ operationId: string }>>(
  operations: readonly T[],
): readonly T[] {
  const seen = new Set<string>();
  return operations.filter((operation) => {
    if (seen.has(operation.operationId)) return false;
    seen.add(operation.operationId);
    return true;
  });
}
