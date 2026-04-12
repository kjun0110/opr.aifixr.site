/**
 * 고정 개수 워커로 배열을 병렬 처리합니다. 무제한 Promise.all 대비 서버·브라우저 부하를 줄입니다.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const n = Math.max(1, Math.min(concurrency, items.length));
  const results: R[] = new Array(items.length);
  let next = 0;

  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) break;
      results[i] = await fn(items[i], i);
    }
  };

  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}
