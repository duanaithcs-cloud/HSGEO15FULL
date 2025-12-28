
import React, { useState, useEffect, useMemo } from 'react';
import { ViewType, VaultEntry, UploadedFile } from './types';
import LandingView from './views/LandingView';
import UploadView from './views/UploadView';
import ChatView from './views/ChatView';
import VaultView from './views/VaultView';
import { processDocumentToChunks } from './services/geminiService';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewType>(ViewType.LANDING);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isTrackingEnabled, setIsTrackingEnabled] = useState(false);
  const [restoredEntry, setRestoredEntry] = useState<VaultEntry | null>(null);
  
  // State quản lý tệp tin toàn cục để hỗ trợ Xử lý Song song
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const [vaultEntries, setVaultEntries] = useState<VaultEntry[]>(() => {
    const saved = localStorage.getItem('galaxy_vault_entries');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((e: any) => ({ ...e, timestamp: new Date(e.timestamp) }));
      } catch (e) { return []; }
    }
    return [
      { id: '1', title: 'Phân tích ảnh hưởng của địa hình đến khí hậu Việt Nam?', content: 'Biển Đông là nhân tố quan trọng nhất ảnh hưởng sâu sắc đến tính chất nhiệt đới ẩm gió mùa của thiên nhiên nước ta...', timestamp: new Date('2024-05-12'), size: '4.2 MB', status: 'cloud_done' },
      { id: '2', title: 'Đặc điểm chung của địa hình Việt Nam', content: 'Địa hình nước ta rất đa dạng, đồi núi chiếm 3/4 diện tích nhưng chủ yếu là đồi núi thấp...', timestamp: new Date('2024-05-10'), size: '12.5 MB', status: 'cloud_off' }
    ];
  });

  // Background Processor: Tự động nạp tri thức chạy ngầm toàn thời gian
  useEffect(() => {
    const hasProcessing = uploadedFiles.some(f => f.status === 'processing');
    if (hasProcessing) {
      const timer = setInterval(() => {
        setUploadedFiles(prev => {
          let updated = false;
          const newFiles = prev.map(f => {
            if (f.status === 'processing') {
              updated = true;
              const nextProgress = f.progress + 5;
              if (nextProgress >= 100) {
                // Khi đạt 100%, nạp tệp vào bộ nhớ RAG
                processDocumentToChunks(f.name, "Nội dung tài liệu Địa lí đã được nạp.", f.id);
                return { ...f, progress: 100, status: 'completed' as const };
              }
              return { ...f, progress: nextProgress };
            }
            return f;
          });
          return updated ? newFiles : prev;
        });
      }, 400); // Tốc độ xử lý mô phỏng
      return () => clearInterval(timer);
    }
  }, [uploadedFiles]);

  useEffect(() => {
    localStorage.setItem('galaxy_vault_entries', JSON.stringify(vaultEntries));
  }, [vaultEntries]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  const addVaultEntry = (title: string, content: string) => {
    if (!isTrackingEnabled) return;
    const newEntry: VaultEntry = {
      id: Date.now().toString(),
      title: title.length > 100 ? title.substring(0, 100) + '...' : title,
      content,
      timestamp: new Date(),
      size: `${(content.length / 1024).toFixed(1)} KB`,
      status: 'cloud_upload'
    };
    setVaultEntries(prev => [newEntry, ...prev]);
  };

  const handleRestoreFromVault = (entry: VaultEntry) => {
    setRestoredEntry(entry);
    setCurrentView(ViewType.CHAT);
  };

  // Tính toán tiến độ nạp tri thức trung bình toàn cục
  const globalProgress = useMemo(() => {
    if (uploadedFiles.length === 0) return null;
    const processingFiles = uploadedFiles.filter(f => f.status === 'processing');
    if (processingFiles.length === 0) return null;
    const sum = processingFiles.reduce((acc, f) => acc + f.progress, 0);
    return Math.round(sum / processingFiles.length);
  }, [uploadedFiles]);

  const renderView = () => {
    switch (currentView) {
      case ViewType.LANDING:
        return <LandingView onNavigate={setCurrentView} />;
      case ViewType.UPLOAD:
        return (
          <UploadView 
            onBack={() => setCurrentView(ViewType.LANDING)} 
            onComplete={() => setCurrentView(ViewType.CHAT)}
            uploadedFiles={uploadedFiles}
            setUploadedFiles={setUploadedFiles}
          />
        );
      case ViewType.CHAT:
        return (
          <ChatView 
            onBack={() => {
              setCurrentView(ViewType.LANDING);
              setRestoredEntry(null);
            }} 
            isTracking={isTrackingEnabled} 
            onAutoSave={addVaultEntry}
            restoredEntry={restoredEntry}
            processingProgress={globalProgress}
          />
        );
      case ViewType.VAULT:
        return (
          <VaultView 
            onBack={() => setCurrentView(ViewType.LANDING)} 
            isTracking={isTrackingEnabled} 
            setIsTracking={setIsTrackingEnabled}
            entries={vaultEntries}
            setEntries={setVaultEntries}
            onRestore={handleRestoreFromVault}
          />
        );
      default:
        return <LandingView onNavigate={setCurrentView} />;
    }
  };

  const navItems = [
    { type: ViewType.LANDING, icon: 'home', label: 'Trang chủ' },
    { type: ViewType.UPLOAD, icon: 'cloud_upload', label: 'Tải tài liệu học tập' },
    { type: ViewType.CHAT, icon: 'chat', label: 'Hỏi–đáp Địa lí thông minh' },
    { type: ViewType.VAULT, icon: 'verified_user', label: 'Lưu trữ & Bảo mật' },
  ];

  return (
    <div className="relative w-full min-h-screen bg-background-light dark:bg-background-dark flex flex-row overflow-hidden text-slate-900 dark:text-slate-100">
      
      {/* Desktop Sidebar Nav */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-50 shadow-soft">
        <div className="p-6 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-glow">
            <span className="material-symbols-outlined text-[24px]">public</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-black tracking-widest text-primary uppercase leading-tight">Galaxy RAG</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Trợ lý Địa lí</span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.type}
              onClick={() => {
                setCurrentView(item.type);
                if (item.type !== ViewType.CHAT) setRestoredEntry(null);
              }}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                currentView === item.type
                  ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <div className="flex-1 text-left flex items-center justify-between">
                <span>{item.label}</span>
                {item.type === ViewType.UPLOAD && globalProgress !== null && (
                  <span className="flex size-2 rounded-full bg-primary animate-ping"></span>
                )}
              </div>
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-200 dark:border-slate-800 space-y-4">
          <button 
            onClick={toggleDarkMode}
            className="w-full flex items-center gap-4 px-4 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <span className="material-symbols-outlined">
              {isDarkMode ? 'light_mode' : 'dark_mode'}
            </span>
            {isDarkMode ? 'Giao diện sáng' : 'Giao diện tối'}
          </button>
          <div className="flex items-center gap-3 px-2">
            <div className="size-8 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden ring-2 ring-primary/20">
               <img src="https://picsum.photos/seed/user/100" alt="user" />
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-xs font-bold truncate">Th.S Phùng Tiến</span>
              <span className="text-[9px] text-slate-500 uppercase font-black">Quyền Quản trị</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative flex flex-col h-screen overflow-hidden">
        {renderView()}
      </main>

      {/* Mobile Dark Mode Toggle (Floating) */}
      <button 
        onClick={toggleDarkMode}
        className="md:hidden fixed bottom-4 left-4 z-50 p-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-full shadow-lg border border-slate-200 dark:border-slate-700"
      >
        <span className="material-symbols-outlined text-primary">
          {isDarkMode ? 'light_mode' : 'dark_mode'}
        </span>
      </button>
    </div>
  );
};

export default App;
