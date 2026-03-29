'use client';

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { OPR_GOOGLE_LINK_RETURN_STORAGE_KEY } from "@/lib/api/oprGoogleLink";

/**
 * 게이트웨이 `frontend-after-link`에 `?google_linked=1` 이 붙어 돌아왔을 때,
 * 연동 시작 전에 저장한 경로(예: /dashboard/invite)로 되돌립니다.
 */
export function OprGoogleLinkReturnHandler() {
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || handled.current) return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("google_linked") !== "1") return;
    handled.current = true;

    const ret = sessionStorage.getItem(OPR_GOOGLE_LINK_RETURN_STORAGE_KEY);
    sessionStorage.removeItem(OPR_GOOGLE_LINK_RETURN_STORAGE_KEY);

    toast.success("Google 계정 연동이 완료되었습니다. 초대 메일을 다시 발송해 주세요.");

    if (ret && ret.startsWith("/")) {
      router.replace(ret);
      return;
    }
    router.replace("/dashboard/invite");
  }, [router]);

  return null;
}
