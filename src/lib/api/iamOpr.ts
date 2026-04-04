import { apiFetch } from "./client";

export type OprDataViewContactRow = {
  user_id: number;
  employee_id?: string | null;
  department_name?: string | null;
  position?: string | null;
  name: string;
  email?: string | null;
  contact?: string | null;
  is_self?: boolean;
};

export type OprDataViewContactsResponse = {
  rows: OprDataViewContactRow[];
};

/** Tier0 데이터뷰「담당자 정보」: 로그인 본인 + 동일 법인 구매팀 */
export async function getOprDataViewContacts(): Promise<OprDataViewContactsResponse> {
  return apiFetch<OprDataViewContactsResponse>("/api/iam/opr/data-view/contacts");
}
