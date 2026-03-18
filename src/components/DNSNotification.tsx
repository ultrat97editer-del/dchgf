import { useEffect, useState } from 'react';

export const DNSNotification = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Kiểm tra xem notification đã được hiển thị chưa
    const hasShownNotification = sessionStorage.getItem('dnsNotificationShown');
    
    if (!hasShownNotification) {
      setIsVisible(true);
      sessionStorage.setItem('dnsNotificationShown', 'true');
      
      // Auto close sau 6 giây
      const timer = setTimeout(() => setIsVisible(false), 6000);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed top-6 right-6 z-50 animate-slide-in">
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-4 rounded-lg shadow-lg max-w-md">
        <div className="flex items-start gap-3">
          <div className="text-2xl flex-shrink-0">✓</div>
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-1">Đã cập nhật cấu hình DNS mới</h3>
            <p className="text-sm opacity-90 mb-2">Fix lỗi mất Gold</p>
            <p className="text-sm font-semibold text-yellow-200">Vui lòng tải và cài đặt lại DNS!</p>
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="text-xl opacity-70 hover:opacity-100 transition flex-shrink-0"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
};