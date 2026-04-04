/**
 * 데이터 관리 → 협력사 상세보기: API 연동 시 node.id가 mock 키와 달라도
 * 목록에서 본 행 정보를 sessionStorage로 넘겨 상세 화면에 표시한다.
 *
 * URL/라우터에서 `:` 등이 인코딩되면 키가 어긋날 수 있어, 마지막 클릭 백업(`__last__`)과
 * 키 변형(decode) 재시도를 둔다.
 */
export const SUPPLIER_DETAIL_SNAPSHOT_KEY_PREFIX = 'aifix_supplier_detail_snapshot_v1:';

const LAST_SNAPSHOT_KEY = `${SUPPLIER_DETAIL_SNAPSHOT_KEY_PREFIX}__last__`;

export type SupplierDetailSnapshot = {
  companyName: string;
  companyNameEn: string;
  tier: string;
  country: string;
  productType: string;
  pcfResult: number | null;
  status?: string;
};

type StoredWithNodeId = { nodeId: string } & SupplierDetailSnapshot;

function storageKeysToTry(nodeId: string): string[] {
  const keys = new Set<string>();
  keys.add(nodeId);
  try {
    const dec = decodeURIComponent(nodeId);
    if (dec !== nodeId) keys.add(dec);
  } catch {
    /* ignore */
  }
  const underscored = nodeId.replace(/:/g, '_');
  if (underscored !== nodeId) keys.add(underscored);
  return [...keys];
}

export function saveSupplierDetailSnapshot(nodeId: string, snap: SupplierDetailSnapshot): void {
  if (typeof window === 'undefined' || !nodeId) return;
  try {
    const payload = JSON.stringify(snap);
    for (const k of storageKeysToTry(nodeId)) {
      sessionStorage.setItem(SUPPLIER_DETAIL_SNAPSHOT_KEY_PREFIX + k, payload);
    }
    const withId: StoredWithNodeId = { nodeId, ...snap };
    sessionStorage.setItem(LAST_SNAPSHOT_KEY, JSON.stringify(withId));
  } catch {
    /* quota / private mode */
  }
}

export function loadSupplierDetailSnapshot(nodeId: string): SupplierDetailSnapshot | null {
  if (typeof window === 'undefined' || !nodeId) return null;
  try {
    for (const k of storageKeysToTry(nodeId)) {
      const raw = sessionStorage.getItem(SUPPLIER_DETAIL_SNAPSHOT_KEY_PREFIX + k);
      if (raw) return JSON.parse(raw) as SupplierDetailSnapshot;
    }
    const lastRaw = sessionStorage.getItem(LAST_SNAPSHOT_KEY);
    if (lastRaw) {
      const parsed = JSON.parse(lastRaw) as StoredWithNodeId;
      if (parsed.nodeId === nodeId) {
        const { nodeId: _nid, ...snap } = parsed;
        return snap;
      }
      for (const k of storageKeysToTry(nodeId)) {
        if (parsed.nodeId === k) {
          const { nodeId: _nid, ...snap } = parsed;
          return snap;
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}
