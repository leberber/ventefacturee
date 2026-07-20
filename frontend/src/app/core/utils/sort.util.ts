export function sortItems<T>(items: T[], col: keyof T, dir: 1 | -1): T[] {
  return [...items].sort((a, b) => {
    const av = (a[col] ?? '') as any;
    const bv = (b[col] ?? '') as any;
    return av < bv ? -dir : av > bv ? dir : 0;
  });
}

export function toggleSort(
  sortCol: string, sortDir: 1 | -1, col: string
): { col: string; dir: 1 | -1 } {
  return sortCol === col
    ? { col, dir: (sortDir === 1 ? -1 : 1) as 1 | -1 }
    : { col, dir: 1 };
}
