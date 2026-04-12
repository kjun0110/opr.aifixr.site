/**
 * 공급망 다이어그램용 노드 정규화·중복 제거.
 * - 게이트웨이/클라이언트에 따라 snake_case 또는 camelCase로 올 수 있음.
 * - DB에 동일 슬롯이 다른 supplier_id·다른 부모 PK로 잡혀 있어도, 같은 부모 아래 같은 표시명이면 가입완료(approved) 우선으로 한 건만 남김.
 */

export type DiagramSupplyChainNode = {
  id: number;
  product_variant_id: number;
  supplier_id: number;
  supplier_name: string;
  supplier_code?: string | null;
  parent_node_id: number | null;
  tier: number | null;
  status: string;
};

const STATUS_RANK: Record<string, number> = {
  approved: 4,
  signed_up: 3,
  invited: 2,
  added: 1,
};

function rank(status: string): number {
  return STATUS_RANK[status] ?? 0;
}

/** API 한 건을 다이어그램용 필드로 통일 */
export function normalizeSupplyChainNodeRow(raw: unknown): DiagramSupplyChainNode | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = Number(r.id);
  if (!Number.isFinite(id)) return null;
  const pRaw = r.parent_node_id ?? r.parentNodeId;
  const parent =
    pRaw != null && pRaw !== '' ? Number(pRaw) : null;
  return {
    id,
    product_variant_id: Number(r.product_variant_id ?? r.productVariantId ?? 0),
    supplier_id: Number(r.supplier_id ?? r.supplierId ?? 0),
    supplier_name: String(r.supplier_name ?? r.supplierName ?? ''),
    supplier_code: (r.supplier_code ?? r.supplierCode) as string | null | undefined ?? null,
    parent_node_id: parent != null && Number.isFinite(parent) ? parent : null,
    tier: r.tier != null ? Number(r.tier) : null,
    status: String(r.status ?? ''),
  };
}

function resolveChain(
  pid: number | null,
  idRemap: Map<number, number>,
): number | null {
  let p = pid;
  while (p != null && idRemap.has(p)) {
    p = idRemap.get(p)!;
  }
  return p;
}

/**
 * 1단계: 백엔드와 동일하게 (부모 협력사 ID, 자식 협력사 ID) 슬롯 기준으로 승인 상태 우선.
 */
function dedupeByParentSupplierSlot(nodes: DiagramSupplyChainNode[]): DiagramSupplyChainNode[] {
  if (nodes.length <= 1) return nodes;
  const byId = new Map(nodes.map((n) => [n.id, n]));

  function groupKey(n: DiagramSupplyChainNode): string {
    if (n.parent_node_id == null) return `0:${n.supplier_id}`;
    const p = byId.get(n.parent_node_id);
    if (!p) return `orphan:${n.parent_node_id}:${n.supplier_id}`;
    return `${p.supplier_id}:${n.supplier_id}`;
  }

  const groups = new Map<string, DiagramSupplyChainNode[]>();
  for (const n of nodes) {
    const k = groupKey(n);
    const arr = groups.get(k) ?? [];
    arr.push(n);
    groups.set(k, arr);
  }

  const idRemap = new Map<number, number>();
  const survivors: DiagramSupplyChainNode[] = [];

  for (const arr of groups.values()) {
    if (arr.length === 1) {
      survivors.push(arr[0]);
      continue;
    }
    const best = arr.reduce((a, b) =>
      rank(a.status) > rank(b.status) || (rank(a.status) === rank(b.status) && a.id > b.id)
        ? a
        : b,
    );
    for (const n of arr) {
      if (n.id !== best.id) idRemap.set(n.id, best.id);
    }
    survivors.push(best);
  }

  return survivors
    .map((n) => ({
      ...n,
      parent_node_id: resolveChain(n.parent_node_id, idRemap),
    }))
    .sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0) || a.id - b.id);
}

/**
 * 2단계: 동일 부모 노드 PK + 동일 협력사 표시명인데 supplier_id만 다른 중복(데이터 이슈) → approved 우선 1건.
 */
function dedupeSameParentSameName(nodes: DiagramSupplyChainNode[]): DiagramSupplyChainNode[] {
  if (nodes.length <= 1) return nodes;

  const groups = new Map<string, DiagramSupplyChainNode[]>();
  for (const n of nodes) {
    const pk = n.parent_node_id == null ? 'root' : String(n.parent_node_id);
    const name = (n.supplier_name || '').trim().toLowerCase();
    const k = `${pk}\0${name}`;
    const arr = groups.get(k) ?? [];
    arr.push(n);
    groups.set(k, arr);
  }

  const idRemap = new Map<number, number>();
  const survivors: DiagramSupplyChainNode[] = [];

  for (const arr of groups.values()) {
    if (arr.length === 1) {
      survivors.push(arr[0]);
      continue;
    }
    const best = arr.reduce((a, b) =>
      rank(a.status) > rank(b.status) || (rank(a.status) === rank(b.status) && a.id > b.id)
        ? a
        : b,
    );
    for (const n of arr) {
      if (n.id !== best.id) idRemap.set(n.id, best.id);
    }
    survivors.push(best);
  }

  return survivors
    .map((n) => ({
      ...n,
      parent_node_id: resolveChain(n.parent_node_id, idRemap),
    }))
    .sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0) || a.id - b.id);
}

/** 다이어그램에 넣기 전 최종 노드 목록 */
export function dedupeSupplyChainNodesForDiagram(
  rawRows: unknown[],
): DiagramSupplyChainNode[] {
  const nodes = rawRows
    .map(normalizeSupplyChainNodeRow)
    .filter((n): n is DiagramSupplyChainNode => n != null);
  if (nodes.length === 0) return [];
  return dedupeSameParentSameName(dedupeByParentSupplierSlot(nodes));
}
