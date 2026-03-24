import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">페이지를 찾을 수 없습니다</h1>
        <p className="text-gray-600 mb-4">요청하신 페이지가 존재하지 않습니다.</p>
        <Link
          href="/dashboard"
          className="px-4 py-2 text-white rounded-lg inline-block"
          style={{
            background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
          }}
        >
          대시보드로 돌아가기
        </Link>
      </div>
    </div>
  );
}
