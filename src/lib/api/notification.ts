import { apiFetch } from "./client";
import { API_PREFIX } from "./paths";

const BASE = API_PREFIX.NOTIFICATION;

export type NotificationItemOut = {
  id: number;
  recipient_user_id: number;
  notification_type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  invitation_id: number | null;
  signup_request_id: number | null;
  sup_data_submission_id: number | null;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string | null;
};

export async function listMyNotifications(params?: {
  unread_only?: boolean;
  limit?: number;
  offset?: number;
}): Promise<NotificationItemOut[]> {
  const q = new URLSearchParams();
  if (params?.unread_only) q.set("unread_only", "true");
  if (params?.limit != null) q.set("limit", String(params.limit));
  if (params?.offset != null) q.set("offset", String(params.offset));
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return apiFetch<NotificationItemOut[]>(`${BASE}/items${suffix}`);
}

export async function markNotificationRead(notificationId: number): Promise<NotificationItemOut> {
  return apiFetch<NotificationItemOut>(`${BASE}/items/${notificationId}/read`, {
    method: "POST",
  });
}
