import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { 
  Camera, Send, Check, X, Play, Image as ImageIcon, 
  Monitor, Smartphone, Settings, Trash2, Maximize, 
  Mic, Layout, Activity, AlertCircle
} from 'lucide-react';
// CHANGED: Using HashRouter for safer deployment/preview
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom';

// --- Firebase Configuration ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app';

// --- Broadcast Channel for Local Media Streaming ---
const mediaChannel = new BroadcastChannel('event_media_channel');

// --- Helper Components ---
const Button = ({ onClick, children, variant = "primary", className = "", disabled = false }) => {
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/30",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-500/30",
    danger: "bg-rose-500 text-white hover:bg-rose-600 shadow-lg shadow-rose-500/30",
    ghost: "bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm",
    outline: "border-2 border-white/20 text-white hover:bg-white/10"
  };
  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

// --- View: Client (Attendee) ---
const ClientView = ({ user }) => {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [image, setImage] = useState(null);
  const [status, setStatus] = useState('idle');

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 500000) { 
        alert("Image is too large! Please choose one under 500KB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;

    setStatus('uploading');
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'messages'), {
        author: name,
        text: message,
        imageBase64: image,
        status: 'pending',
        createdAt: serverTimestamp(),
        userId: user.uid
      });
      setStatus('sent');
      setMessage('');
      setImage(null);
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      console.error("Error sending message:", error);
      setStatus('idle');
      alert("Failed to send. Please try again.");
    }
  };

  if (status === 'sent') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-emerald-900 text-center animate-in fade-in zoom-in duration-500 text-white p-6">
        <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-emerald-500/50">
          <Check size={48} className="text-white" />
        </div>
        <h2 className="text-4xl font-bold mb-2">Sent!</h2>
        <p className="text-emerald-200 text-lg max-w-xs mx-auto">Your message has been beamed to the control booth.</p>
        <Button variant="ghost" className="mt-12 w-full max-w-xs border border-white/20" onClick={() => setStatus('idle')}>Send Another</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center relative overflow-hidden font-sans">
      <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-indigo-600/20 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] bg-purple-600/20 rounded-full blur-[100px]" />

      <div className="w-full max-w-md z-10 p-6 flex-1 flex flex-col">
        <header className="text-center mb-8 mt-4">
          <div className="inline-block p-3 bg-white/5 rounded-2xl mb-4 backdrop-blur-md border border-white/10">
            <Smartphone className="text-indigo-400" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">EventCast</h1>
          <p className="text-slate-400 mt-1">Share your moment on the big screen</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5 flex-1">
          <div className="group">
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider ml-1">Who are you?</label>
            <input 
              required
              className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white/10 transition-all outline-none"
              placeholder="Your Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider ml-1">Your Message</label>
            <textarea 
              required
              rows={4}
              className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white/10 transition-all outline-none resize-none"
              placeholder="Type a wish, shoutout, or question..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider ml-1">Attach a Photo</label>
            <div className="border-2 border-dashed border-white/10 bg-white/5 rounded-xl overflow-hidden hover:bg-white/10 transition-all relative group cursor-pointer h-32 flex items-center justify-center">
              <input 
                type="file" 
                accept="image/*"
                onChange={handleImageChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
              />
              {image ? (
                <>
                  <img src={image} alt="Preview" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity" />
                  <div className="z-10 flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-md">
                    <Check size={14} className="text-emerald-400" /> <span className="text-white text-xs font-medium">Photo Added</span>
                  </div>
                  <button 
                    type="button"
                    onClick={(e) => { e.preventDefault(); setImage(null); }}
                    className="absolute top-2 right-2 bg-rose-500 text-white rounded-full p-1.5 z-30 hover:bg-rose-600 shadow-lg"
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center text-slate-400 group-hover:text-white transition-colors">
                  <Camera size={28} className="mb-2" />
                  <span className="text-sm font-medium">Tap to upload photo</span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4">
            <Button variant="primary" className="w-full py-4 text-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 border-0" disabled={status === 'uploading'}>
              {status === 'uploading' ? 'Sending...' : 'Send to Stage'} <Send size={20} />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- View: Control (Moderator) ---
const ControlView = ({ user }) => {
  const [messages, setMessages] = useState([]);
  const [activeTab, setActiveTab] = useState('moderation');
  const [fileInputKey, setFileInputKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', 'messages'),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
      (error) => console.error("Error:", error)
    );
    return () => unsubscribe();
  }, [user]);

  const handleStatus = async (id, newStatus) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'messages', id), { status: newStatus });
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this message?')) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'messages', id));
    }
  };

  const handleMediaUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const type = file.type.startsWith('image/') ? 'IMAGE' : 'VIDEO';
    mediaChannel.postMessage({ type: 'MEDIA_UPDATE', mediaType: type, file: file, name: file.name });
    setFileInputKey(prev => prev + 1);
  };

  const clearMedia = () => mediaChannel.postMessage({ type: 'MEDIA_CLEAR' });

  const pendingMessages = messages.filter(m => m.status === 'pending');
  const approvedMessages = messages.filter(m => m.status === 'approved');

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      <header className="bg-slate-900 text-white px-6 py-3 flex justify-between items-center shadow-lg sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Layout size={20} />
          </div>
          <h1 className="font-bold text-lg tracking-wide">EVENT<span className="text-indigo-400">CAST</span> <span className="opacity-50 font-normal text-sm ml-2">| Control Room</span></h1>
        </div>
        <div className="flex gap-1 bg-slate-800 p-1 rounded-lg">
          {['moderation', 'media'].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all capitalize ${
                activeTab === tab 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {activeTab === 'moderation' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-100px)]">
            <div className="lg:col-span-7 flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-slate-700 font-bold flex items-center gap-2">
                  <AlertCircle size={18} className="text-amber-500" /> Incoming Queue
                </h2>
                <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">{pendingMessages.length} Pending</span>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 space-y-3 pb-20">
                {pendingMessages.length === 0 && (
                  <div className="h-64 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50">
                    <Check size={48} className="mb-4 opacity-20" />
                    <p>All caught up!</p>
                  </div>
                )}
                {pendingMessages.map(msg => (
                  <div key={msg.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow animate-in slide-in-from-left-4 duration-300">
                    <div className="flex gap-4">
                      {msg.imageBase64 && (
                        <div className="flex-shrink-0">
                          <img src={msg.imageBase64} className="w-24 h-24 rounded-lg object-cover border border-slate-100 bg-slate-50" alt="User" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-slate-800 text-lg truncate">{msg.author}</h3>
                          <span className="text-xs text-slate-400 whitespace-nowrap">{new Date(msg.createdAt?.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <p className="text-slate-600 leading-relaxed mb-4 text-sm">{msg.text}</p>
                        <div className="flex gap-3">
                          <button onClick={() => handleStatus(msg.id, 'approved')} className="flex-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"><Check size={16} /> Approve</button>
                          <button onClick={() => handleDelete(msg.id)} className="bg-slate-100 text-slate-600 hover:bg-rose-100 hover:text-rose-600 px-3 py-2 rounded-lg transition-colors"><Trash2 size={18} /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:col-span-5 flex flex-col h-full bg-slate-50 border-l border-slate-200 pl-8 -my-6 py-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-slate-700 font-bold flex items-center gap-2">
                  <Activity size={18} className="text-emerald-500" /> Live Feed
                </h2>
                <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full">{approvedMessages.length} Live</span>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 space-y-3 pb-20">
                 {approvedMessages.length === 0 && (
                  <div className="text-center py-12 text-slate-400">No messages on screen</div>
                )}
                {approvedMessages.map(msg => (
                  <div key={msg.id} className="bg-white/80 backdrop-blur rounded-lg border border-slate-200 p-4 flex gap-3 opacity-75 hover:opacity-100 transition-opacity group">
                     <div className="flex-1">
                      <div className="flex justify-between">
                        <span className="font-bold text-slate-700 text-sm">{msg.author}</span>
                        <button onClick={() => handleStatus(msg.id, 'pending')} className="text-xs text-indigo-500 hover:underline opacity-0 group-hover:opacity-100 transition-opacity">Undo</button>
                      </div>
                      <p className="text-slate-600 text-xs line-clamp-2 mt-1">{msg.text}</p>
                    </div>
                     {msg.imageBase64 && <img src={msg.imageBase64} className="w-10 h-10 rounded object-cover" alt="User" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {activeTab === 'media' && (
          <div className="max-w-2xl mx-auto pt-12">
             <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
               <div className="bg-slate-900 text-white p-8 text-center">
                 <Monitor size={48} className="mx-auto mb-4 text-indigo-400" />
                 <h2 className="text-2xl font-bold">Stage Media Controller</h2>
                 <p className="text-slate-400 mt-2">Stream local files directly to the Output screen.</p>
               </div>
               <div className="p-8">
                 <div className="grid grid-cols-2 gap-6 mb-8">
                    <label className="cursor-pointer bg-indigo-50 hover:bg-indigo-100 border-2 border-indigo-100 hover:border-indigo-300 rounded-2xl p-8 flex flex-col items-center gap-4 transition-all group text-center">
                      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform"><Play className="text-indigo-600 ml-1" size={32} /></div>
                      <div><span className="font-bold text-indigo-900 block">Play Video</span><span className="text-indigo-600/60 text-xs">MP4, WebM</span></div>
                      <input key={`vid-${fileInputKey}`} type="file" accept="video/*" className="hidden" onChange={handleMediaUpload} />
                    </label>
                     <label className="cursor-pointer bg-pink-50 hover:bg-pink-100 border-2 border-pink-100 hover:border-pink-300 rounded-2xl p-8 flex flex-col items-center gap-4 transition-all group text-center">
                      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform"><ImageIcon className="text-pink-600" size={32} /></div>
                      <div><span className="font-bold text-pink-900 block">Show Image</span><span className="text-pink-600/60 text-xs">JPG, PNG</span></div>
                      <input key={`img-${fileInputKey}`} type="file" accept="image/*" className="hidden" onChange={handleMediaUpload} />
                    </label>
                 </div>
                 <button onClick={clearMedia} className="w-full py-4 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors flex items-center justify-center gap-2"><X size={20} /> Clear Screen to Black</button>
               </div>
             </div>
          </div>
        )}
      </main>
    </div>
  );
};

// --- View: Output (Big Screen) ---
const OutputView = ({ user }) => {
  const [currentMedia, setCurrentMedia] = useState(null);
  const [messages, setMessages] = useState([]);
  const [tickerIndex, setTickerIndex] = useState(0);

  useEffect(() => {
    mediaChannel.onmessage = (event) => {
      const { type, mediaType, file } = event.data;
      if (type === 'MEDIA_CLEAR') { setCurrentMedia(null); return; }
      if (type === 'MEDIA_UPDATE' && file) {
        const url = URL.createObjectURL(file);
        setCurrentMedia({ type: mediaType, url });
      }
    };
    return () => {
      if (currentMedia?.url) URL.revokeObjectURL(currentMedia.url);
      mediaChannel.onmessage = null;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'messages'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const allMsgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(allMsgs.filter(m => m.status === 'approved'));
    });
  }, [user]);

  useEffect(() => {
    if (messages.length === 0) return;
    const timer = setInterval(() => setTickerIndex(prev => (prev + 1) % messages.length), 10000);
    return () => clearInterval(timer);
  }, [messages.length]);

  const activeMessage = messages[tickerIndex];

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden flex items-center justify-center font-sans cursor-none">
      <div className="absolute inset-0 z-0">
        {currentMedia ? (
          currentMedia.type === 'VIDEO' ? (
            <video src={currentMedia.url} className="w-full h-full object-contain" autoPlay loop />
          ) : (
            <img src={currentMedia.url} className="w-full h-full object-contain" alt="Background" />
          )
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-black">
            <h1 className="text-[15vw] font-black text-white tracking-tighter opacity-5 animate-pulse select-none">EVENT</h1>
          </div>
        )}
      </div>
      {activeMessage && (
        <div key={activeMessage.id} className="absolute bottom-16 left-16 z-20 max-w-5xl animate-in slide-in-from-bottom-20 fade-in duration-700">
          <div className="flex items-end gap-6">
            {activeMessage.imageBase64 && (
              <div className="relative group">
                <div className="absolute inset-0 bg-indigo-500 blur-lg opacity-50"></div>
                <img src={activeMessage.imageBase64} className="relative w-48 h-48 rounded-2xl object-cover border-4 border-white shadow-2xl" alt="User" />
              </div>
            )}
            <div className="bg-black/80 backdrop-blur-xl p-8 rounded-tr-3xl rounded-tl-3xl rounded-br-3xl border-l-8 border-indigo-500 shadow-2xl">
              <h3 className="text-5xl font-bold text-indigo-400 mb-4 tracking-wide font-sans drop-shadow-md">{activeMessage.author}</h3>
              <p className="text-4xl font-medium text-white leading-snug drop-shadow-md max-w-3xl">"{activeMessage.text}"</p>
            </div>
          </div>
        </div>
      )}
      <button onClick={() => document.documentElement.requestFullscreen()} className="absolute top-4 right-4 text-white/10 hover:text-white z-50 p-2 transition-colors"><Maximize /></button>
    </div>
  );
};

// --- View: Landing (Menu) ---
const LandingView = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white font-sans relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
      <div className="z-10 text-center mb-16">
        <div className="inline-flex items-center justify-center p-4 bg-indigo-600 rounded-3xl mb-6 shadow-2xl shadow-indigo-500/30"><Layout size={48} /></div>
        <h1 className="text-6xl font-black tracking-tight mb-4">EventCast</h1>
        <p className="text-xl text-slate-400">Real-time Interactive Event System</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full z-10">
        {[
          { id: '/attendee', icon: Smartphone, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', title: 'Attendee', desc: 'Post messages & photos' },
          { id: '/control', icon: Settings, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', title: 'Control', desc: 'Moderation & Media' },
          { id: '/output', icon: Monitor, color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20', title: 'Output', desc: 'Main Stage Display' },
        ].map(opt => (
          <button key={opt.id} onClick={() => navigate(opt.id)} className={`group relative overflow-hidden ${opt.bg} border ${opt.border} hover:bg-white/10 backdrop-blur-sm rounded-3xl p-8 text-left transition-all hover:-translate-y-2 hover:shadow-2xl`}>
            <opt.icon size={40} className={`${opt.color} mb-6`} />
            <h2 className="text-2xl font-bold mb-2">{opt.title}</h2>
            <p className="text-slate-400">{opt.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

// --- Main App Component with Routing ---
export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        // Attempt to sign in with custom token if provided (usually by the environment)
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          // Fallback to anonymous if no token provided
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.warn("Custom token auth failed, falling back to anonymous:", error);
        // If custom token fails (e.g. due to API key mismatch), fall back to anonymous
        await signInAnonymously(auth);
      }
    };
    init();
    return onAuthStateChanged(auth, setUser);
  }, []);

  if (!user) return <div className="h-screen flex items-center justify-center bg-slate-900 text-white">Connecting...</div>;

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LandingView />} />
        <Route path="/attendee" element={<ClientView user={user} />} />
        <Route path="/control" element={<ControlView user={user} />} />
        <Route path="/output" element={<OutputView user={user} />} />
      </Routes>
    </HashRouter>
  );
}