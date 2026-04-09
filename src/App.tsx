import React, { useState, useEffect } from 'react';
import { Bell, X, Shield, Rocket, Book, Star, Zap, CheckCircle, Search, Maximize, Loader2, Headset, ArrowRight, Crown, Lock, FileText, Mail, Menu, Download, Video, Eye, History, Award, Receipt } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { db, auth } from './firebase';
import { collection, addDoc, query, where, getDocs, orderBy, limit, Timestamp, deleteDoc, doc } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { DNSNotification } from './components/DNSNotification';

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'activate' | 'security' | 'policy' | 'contact' | 'invoice'>('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusData, setStatusData] = useState<{ uid: string; active: boolean; expires?: string } | null>(null);
  const [successData, setSuccessData] = useState<{ pid: string; link: string } | null>(null);
  
  const [paymentStep, setPaymentStep] = useState<'idle' | 'transfer' | 'paid'>('idle');
  const [paymentData, setPaymentData] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoiceSearchUsername, setInvoiceSearchUsername] = useState('');
  const [showAddInvoiceModal, setShowAddInvoiceModal] = useState(false);
  const [newInvoiceData, setNewInvoiceData] = useState({ username: '', transactionId: '', amount: '10000' });
  
  // Use environment variable or default to relative URL for Render
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
    (typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'https://backend-locket.vercel.app');

  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  const toggleNotifPanel = () => setIsNotifOpen(!isNotifOpen);
  const toggleSupport = () => setIsSupportOpen(!isSupportOpen);

  const handleAdminLogin = async () => {
    if (!adminPassword) {
      Swal.fire('Lỗi', 'Đại ca chưa nhập mật khẩu!', 'error');
      return;
    }
    setAdminLoading(true);

    try {
      const response = await axios.post(`${BACKEND_URL}/api/admin-auth`, { password: adminPassword });
      if (response.data.success) {
        // Also sign in to Firebase to enable Firestore permissions
        try {
          const provider = new GoogleAuthProvider();
          await signInWithPopup(auth, provider);
        } catch (fbErr) {
          console.error("Firebase Login Error:", fbErr);
          Swal.fire('Cảnh báo', 'Đã xác thực Admin nhưng chưa đăng nhập Firebase. Một số tính năng quản lý có thể bị hạn chế.', 'warning');
        }

        setShowAdminModal(false);
        setAdminPassword('');
        setIsAdmin(true); 
        Swal.fire('Thành công', 'Chào mừng Admin! Đã mở khóa đặc quyền qua cửa.', 'success');
      } else {
        Swal.fire('Lỗi', 'Sai mật khẩu rồi đại ca ơi!', 'error');
      }
    } catch (err) {
      Swal.fire('Lỗi', 'Lỗi kết nối máy chủ xác thực!', 'error');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!username.trim()) {
      Swal.fire('Lỗi', 'Vui lòng nhập Username hoặc Link Locket', 'error');
      return;
    }

    setLoading(true);
    setStatusData(null);
    setSuccessData(null);
    setPaymentStep('idle');
    setPaymentData(null);

    try {
      // Check for existing invoice in Firebase (within 30 days)
      const invoicesRef = collection(db, 'invoices');
      const q = query(
        invoicesRef, 
        where('username', '==', username.trim())
      );
      const querySnapshot = await getDocs(q);
      
      let hasValidInvoice = false;
      if (!querySnapshot.empty) {
        // Find the most recent invoice in memory
        const sortedInvoices = querySnapshot.docs
          .map(doc => doc.data())
          .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
          
        const latestInvoice = sortedInvoices[0];
        const purchaseDate = new Date(latestInvoice.purchaseDate);
        const now = new Date();
        const diffDays = (now.getTime() - purchaseDate.getTime()) / (1000 * 3600 * 24);
        
        if (diffDays <= 30) {
          hasValidInvoice = true;
        }
      }

      const resolveRes = await axios.post('/api/resolve', { username });
      const uid = resolveRes.data.uid;

      const statusRes = await axios.get(`/api/status/${uid}`);
      setStatusData({
        uid,
        active: statusRes.data.active,
        expires: statusRes.data.expires,
      });

      if (hasValidInvoice) {
        setPaymentStep('paid');
        Swal.fire('Thông báo', 'Bạn đã mua gói này trong vòng 30 ngày qua. Hệ thống tự động bỏ qua bước thanh toán!', 'info');
      }
    } catch (error: any) {
      console.error(error);
      Swal.fire('Lỗi', error.response?.data?.error || 'Không tìm thấy User hoặc có lỗi xảy ra', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStartCheckout = async () => {
    if (!statusData?.uid) return;
    
    setLoading(true);
    const newOrderCode = Math.floor(100000 + Math.random() * 900000);

    try {
      const response = await axios.post(`${BACKEND_URL}/api/create-payment-link`, { orderCode: newOrderCode });
      if (response.data.success) {
        setPaymentData(response.data.data);
        setPaymentStep('transfer');
      } else {
        Swal.fire('Lỗi', 'Lỗi tạo mã QR. Vui lòng thử lại sau!', 'error');
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Lỗi', 'Không kết nối được Server thanh toán.', 'error');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (paymentStep !== 'transfer' || !paymentData?.orderCode) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/check-order/${paymentData.orderCode}`);
        const data = await res.json();
        
        if (data.success && data.status === 'PAID') {
          clearInterval(interval);
          setPaymentStep('paid');
          
          // Save invoice to Firebase
          try {
            await addDoc(collection(db, 'invoices'), {
              username: username.trim(),
              purchaseDate: new Date().toISOString(),
              transactionId: paymentData.orderCode.toString(),
              amount: paymentData.amount || 10000
            });
          } catch (err) {
            console.error("Lỗi lưu hóa đơn:", err);
          }

          Swal.fire('Thành công', 'Đã nhận được thanh toán! Bạn có thể kích hoạt ngay bây giờ.', 'success');
        }
      } catch (e) {
        console.log("Đang dò trạng thái thanh toán...");
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [paymentStep, paymentData, BACKEND_URL, username]);

  const fetchInvoices = async (searchName?: string) => {
    setInvoicesLoading(true);
    try {
      const invoicesRef = collection(db, 'invoices');
      let q;
      if (isAdmin && !searchName) {
        q = query(invoicesRef, orderBy('purchaseDate', 'desc'), limit(50));
      } else if (searchName) {
        q = query(invoicesRef, where('username', '==', searchName.trim()));
      } else {
        setInvoices([]);
        setInvoicesLoading(false);
        return;
      }
      
      const querySnapshot = await getDocs(q);
      const fetchedInvoices = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      if (searchName) {
        fetchedInvoices.sort((a: any, b: any) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
      }
      
      setInvoices(fetchedInvoices);
    } catch (err) {
      console.error("Lỗi lấy hóa đơn:", err);
    } finally {
      setInvoicesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'invoice') {
      if (isAdmin) {
        fetchInvoices();
      } else {
        setInvoices([]);
      }
    }
  }, [activeTab, isAdmin]);

  const handleSearchInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceSearchUsername.trim()) {
      Swal.fire('Chú ý', 'Vui lòng nhập username để kiểm tra', 'info');
      return;
    }
    fetchInvoices(invoiceSearchUsername);
  };

  const handleDeleteInvoice = async (id: string) => {
    if (!isAdmin) return;
    
    const result = await Swal.fire({
      title: 'Xác nhận xoá?',
      text: "Bạn không thể hoàn tác hành động này!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Xoá ngay',
      cancelButtonText: 'Huỷ'
    });

    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(db, 'invoices', id));
        Swal.fire('Đã xoá!', 'Hoá đơn đã được loại bỏ.', 'success');
        fetchInvoices();
      } catch (err) {
        console.error(err);
        Swal.fire('Lỗi', 'Không thể xoá hoá đơn. Kiểm tra quyền Admin!', 'error');
      }
    }
  };

  const handleAddManualInvoice = async () => {
    if (!newInvoiceData.username || !newInvoiceData.transactionId) {
      Swal.fire('Lỗi', 'Vui lòng nhập đầy đủ thông tin!', 'error');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'invoices'), {
        username: newInvoiceData.username.trim(),
        transactionId: newInvoiceData.transactionId.trim(),
        amount: parseInt(newInvoiceData.amount),
        purchaseDate: new Date().toISOString(),
        manual: true
      });
      
      setShowAddInvoiceModal(false);
      setNewInvoiceData({ username: '', transactionId: '', amount: '10000' });
      Swal.fire('Thành công', 'Đã thêm hoá đơn thủ công!', 'success');
      fetchInvoices();
    } catch (err) {
      console.error(err);
      Swal.fire('Lỗi', 'Không thể thêm hoá đơn. Kiểm tra quyền Admin!', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async () => {
    if (!statusData?.uid) {
      Swal.fire('Lỗi', 'Vui lòng kiểm tra trạng thái trước khi kích hoạt', 'warning');
      return;
    }

    setLoading(true);
    setSuccessData(null);

    try {
      const res = await axios.post('/api/activate', { uid: statusData.uid });
      if (res.data.success) {
        setSuccessData({ pid: res.data.pid, link: res.data.link });
        setStatusData(prev => prev ? { ...prev, active: true } : null);
        Swal.fire({
          title: 'Kích hoạt thành công!',
          text: 'Vui lòng cài đặt DNS ngay lập tức để giữ Gold.',
          icon: 'success',
          confirmButtonText: 'Xem Hướng Dẫn'
        });
      }
    } catch (error: any) {
      console.error(error);
      Swal.fire('Lỗi', error.response?.data?.error || 'Kích hoạt thất bại', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DNSNotification />
      <div className="flex w-full h-[100dvh] bg-gray-50 overflow-hidden">
        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-100 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex flex-col h-full">
            <div className="p-6 border-b border-gray-50">
              <div className="flex items-center gap-3">
                <img 
                  src="/images/logo.jpg" 
                  alt="Logo" 
                  className="w-10 h-10 rounded-full object-cover shadow-md border border-gray-100"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <h2 className="font-bold text-gray-800 leading-tight text-sm">locket.io.vn</h2>
                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Activator System</p>
                </div>
              </div>
            </div>

            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
              <button 
                onClick={() => { setActiveTab('home'); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'home' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <Rocket size={20} />
                <span className="text-sm">Trang chủ</span>
              </button>
              <button 
                onClick={() => { setActiveTab('activate'); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'activate' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <Zap size={20} />
                <span className="text-sm">Kích hoạt</span>
              </button>
              <button 
                onClick={() => { setActiveTab('invoice'); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'invoice' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <Receipt size={20} />
                <span className="text-sm">Hoá đơn</span>
              </button>
              <button 
                onClick={() => { setActiveTab('security'); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'security' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <Shield size={20} />
                <span className="text-sm">Bảo mật</span>
              </button>
              <button 
                onClick={() => { setActiveTab('policy'); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'policy' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <FileText size={20} />
                <span className="text-sm">Chính sách</span>
              </button>
              <button 
                onClick={() => { setActiveTab('contact'); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'contact' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <Mail size={20} />
                <span className="text-sm">Liên hệ</span>
              </button>

              <a 
                href="/DNSlocketgold.mobileconfig"
                download="DNSlocketgold.mobileconfig"
                className="mt-6 block p-4 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all duration-300 group"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white/20 rounded-lg group-hover:scale-110 transition-transform duration-300">
                    <Shield size={24} className="text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold leading-tight">Tải cấu hình DNS</h4>
                    <p className="text-[10px] text-blue-100 mt-1">Cấu hình giữ locket gold</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-center gap-2 py-2 bg-white/10 rounded-xl text-xs font-bold hover:bg-white/20 transition-colors">
                  <Download size={14} />
                  Tải ngay
                </div>
              </a>
            </nav>

            <div className="p-4 border-t border-gray-50">
              <div className="bg-gray-50 rounded-2xl p-4">
                <p className="text-[10px] text-gray-400 font-bold uppercase mb-2">Hệ thống</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Trạng thái</span>
                  <span className="flex items-center gap-1 text-green-600 font-bold">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                    Hoạt động
                  </span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Overlay */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {showAdminModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-200">
            <div className="bg-white border border-gray-200 p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="text-blue-600" size={28} />
                <h3 className="text-xl font-bold text-gray-800">Xác thực Admin</h3>
              </div>
              <p className="text-xs text-gray-500 mb-6">Xác thực an toàn qua máy chủ</p>
              
              <input
                type="password"
                placeholder="Nhập mật khẩu bí mật..."
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                disabled={adminLoading}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-gray-800 mb-4 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
              />
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAdminModal(false);
                    setAdminPassword('');
                  }}
                  disabled={adminLoading}
                  className="flex-1 py-3 rounded-xl font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Đóng
                </button>
                <button
                  onClick={handleAdminLogin}
                  disabled={adminLoading}
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors flex justify-center items-center gap-2"
                >
                  {adminLoading ? <Loader2 size={18} className="animate-spin" /> : 'Xác nhận'}
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
          <header className="bg-white p-4 flex justify-between items-center shadow-sm z-10 px-4 md:px-8">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition"
              >
                <Menu size={20} />
              </button>
              <span className="text-lg hidden sm:inline">👋 Hi <b>Bạn!</b></span>
            </div>
            <div className="flex items-center gap-6">
              <div className="relative flex items-center gap-2">
                <button onClick={() => setShowAdminModal(true)} className="relative text-gray-400 hover:text-blue-600 transition p-1 mr-2" title="Admin Login">
                  <Lock size={18} className={isAdmin ? "text-yellow-500" : ""} />
                </button>
                
                <button onClick={toggleNotifPanel} className="relative text-gray-500 hover:text-blue-600 transition p-1">
                  <Bell size={20} />
                </button>
                {isNotifOpen && (
                  <div className="absolute right-0 top-10 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                      <span className="font-bold text-gray-800 text-sm flex items-center gap-2">
                        <Bell size={16} className="text-blue-600" /> Thông báo
                      </span>
                      <button onClick={toggleNotifPanel} className="text-gray-400 hover:text-gray-600 p-1 transition">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      <div className="p-4 border-b border-gray-50 bg-blue-50/30">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-xs text-blue-600 uppercase tracking-wider">Lưu ý quan trọng</span>
                          <span className="text-[10px] text-gray-400">17:05 14/03/2026</span>
                        </div>
                        <p className="text-xs font-bold text-red-600 mb-1">LƯU Ý Không Bật 1.1.1.1 hay VPN</p>
                        <p className="text-[11px] text-gray-600 leading-relaxed">
                          Nếu bật 1.1.1.1 lên sẽ bị rụng locket gold ngay. Bên mình TỪ CHỐI BẢO HÀNH trường hợp này nhé. Xin cảm ơn!
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-32 md:pb-32">
            {activeTab === 'home' && (
              <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Nâng Cấp Gold Section as Home Page */}
                <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-[2.5rem] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl">
                  <div className="relative z-10 max-w-2xl">
                    <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
                      <Crown size={16} className="text-yellow-400" /> Đặc quyền tối thượng
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-6 leading-tight">
                      Nâng Cấp <span className="text-yellow-400">Locket Gold</span>
                    </h1>
                    <p className="text-lg md:text-xl text-blue-100 font-medium mb-8 opacity-90 leading-relaxed">
                      Trải nghiệm toàn bộ tính năng cao cấp nhất mà không cần iCloud hay Shadowrocket.
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
                      <div className="flex items-center gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 hover:bg-white/20 transition-all">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white shrink-0">
                          <Video size={20} />
                        </div>
                        <span className="text-sm font-bold">Mở khoá quay video locket</span>
                      </div>
                      <div className="flex items-center gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 hover:bg-white/20 transition-all">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white shrink-0">
                          <Eye size={20} />
                        </div>
                        <span className="text-sm font-bold">Xem ai đã xem ảnh của bạn</span>
                      </div>
                      <div className="flex items-center gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 hover:bg-white/20 transition-all">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white shrink-0">
                          <History size={20} />
                        </div>
                        <span className="text-sm font-bold">Không giới hạn lịch sử ảnh</span>
                      </div>
                      <div className="flex items-center gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 hover:bg-white/20 transition-all">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white shrink-0">
                          <Award size={20} />
                        </div>
                        <span className="text-sm font-bold">Huy hiệu Gold độc quyền</span>
                      </div>
                    </div>

                    <button 
                      onClick={() => setActiveTab('activate')}
                      className="group bg-gradient-to-r from-yellow-400 to-yellow-600 text-neutral-900 hover:from-yellow-500 font-black py-5 px-10 rounded-2xl text-lg shadow-xl shadow-yellow-500/20 transition-all flex items-center justify-center gap-3 active:scale-95"
                    >
                      Nâng Cấp Ngay (10.000đ) <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                  
                  <div className="absolute right-[-10%] top-[-10%] opacity-10 pointer-events-none">
                    <Crown size={400} className="text-white rotate-12" />
                  </div>
                  <div className="absolute left-[-5%] bottom-[-5%] opacity-5 pointer-events-none">
                    <Zap size={300} className="text-white -rotate-12" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-center">
                    <div className="w-12 h-12 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Zap size={24} />
                    </div>
                    <h3 className="font-bold text-gray-800 mb-2">Tự động 100%</h3>
                    <p className="text-xs text-gray-500">Hệ thống xử lý ngay lập tức sau khi thanh toán thành công.</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-center">
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Shield size={24} />
                    </div>
                    <h3 className="font-bold text-gray-800 mb-2">Bảo mật tuyệt đối</h3>
                    <p className="text-xs text-gray-500">Không yêu cầu mật khẩu iCloud hay thông tin nhạy cảm.</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-center">
                    <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Star size={24} />
                    </div>
                    <h3 className="font-bold text-gray-800 mb-2">Hỗ trợ 24/7</h3>
                    <p className="text-xs text-gray-500">Đội ngũ kỹ thuật luôn sẵn sàng giải đáp mọi thắc mắc.</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'activate' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="lg:col-span-7 space-y-6">
                  <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl isolate">
                    <div className="relative z-10">
                      <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-2">Locket Gold Activator</h1>
                      <p className="text-blue-100 font-bold text-sm md:text-base mb-4 opacity-90">
                        Không Cần iCloud - Không Shadowrocket - Không IPA
                      </p>
                      <div className="flex flex-wrap gap-4 text-xs md:text-sm font-bold">
                        <span className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-full backdrop-blur-sm">
                          <CheckCircle size={14} className="text-green-400" /> Nhanh chóng
                        </span>
                        <span className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-full backdrop-blur-sm">
                          <CheckCircle size={14} className="text-green-400" /> Bảo mật
                        </span>
                        <span className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-full backdrop-blur-sm">
                          <CheckCircle size={14} className="text-green-400" /> Uy tín
                        </span>
                      </div>
                    </div>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-10 pointer-events-none">
                      <Shield size={160} className="transform translate-x-8" />
                    </div>
                  </div>

                  <div id="activation-card" className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative">
                    <div className="flex justify-between mb-6">
                      <h2 className="font-bold flex items-center text-base">
                        <Zap size={18} className="mr-2 text-blue-600" /> Kích hoạt Locket Gold tự động
                      </h2>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-500 mb-1">
                          Nhập Username Locket <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input 
                            type="text" 
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Nhập Username Locket của bạn" 
                            className="w-full font-semibold text-sm border border-gray-300 bg-white rounded-lg px-4 py-2.5 pr-10 transition-colors duration-200" 
                            disabled={loading}
                          />
                        </div>
                      </div>

                      {statusData && (
                        <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                          <h3 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                            <Search size={16} /> Kết quả kiểm tra
                          </h3>
                          <div className="space-y-2 text-sm">
                            <p className="flex justify-between">
                              <span className="text-gray-500">UID:</span>
                              <span className="font-mono font-medium text-gray-700">{statusData.uid}</span>
                            </p>
                            <p className="flex justify-between">
                              <span className="text-gray-500">Trạng thái:</span>
                              <span className={`font-bold ${statusData.active ? 'text-green-600' : 'text-gray-600'}`}>
                                {statusData.active ? 'Gold (Đã Active)' : 'Free (Chưa Active)'}
                              </span>
                            </p>
                            {statusData.expires && (
                              <p className="flex justify-between">
                                <span className="text-gray-500">Hết hạn:</span>
                                <span className="font-medium text-gray-700">{new Date(statusData.expires).toLocaleDateString('vi-VN')}</span>
                              </p>
                            )}
                          </div>

                          {!statusData.active && paymentStep === 'idle' && !isAdmin && (
                            <button 
                              onClick={handleStartCheckout}
                              disabled={loading}
                              className="w-full mt-4 bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 text-neutral-900 font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all"
                            >
                              {loading ? <Loader2 className="animate-spin" size={18} /> : <Crown size={18} />}
                              Thanh toán để kích hoạt (10.000đ)
                            </button>
                          )}

                          {paymentStep === 'transfer' && paymentData && !isAdmin && (
                            <div className="mt-4 p-4 bg-white border border-yellow-200 rounded-xl shadow-inner animate-in fade-in zoom-in-95 duration-300">
                              <div className="text-center mb-4">
                                <h4 className="font-bold text-gray-800 text-sm mb-1">Quét mã QR để thanh toán</h4>
                                <p className="text-[10px] text-gray-500 italic">Hệ thống tự động duyệt sau khi nhận tiền</p>
                              </div>
                              
                              <div className="flex justify-center mb-4 relative">
                                {paymentData.qrCode && (
                                  <img 
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(paymentData.qrCode)}`}
                                    alt="PayOS QR Code" 
                                    className="w-48 h-48 object-contain rounded-lg border border-gray-100 p-1 bg-white"
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                      console.error('QR code generation failed');
                                      (e.target as HTMLImageElement).src = `https://img.vietqr.io/image/${paymentData.bin || '970452'}-${paymentData.accountNumber || '0'}-compact2.png`;
                                    }}
                                  />
                                )}
                                <div className="absolute -bottom-2 -right-2 bg-yellow-400 text-neutral-900 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                                  <Zap size={10} fill="currentColor" /> PayOS
                                </div>
                              </div>

                              <div className="space-y-2 text-[11px] bg-gray-50 p-3 rounded-lg border border-gray-100">
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Mã đơn hàng:</span>
                                  <span className="font-bold text-blue-600">{paymentData.orderCode}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Số tiền:</span>
                                  <span className="font-bold text-red-600">{paymentData.amount.toLocaleString('vi-VN')}đ</span>
                                </div>
                                {paymentData.description && (
                                  <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
                                    <span className="text-gray-500">Nội dung:</span>
                                    <span className="font-bold text-yellow-600">{paymentData.description}</span>
                                  </div>
                                )}
                              </div>

                              {paymentData.checkoutUrl && (
                                <div className="mt-3">
                                  <a 
                                    href={paymentData.checkoutUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm"
                                  >
                                    <ArrowRight size={14} /> Thanh toán trên PayOS
                                  </a>
                                </div>
                              )}

                              <div className="mt-3 flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-100">
                                <Loader2 size={14} className="text-blue-500 animate-spin shrink-0" />
                                <p className="text-[10px] text-blue-700 leading-tight">
                                  Đang chờ thanh toán... Đừng tắt trang này cho đến khi hoàn tất.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {successData && (
                        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                          <h3 className="font-bold text-green-800 mb-2 flex items-center gap-2">
                            <Shield size={16} /> Hướng dẫn cài DNS
                          </h3>
                          <div className="space-y-3 text-sm text-green-900">
                            <p>1. Vào App Locket kiểm tra đã có Gold chưa.</p>
                            <p>2. Nếu đã có, tiến hành <strong>CÀI DNS NGAY</strong> (trong 30s):</p>
                            <div className="bg-white p-3 rounded-lg border border-green-100">
                              <p className="font-bold mb-1">🍏 iOS:</p>
                              <a 
                                href="/DNSlocketgold.mobileconfig" 
                                download="DNSlocketgold.mobileconfig"
                                className="inline-flex items-center gap-2 text-blue-600 hover:underline font-bold"
                              >
                                <Download size={16} /> Tải cấu hình DNS (iOS)
                              </a>
                              <p className="text-xs text-gray-500 mt-1">(Sau khi tải: Cài đặt -&gt; Đã tải về hồ sơ -&gt; Cài đặt)</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-green-100">
                              <p className="font-bold mb-1">🤖 Android:</p>
                              <code className="bg-gray-100 px-2 py-1 rounded text-pink-600 break-all">{successData.pid}.dns.nextdns.io</code>
                              <p className="text-xs text-gray-500 mt-1">(Cài đặt → Mạng → Private DNS)</p>
                            </div>
                            <p className="text-xs font-bold text-red-600 mt-2">⚠️ Lưu ý: Bắt buộc cài DNS để không bị mất Gold!</p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100 flex-wrap">
                        <div className="flex flex-wrap justify-end gap-3 w-full">
                          <button 
                            onClick={handleCheckStatus}
                            disabled={loading}
                            className="border border-gray-300 text-gray-600 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50 min-h-[44px] w-full md:w-auto flex items-center justify-center disabled:opacity-50"
                          >
                            {loading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Search size={16} className="mr-2" />} 
                            Kiểm tra trạng thái
                          </button>
                          <button 
                            onClick={handleActivate}
                            disabled={loading || !statusData || statusData.active || (paymentStep !== 'paid' && !isAdmin)}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold shadow min-h-[44px] w-full md:w-auto flex items-center justify-center transition-all ${
                              (paymentStep === 'paid' || isAdmin) 
                                ? 'bg-blue-600 text-white hover:bg-blue-700 animate-pulse' 
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            {loading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Zap size={16} className="mr-2" />}
                            {statusData?.active ? 'Đã kích hoạt' : (paymentStep === 'paid' || isAdmin) ? 'Kích hoạt ngay!' : 'Chờ thanh toán'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 space-y-6">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full">
                    <div className="flex justify-between items-center mb-6">
                      <span className="font-bold flex items-center"><Book size={18} className="mr-2 text-blue-600" /> Hướng dẫn sử dụng</span>
                      <button className="p-2 hover:bg-gray-100 rounded text-gray-400">
                        <Maximize size={16} />
                      </button>
                    </div>
                    
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 flex-1 text-xs shadow-inner flex justify-center items-center min-h-[300px]">
                      <video width="100%" height="auto" controls className="rounded-lg shadow-lg">
                        <source src="/video/huongdan.mp4" type="video/mp4" />
                        Trình duyệt của bạn không hỗ trợ thẻ video.
                      </video>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                    <Shield size={28} />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-800">Chính sách bảo mật</h1>
                    <p className="text-sm text-gray-400">Cập nhật lần cuối: 15/03/2026</p>
                  </div>
                </div>

                <div className="space-y-8 text-gray-600 leading-relaxed">
                  <section>
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">1</span>
                      Thu thập thông tin
                    </h2>
                    <p className="mb-4">Chúng tôi thu thập các thông tin sau khi bạn sử dụng Dịch vụ:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <p className="font-bold text-gray-800 text-sm mb-1">Username Locket</p>
                        <p className="text-xs">Để thực hiện kích hoạt dịch vụ</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <p className="font-bold text-gray-800 text-sm mb-1">Thông tin giao dịch</p>
                        <p className="text-xs">Mã đơn, số tiền, thời gian</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <p className="font-bold text-gray-800 text-sm mb-1">Thông tin trình duyệt</p>
                        <p className="text-xs">IP, User-Agent (tự động)</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <p className="font-bold text-gray-800 text-sm mb-1">Thời gian truy cập</p>
                        <p className="text-xs">Logs hoạt động trên hệ thống</p>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">2</span>
                      Mục đích sử dụng thông tin
                    </h2>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>Xử lý và kích hoạt dịch vụ Locket Gold theo yêu cầu của bạn.</li>
                      <li>Xác nhận thanh toán và quản lý đơn hàng.</li>
                      <li>Hỗ trợ kỹ thuật và giải quyết sự cố.</li>
                      <li>Cải thiện chất lượng dịch vụ và trải nghiệm người dùng.</li>
                    </ul>
                  </section>

                  <section>
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">3</span>
                      Bảo vệ thông tin
                    </h2>
                    <div className="space-y-4">
                      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <p className="font-bold text-blue-800 text-sm mb-1">Mã hóa dữ liệu</p>
                        <p className="text-xs text-blue-600">Tất cả dữ liệu được truyền tải qua kết nối HTTPS được mã hóa.</p>
                      </div>
                      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <p className="font-bold text-blue-800 text-sm mb-1">Lưu trữ an toàn</p>
                        <p className="text-xs text-blue-600">Dữ liệu được lưu trữ trên hệ thống bảo mật với kiểm soát truy cập nghiêm ngặt.</p>
                      </div>
                      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <p className="font-bold text-blue-800 text-sm mb-1">Hạn chế truy cập</p>
                        <p className="text-xs text-blue-600">Chỉ nhân viên được ủy quyền mới có quyền truy cập dữ liệu người dùng.</p>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">4</span>
                      Chia sẻ thông tin
                    </h2>
                    <p>Chúng tôi cam kết không bán, trao đổi, hoặc chia sẻ thông tin cá nhân của bạn cho bất kỳ bên thứ ba nào, trừ khi được yêu cầu bởi cơ quan pháp luật có thẩm quyền.</p>
                  </section>

                  <section>
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">5</span>
                      Quyền của người dùng
                    </h2>
                    <ul className="list-disc pl-6 space-y-2">
                      <li><strong>Quyền truy cập:</strong> Bạn có quyền yêu cầu xem thông tin cá nhân mà chúng tôi lưu trữ.</li>
                      <li><strong>Quyền chỉnh sửa:</strong> Bạn có quyền yêu cầu sửa đổi thông tin không chính xác.</li>
                      <li><strong>Quyền xóa:</strong> Bạn có quyền yêu cầu xóa dữ liệu cá nhân (trong phạm vi pháp luật cho phép).</li>
                    </ul>
                  </section>

                  <section>
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">6</span>
                      Cookie & Session
                    </h2>
                    <p>Chúng tôi sử dụng cookie và session để duy trì trạng thái phiên làm việc và cải thiện trải nghiệm người dùng. Bạn có thể tắt cookie trong trình duyệt, tuy nhiên điều này có thể ảnh hưởng đến một số chức năng của Dịch vụ.</p>
                  </section>

                  <section className="pt-8 border-t border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">7</span>
                      Liên hệ
                    </h2>
                    <p className="mb-4">Nếu bạn có bất kỳ câu hỏi nào về chính sách bảo mật này, vui lòng liên hệ:</p>
                    <div className="flex flex-wrap gap-4">
                      <div className="bg-gray-50 px-6 py-4 rounded-2xl border border-gray-100 flex-1 min-w-[200px]">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Email</p>
                        <p className="text-sm font-bold text-gray-800">t97system@icloud.com</p>
                      </div>
                      <div className="bg-gray-50 px-6 py-4 rounded-2xl border border-gray-100 flex-1 min-w-[200px]">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Telegram</p>
                        <a href="https://t.me/T97system" target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-gray-800 hover:text-blue-600 transition-colors">@T97system</a>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            )}

            {activeTab === 'policy' && (
              <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                    <FileText size={28} />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-800">Chính sách sử dụng</h1>
                    <p className="text-sm text-gray-400">Cập nhật lần cuối: 15/03/2026</p>
                  </div>
                </div>

                <div className="space-y-8 text-gray-600 leading-relaxed">
                  <section>
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">1</span>
                      Giới thiệu
                    </h2>
                    <p>locket.io.vn (sau đây gọi tắt là "Dịch vụ") là nền tảng hỗ trợ kích hoạt gói Locket Gold cho người dùng. Bằng việc sử dụng Dịch vụ, bạn đồng ý tuân thủ các điều khoản và chính sách được nêu dưới đây.</p>
                  </section>

                  <section>
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">2</span>
                      Điều khoản sử dụng
                    </h2>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>Dịch vụ chỉ dành cho mục đích cá nhân, không được sử dụng cho mục đích thương mại hoặc trái pháp luật.</li>
                      <li>Người dùng phải cung cấp thông tin chính xác khi sử dụng Dịch vụ.</li>
                      <li>Nghiêm cấm các hành vi gian lận, lạm dụng, hoặc tấn công hệ thống.</li>
                      <li>Chúng tôi có quyền tạm ngừng hoặc chấm dứt tài khoản vi phạm mà không cần thông báo trước.</li>
                    </ul>
                  </section>

                  <section>
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">3</span>
                      Chính sách thanh toán
                    </h2>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>Thanh toán được thực hiện qua chuyển khoản ngân hàng với hệ thống tự động xác nhận.</li>
                      <li>Đơn hàng sẽ tự động hủy nếu không thanh toán trong vòng 30 phút.</li>
                      <li>Giá dịch vụ có thể thay đổi mà không cần thông báo trước. Giá áp dụng là giá tại thời điểm tạo đơn.</li>
                    </ul>
                  </section>

                  <section>
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">4</span>
                      Chính sách hoàn tiền
                    </h2>
                    <p>Chúng tôi không hỗ trợ hoàn tiền sau khi dịch vụ đã được kích hoạt thành công. Trong trường hợp xảy ra lỗi kỹ thuật từ phía chúng tôi, vui lòng liên hệ bộ phận hỗ trợ để được giải quyết.</p>
                  </section>

                  <section>
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">5</span>
                      Quyền và trách nhiệm
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                          <Star size={16} className="text-yellow-500" /> Người dùng
                        </h3>
                        <ul className="text-xs space-y-2">
                          <li>• Được sử dụng dịch vụ theo gói đã mua</li>
                          <li>• Được hỗ trợ kỹ thuật trong thời gian sử dụng</li>
                          <li>• Có trách nhiệm bảo mật thông tin tài khoản</li>
                        </ul>
                      </div>
                      <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                          <Shield size={16} className="text-blue-600" /> Nhà cung cấp
                        </h3>
                        <ul className="text-xs space-y-2">
                          <li>• Cung cấp dịch vụ ổn định và liên tục</li>
                          <li>• Hỗ trợ kỹ thuật khi có sự cố</li>
                          <li>• Bảo mật thông tin người dùng</li>
                        </ul>
                      </div>
                    </div>
                  </section>

                  <section className="pt-8 border-t border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">6</span>
                      Liên hệ
                    </h2>
                    <p className="mb-4">Nếu bạn có bất kỳ câu hỏi nào về chính sách này, vui lòng liên hệ chúng tôi qua:</p>
                    <div className="flex flex-wrap gap-4">
                      <div className="bg-gray-50 px-6 py-4 rounded-2xl border border-gray-100 flex-1 min-w-[200px]">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Email</p>
                        <p className="text-sm font-bold text-gray-800">t97system@icloud.com</p>
                      </div>
                      <div className="bg-gray-50 px-6 py-4 rounded-2xl border border-gray-100 flex-1 min-w-[200px]">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Telegram</p>
                        <a href="https://t.me/T97system" target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-gray-800 hover:text-blue-600 transition-colors">@T97system</a>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            )}

            {activeTab === 'invoice' && (
              <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-8 border-b border-gray-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                      <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                        <Receipt size={28} className="text-blue-600" /> Lịch sử hoá đơn
                      </h1>
                      <p className="text-sm text-gray-500 mt-1">
                        {isAdmin ? 'Danh sách tất cả giao dịch hệ thống' : 'Tra cứu thông tin giao dịch của bạn'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <button 
                        onClick={() => setActiveTab('activate')}
                        className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 whitespace-nowrap"
                      >
                        <Zap size={16} /> Kích hoạt mới
                      </button>
                      {isAdmin && (
                        <button 
                          onClick={() => setShowAddInvoiceModal(true)}
                          className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2 whitespace-nowrap"
                        >
                          <Receipt size={16} /> Thêm thủ công
                        </button>
                      )}
                    </div>
                  </div>

                  {!isAdmin && (
                    <div className="p-8 bg-gray-50/50 border-b border-gray-50">
                      <form onSubmit={handleSearchInvoice} className="flex gap-3 max-w-md">
                        <div className="relative flex-1">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                          <input 
                            type="text" 
                            value={invoiceSearchUsername}
                            onChange={(e) => setInvoiceSearchUsername(e.target.value)}
                            placeholder="Nhập Username Locket..."
                            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-medium"
                          />
                        </div>
                        <button 
                          type="submit"
                          className="bg-gray-800 text-white px-6 py-3 rounded-2xl text-sm font-bold hover:bg-gray-900 transition-colors shadow-lg shadow-gray-200"
                        >
                          Kiểm tra
                        </button>
                      </form>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50/50">
                          <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Username</th>
                          <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Mã giao dịch</th>
                          <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ngày mua</th>
                          <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Hạn sử dụng</th>
                          <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Số tiền</th>
                          {isAdmin && <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Thao tác</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {invoicesLoading ? (
                          <tr>
                            <td colSpan={isAdmin ? 6 : 5} className="px-8 py-12 text-center">
                              <Loader2 className="animate-spin mx-auto text-blue-600 mb-2" size={32} />
                              <p className="text-sm text-gray-500">Đang tải dữ liệu...</p>
                            </td>
                          </tr>
                        ) : invoices.length === 0 ? (
                          <tr>
                            <td colSpan={isAdmin ? 6 : 5} className="px-8 py-12 text-center">
                              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                                <Search size={32} />
                              </div>
                              <p className="text-sm text-gray-500 font-medium">
                                {isAdmin ? 'Chưa có giao dịch nào trên hệ thống.' : 'Vui lòng nhập username để tra cứu hoá đơn.'}
                              </p>
                            </td>
                          </tr>
                        ) : (
                          invoices.map((inv) => {
                            const purchaseDate = new Date(inv.purchaseDate);
                            const expiryDate = new Date(purchaseDate.getTime() + 30 * 24 * 60 * 60 * 1000);
                            const now = new Date();
                            const isExpired = now > expiryDate;
                            const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

                            return (
                              <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-8 py-5">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-bold text-xs">
                                      {inv.username?.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="font-bold text-gray-800 text-sm">{inv.username}</span>
                                  </div>
                                </td>
                                <td className="px-8 py-5">
                                  <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">#{inv.transactionId}</span>
                                </td>
                                <td className="px-8 py-5 text-sm text-gray-600">
                                  {purchaseDate.toLocaleDateString('vi-VN')}
                                </td>
                                <td className="px-8 py-5">
                                  <div className="flex flex-col">
                                    <span className={`text-xs font-bold ${isExpired ? 'text-red-500' : 'text-emerald-600'}`}>
                                      {isExpired ? 'Hết hạn' : `Còn ${daysLeft} ngày`}
                                    </span>
                                    <span className="text-[10px] text-gray-400">{expiryDate.toLocaleDateString('vi-VN')}</span>
                                  </div>
                                </td>
                                <td className="px-8 py-5 text-right font-bold text-blue-600 text-sm">
                                  {(inv.amount || 10000).toLocaleString('vi-VN')}đ
                                </td>
                                {isAdmin && (
                                  <td className="px-8 py-5 text-center">
                                    <button 
                                      onClick={() => handleDeleteInvoice(inv.id)}
                                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Xoá hoá đơn"
                                    >
                                      <X size={16} />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="p-6 bg-gray-50/50 border-t border-gray-50">
                    <p className="text-[10px] text-gray-400 text-center italic">
                      * Các tài khoản đã mua sẽ được miễn phí kích hoạt lại trong vòng 30 ngày kể từ ngày thanh toán.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'contact' && (
              <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                    <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                      <Mail size={28} className="text-blue-600" /> Liên hệ hỗ trợ
                    </h1>
                    <div className="space-y-6">
                      <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Email</p>
                        <p className="text-lg font-bold text-gray-800">t97system@icloud.com</p>
                      </div>
                      <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Telegram</p>
                        <a href="https://t.me/T97system" target="_blank" rel="noopener noreferrer" className="text-lg font-bold text-gray-800 hover:text-blue-600 transition-colors">@T97system</a>
                      </div>
                      <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Zalo hỗ trợ</p>
                        <a href="https://zalo.me/g/f1zgpr2a3ejmojsfkwyb" target="_blank" rel="noopener noreferrer" className="text-lg font-bold text-gray-800 hover:text-blue-600 transition-colors">Nhóm Zalo hỗ trợ</a>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                      <Headset size={28} className="text-blue-600" /> Giờ làm việc
                    </h2>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                        <span className="text-sm font-medium text-gray-600">Thứ 2 — Thứ 6</span>
                        <span className="text-sm font-bold text-gray-800">8:00 — 22:00</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                        <span className="text-sm font-medium text-gray-600">Thứ 7 — Chủ nhật</span>
                        <span className="text-sm font-bold text-gray-800">9:00 — 21:00</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-blue-50 rounded-xl border border-blue-100">
                        <span className="text-sm font-bold text-blue-800">Kích hoạt tự động</span>
                        <span className="text-sm font-bold text-blue-800 flex items-center gap-1">
                          <Zap size={14} fill="currentColor" /> 24/7
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 italic mt-4">Ngoài giờ hỗ trợ, bạn vẫn có thể để lại tin nhắn. Chúng tôi sẽ phản hồi ngay khi online!</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                  <h2 className="text-xl font-bold text-gray-800 mb-6">Câu hỏi thường gặp</h2>
                  <div className="space-y-6">
                    <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
                      <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                        Tại sao up locket gold một lúc lại rụng?
                      </h3>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        Do bạn chưa cài dns hoặc dns quá tải bạn chỉ cần xoá dns cũ sau đó kích hoạt lại và cài lại dns là được.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        <div
          onClick={toggleSupport}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-400 rounded-full shadow-lg shadow-blue-300/50 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform z-50"
        >
          {isSupportOpen ? <X size={24} className="text-white" /> : <Headset size={24} className="text-white" />}
        </div>

        <div
          className={`fixed bottom-24 right-6 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden transition-all duration-300 origin-bottom-right ${
            isSupportOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
          }`}
        >
          <div className="bg-gradient-to-r from-blue-600 to-blue-400 px-5 py-4 text-white relative">
            <button onClick={toggleSupport} className="absolute top-3 right-3 text-white/70 hover:text-white transition">
              <X size={16} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Headset size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm">Hỗ trợ khách hàng</h3>
                <p className="text-xs text-blue-100 flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-400 rounded-full inline-block"></span> Online — Phản hồi nhanh
                </p>
              </div>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-sm text-gray-500 text-center">Chọn kênh hỗ trợ bên dưới 👇</p>
            <a href="https://t.me/T97system" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3 bg-sky-50 hover:bg-sky-100 rounded-xl transition group">
              <div className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">Tele</span>
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm text-gray-800">Telegram</p>
                <p className="text-xs text-gray-400">@T97system</p>
              </div>
              <ArrowRight size={16} className="text-gray-300 group-hover:text-sky-500 transition" />
            </a>
            <a href="https://zalo.me/g/f1zgpr2a3ejmojsfkwyb" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-xl transition group">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">Zalo</span>
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm text-gray-800">Nhóm Zalo</p>
                <p className="text-xs text-gray-400">Hỗ trợ 24/7</p>
              </div>
              <ArrowRight size={16} className="text-gray-300 group-hover:text-blue-600 transition" />
            </a>
          </div>
        </div>
        {/* Manual Invoice Modal */}
        {showAddInvoiceModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-emerald-50">
                <h3 className="text-lg font-bold text-emerald-800 flex items-center gap-2">
                  <Receipt size={20} /> Thêm hoá đơn thủ công
                </h3>
                <button onClick={() => setShowAddInvoiceModal(false)} className="text-emerald-400 hover:text-emerald-600 transition">
                  <X size={20} />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Username Locket</label>
                  <input 
                    type="text" 
                    value={newInvoiceData.username}
                    onChange={(e) => setNewInvoiceData({...newInvoiceData, username: e.target.value})}
                    placeholder="Nhập username..."
                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all text-sm font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Mã giao dịch</label>
                  <input 
                    type="text" 
                    value={newInvoiceData.transactionId}
                    onChange={(e) => setNewInvoiceData({...newInvoiceData, transactionId: e.target.value})}
                    placeholder="Nhập mã giao dịch..."
                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all text-sm font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Số tiền (VNĐ)</label>
                  <input 
                    type="number" 
                    value={newInvoiceData.amount}
                    onChange={(e) => setNewInvoiceData({...newInvoiceData, amount: e.target.value})}
                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all text-sm font-medium"
                  />
                </div>
                
                <button 
                  onClick={handleAddManualInvoice}
                  disabled={loading}
                  className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                  Xác nhận thêm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
