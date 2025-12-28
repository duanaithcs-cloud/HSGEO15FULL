
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, VaultEntry } from '../types';
import { 
  generateGeographyAnswerStream, 
  generateGeographyInfographic,
  retrieveRelevantContext 
} from '../services/geminiService';
import { GenerateContentResponse } from '@google/genai';

interface ChatViewProps {
  onBack: () => void;
  isTracking?: boolean;
  onAutoSave?: (title: string, content: string) => void;
  restoredEntry?: VaultEntry | null;
  processingProgress: number | null; 
}

const ChatView: React.FC<ChatViewProps> = ({ onBack, isTracking, onAutoSave, restoredEntry, processingProgress }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { 
      id: '1', 
      role: 'assistant', 
      content: '### **Chào em! Thầy/Cô là Trợ lý Địa lí thông minh.** 👋\n\nThầy/Cô đã sẵn sàng giải đáp mọi thắc mắc dựa trên tài liệu em đã cung cấp. Em muốn tìm hiểu về nội dung nào hôm nay?\n\nHãy đặt câu hỏi bằng văn bản hoặc giọng nói, Thầy/Cô sẽ phân tích tri thức và thiết kế những sơ đồ trực quan để giúp em học tập hiệu quả nhất nhé!', 
      timestamp: new Date() 
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isDesigning, setIsDesigning] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [retrievalStatus, setRetrievalStatus] = useState<'idle' | 'searching' | 'grounding' | 'visualizing'>('idle');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<{ data: string, mimeType: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (restoredEntry) {
      const restoredUserMsg: ChatMessage = {
        id: `restored-user-${restoredEntry.id}`,
        role: 'user',
        content: restoredEntry.title,
        timestamp: restoredEntry.timestamp
      };
      
      const restoredAssistantMsg: ChatMessage = {
        id: `restored-assistant-${restoredEntry.id}`,
        role: 'assistant',
        content: `🕒 **[PHIÊN LÀM VIỆC ĐÃ KHÔI PHỤC]**\n\n${restoredEntry.content}`,
        timestamp: restoredEntry.timestamp,
        isRetrieved: true
      };
      
      setMessages([
        { id: 'start', role: 'assistant', content: '### **Đã khôi phục tri thức cũ!** 🕒\n\nThầy/Cô đã sẵn sàng để tiếp tục buổi học từ nội dung em đã lưu.', timestamp: new Date() },
        restoredUserMsg,
        restoredAssistantMsg
      ]);
    }
  }, [restoredEntry]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isTyping, isDesigning, retrievalStatus]);

  // Setup Voice Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.lang = 'vi-VN';
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => (prev ? prev + ' ' + transcript : transcript));
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Lỗi nhận diện giọng nói:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setIsListening(true);
      recognitionRef.current?.start();
    }
  };

  const checkAndOpenKey = async () => {
    // @ts-ignore
    if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
            await window.aistudio.openSelectKey();
        }
    }
    return true;
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        setImagePreview({ data: base64, mimeType: file.type });
      };
      reader.readAsDataURL(file);
    }
  };

  const downloadImage = (base64Data: string, filename: string = 'galaxy-infographic.png') => {
    const link = document.createElement('a');
    link.href = base64Data;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleSend = async () => {
    if ((!input.trim() && !imagePreview) || isTyping) return;

    await checkAndOpenKey();

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input || "Giải đáp câu hỏi từ hình ảnh",
      timestamp: new Date(),
      image: imagePreview ? `data:${imagePreview.mimeType};base64,${imagePreview.data}` : undefined
    };
    
    setMessages(prev => [...prev, userMsg]);
    const currentInput = input;
    const currentImage = imagePreview;
    
    setInput('');
    setImagePreview(null);
    setIsTyping(true);
    setRetrievalStatus('searching');

    try {
      const context = retrieveRelevantContext(currentInput);
      setRetrievalStatus('grounding');

      const assistantId = (Date.now() + 1).toString();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isRetrieved: !!context
      };
      setMessages(prev => [...prev, assistantMsg]);

      let fullAssistantContent = '';
      
      const textPromise = (async () => {
        try {
          const stream = await generateGeographyAnswerStream(currentInput, context, processingProgress, currentImage || undefined);
          for await (const chunk of stream) {
            const c = chunk as GenerateContentResponse;
            const text = c.text;
            if (text) {
              fullAssistantContent += text;
              setMessages(prev => prev.map(m => 
                m.id === assistantId ? { ...m, content: fullAssistantContent } : m
              ));
            }
          }
        } catch (error: any) {
          console.error("Lỗi stream văn bản:", error);
        }
      })();

      const imagePromise = (async () => {
        if (currentImage) return;
        try {
          setIsDesigning(true);
          const infographicData = await generateGeographyInfographic(
            currentInput, 
            context || "Kiến thức địa lí phổ thông về chủ đề này."
          );
          if (infographicData) {
            setMessages(prev => prev.map(m => 
              m.id === assistantId ? { ...m, image: infographicData } : m
            ));
          }
        } catch (error) { 
          console.error("Lỗi vẽ sơ đồ:", error); 
        } finally { 
          setIsDesigning(false); 
        }
      })();

      await Promise.all([textPromise, imagePromise]);
      
      if (isTracking && onAutoSave) {
        onAutoSave(currentInput || "Câu hỏi qua hình ảnh", fullAssistantContent);
      }

      setIsTyping(false);
      setRetrievalStatus('idle');
    } catch (error) {
      console.error("Lỗi hệ thống:", error);
      setIsTyping(false);
      setRetrievalStatus('idle');
    }
  };

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark relative">
      <header className="relative flex items-center justify-between p-4 md:p-6 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 z-30">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="md:hidden flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <span className="material-symbols-outlined text-2xl">arrow_back</span>
          </button>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">Cố vấn Địa lí Thông minh</h2>
            <div className="flex items-center gap-2">
              {processingProgress !== null ? (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                    Đang học tài liệu ({processingProgress}%)
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded-full">
                  <span className="material-symbols-outlined text-[10px] text-green-600">verified</span>
                  <span className="text-[8px] font-black text-green-600 uppercase tracking-widest">✅ Tri thức đã sẵn sàng</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {processingProgress !== null && (
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-slate-100 dark:bg-slate-800">
            <div 
              className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)] transition-all duration-500" 
              style={{ width: `${processingProgress}%` }}
            ></div>
          </div>
        )}
      </header>

      <main ref={scrollRef} className="flex-1 overflow-y-auto w-full no-scrollbar">
        <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
          {messages.map(msg => (
            <div key={msg.id} className={`flex items-start gap-4 fade-up ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`flex size-10 shrink-0 items-center justify-center rounded-full shadow-sm ${msg.role === 'assistant' ? 'bg-primary text-white shadow-glow' : 'bg-white dark:bg-slate-800 text-slate-400 border dark:border-slate-700'}`}>
                <span className="material-symbols-outlined text-xl">{msg.role === 'assistant' ? 'school' : 'person'}</span>
              </div>
              <div className={`flex flex-col gap-2 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`group relative p-5 rounded-2xl shadow-sm border leading-relaxed text-[15px] ${msg.role === 'user' ? 'bg-primary text-white border-primary rounded-tr-none' : 'bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 border-slate-100 dark:border-slate-700 rounded-tl-none shadow-soft'}`}>
                  
                  <div className={`absolute top-2 ${msg.role === 'user' ? 'left-2' : 'right-2'} opacity-0 group-hover:opacity-100 transition-opacity z-20`}>
                    <button 
                      onClick={() => copyToClipboard(msg.content, msg.id)}
                      className={`p-1.5 rounded-lg backdrop-blur-md shadow-sm border flex items-center justify-center transition-all active:scale-90 ${msg.role === 'user' ? 'bg-white/20 border-white/30 text-white' : 'bg-slate-100/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-primary'}`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {copiedId === msg.id ? 'check' : 'content_copy'}
                      </span>
                    </button>
                  </div>

                  <div className={`prose prose-sm md:prose-base dark:prose-invert max-w-none ${msg.role === 'user' ? 'prose-headings:text-white prose-p:text-white' : ''}`}>
                     <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  
                  {msg.image && (
                    <div className="mt-4 relative group/img rounded-xl overflow-hidden border-2 border-slate-100 dark:border-slate-700 shadow-lg">
                      {msg.role === 'user' && (
                        <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[9px] font-black text-white uppercase tracking-widest">
                          Hình ảnh gửi đi
                        </div>
                      )}
                      <img src={msg.image} className="w-full h-auto" alt="Dữ liệu địa lí" />
                      {msg.role === 'assistant' && (
                        <button onClick={() => msg.image && downloadImage(msg.image)} className="absolute top-2 right-2 p-2 bg-white/90 dark:bg-slate-900/90 rounded-lg text-primary shadow-lg opacity-0 group-hover/img:opacity-100 transition-opacity">
                          <span className="material-symbols-outlined">download</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {(isTyping || isDesigning) && (
            <div className="flex flex-col gap-3 py-4 pl-14">
              {isTyping && (
                <div className="flex items-center gap-3 px-5 py-2.5 bg-primary/5 rounded-full border border-primary/10 w-fit animate-pulse">
                  <span className="material-symbols-outlined text-primary animate-spin text-sm">auto_stories</span>
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                    Thầy/Cô đang phân tích nội dung...
                  </span>
                </div>
              )}
              {isDesigning && (
                <div className="flex items-center gap-3 px-5 py-2.5 bg-amber-500/5 rounded-full border border-amber-500/10 w-fit animate-pulse">
                  <span className="material-symbols-outlined text-amber-500 animate-bounce text-sm">draw</span>
                  <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                    Đang thiết kế sơ đồ trực quan...
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="p-4 md:p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
        <div className="max-w-4xl mx-auto space-y-4">
          
          {imagePreview && (
            <div className="relative inline-block fade-up">
              <div className="relative h-20 w-20 rounded-xl overflow-hidden border-2 border-primary shadow-lg">
                <img src={`data:${imagePreview.mimeType};base64,${imagePreview.data}`} className="h-full w-full object-cover" alt="Preview" />
                <button 
                  onClick={() => setImagePreview(null)}
                  className="absolute top-1 right-1 size-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md"
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              </div>
            </div>
          )}

          <div className="flex items-end gap-3">
            <div className="flex items-center gap-1.5 mb-1">
              {/* Mic Button - New Functionality */}
              <button 
                onClick={toggleListening}
                className={`p-2.5 rounded-xl transition-all border shadow-sm flex items-center justify-center relative ${isListening ? 'bg-red-500 text-white border-red-600 animate-pulse' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-primary border-slate-200 dark:border-slate-700'}`}
                title="Nhập bằng giọng nói"
              >
                <span className="material-symbols-outlined">{isListening ? 'mic_active' : 'mic'}</span>
                {isListening && <span className="absolute inset-0 rounded-xl bg-red-400 animate-ping opacity-25"></span>}
              </button>

              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-primary hover:bg-primary/10 transition-all border border-slate-200 dark:border-slate-700"
              >
                <span className="material-symbols-outlined">add_a_photo</span>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </button>
            </div>

            <div className="flex-1 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 flex items-end gap-2 focus-within:border-primary/50 transition-all shadow-inner">
               <textarea 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                className="flex-1 bg-transparent border-none p-0 focus:ring-0 text-[15px] max-h-32 resize-none dark:text-white outline-none" 
                placeholder={isListening ? "Đang nghe..." : "Hỏi địa lí hoặc gửi ảnh tài liệu..."} 
                rows={1}
              />
              <button 
                onClick={handleSend} 
                disabled={isTyping || (!input.trim() && !imagePreview)} 
                className="p-2 rounded-xl bg-primary text-white disabled:opacity-30 transition-all active:scale-95 shadow-glow"
              >
                <span className="material-symbols-outlined font-bold">send</span>
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ChatView;
