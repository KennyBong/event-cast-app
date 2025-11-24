import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  doc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, setDoc, getDoc, getDocs
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken, signOut 
} from 'firebase/auth';
import { 
  Play, Pause, SkipForward, Image as ImageIcon, Video as VideoIcon, 
  MessageSquare, ThumbsUp, Trash2, Check, RotateCcw, Users, 
  Settings, Smartphone, ExternalLink, Heart, Zap, Smile, Send,
  LayoutTemplate, Wand2, Link as LinkIcon, Filter, Eye, EyeOff, Maximize, Sparkles,
  PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Lock, User, Monitor, Download, AlertCircle, Ban, Copy,
  HelpCircle, X, Upload, ImagePlus, Clock, Megaphone, Siren, Save, Music, Volume2, VolumeX, Volume1,
  BarChart3, Database, HardDrive, Sliders, Crop, ZoomIn, ZoomOut, Move, Film
} from 'lucide-react';

// --- 1. FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyC2_UnET0hhqD4IyU5wxvT6r0eJaCNZJGY",
  authDomain: "collaborative-web-app.firebaseapp.com",
  projectId: "collaborative-web-app",
  storageBucket: "collaborative-web-app.firebasestorage.app",
  messagingSenderId: "1082059749132",
  appId: "1:1082059749132:web:105f53f148dd6cc75bbb29",
  measurementId: "G-W4B012BC53"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = (typeof __app_id !== 'undefined' && __app_id) ? __app_id : 'default-app-id';

// --- 2. CONSTANTS & UTILS ---
const EMOJIS = ['❤️', '🔥', '👏', '😂', '😮', '🎉'];
const BROADCAST_CHANNEL_NAME = 'event_stage_sync';
const MASTER_ADMIN = { user: 'admin', pass: 'admin123' };
const DEFAULT_SETTINGS = { imgTimer: 5, textTimer: 5, imgCount: 3, textCount: 5 };
const ANIMATIONS = ['animate-fade-in', 'animate-pop-in', 'animate-slide-in-right'];
const getRandomAnim = () => ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];

const createSlug = (name) => {
  if (!name) return '';
  return String(name).toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, ''); 
};

/**
 * UTILITY: Resize Image to Max Width
 * Reduces file size before upload
 */
const resizeImage = (file, maxWidth = 2048) => {
    return new Promise((resolve) => {
        // Skip resizing for GIFs to preserve animation
        if (file.type === 'image/gif') {
            return resolve(file);
        }

        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            let w = img.width;
            let h = img.height;
            // Only resize if larger than limit
            if (w > maxWidth) {
                h = Math.round(h * (maxWidth / w));
                w = maxWidth;
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            
            canvas.toBlob(blob => {
                const resizedFile = new File([blob], file.name, { type: file.type });
                resolve(resizedFile);
                URL.revokeObjectURL(url);
            }, file.type, 0.9); // 90% Quality
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(file); // Fallback to original
        };
        img.src = url;
    });
};

// --- 3. COMPONENTS ---

/**
 * IMAGE CROPPER COMPONENT
 * Enforces 4:5 Portrait Ratio
 */
const ImageCropper = ({ imageSrc, onConfirm, onCancel }) => {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imgRef = useRef(null);
  
  // Viewport Dimensions
  const VP_W = 280;
  const VP_H = 350; // 4:5 ratio

  const onImgLoad = (e) => {
      const { naturalWidth, naturalHeight } = e.target;
      const scaleX = VP_W / naturalWidth;
      const scaleY = VP_H / naturalHeight;
      const minScale = Math.max(scaleX, scaleY);
      setScale(minScale);
      setPos({ x: (VP_W - naturalWidth * minScale) / 2, y: (VP_H - naturalHeight * minScale) / 2 });
  };

  const handleStart = (clientX, clientY) => { setIsDragging(true); setDragStart({ x: clientX - pos.x, y: clientY - pos.y }); };
  const handleMove = (clientX, clientY) => { if (!isDragging) return; setPos({ x: clientX - dragStart.x, y: clientY - dragStart.y }); };
  const handleEnd = () => setIsDragging(false);

  const onMouseDown = (e) => handleStart(e.clientX, e.clientY);
  const onMouseMove = (e) => handleMove(e.clientX, e.clientY);
  const onTouchStart = (e) => handleStart(e.touches[0].clientX, e.touches[0].clientY);
  const onTouchMove = (e) => handleMove(e.touches[0].clientX, e.touches[0].clientY);

  const handleCrop = () => {
      if (!imgRef.current) return;
      const canvas = document.createElement('canvas');
      canvas.width = 800; canvas.height = 1000; 
      const ctx = canvas.getContext('2d');
      const naturalWidth = imgRef.current.naturalWidth;
      const naturalHeight = imgRef.current.naturalHeight;
      
      const drawX = pos.x * (800 / VP_W);
      const drawY = pos.y * (800 / VP_W);
      const drawW = naturalWidth * scale * (800 / VP_W);
      const drawH = naturalHeight * scale * (800 / VP_W);

      // FIX: WHITE BACKGROUND
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.drawImage(imgRef.current, drawX, drawY, drawW, drawH);
      
      canvas.toBlob((blob) => {
          const file = new File([blob], "cropped.jpg", { type: "image/jpeg" });
          onConfirm(file);
      }, 'image/jpeg', 0.95);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-4 animate-fade-in">
       <div className="text-white font-bold mb-4 text-lg flex items-center gap-2"><Crop size={20}/> Adjust Portrait</div>
       <div 
         className="relative overflow-hidden bg-gray-900 shadow-2xl border-2 border-white/20 rounded-sm"
         style={{ width: VP_W, height: VP_H, cursor: isDragging ? 'grabbing' : 'grab' }}
         onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={handleEnd} onMouseLeave={handleEnd}
         onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={handleEnd}
       >
          <img ref={imgRef} src={imageSrc} onLoad={onImgLoad} className="absolute max-w-none origin-top-left pointer-events-none select-none" style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})` }} alt="Crop target" />
          <div className="absolute inset-0 pointer-events-none opacity-30"><div className="w-full h-1/3 border-b border-white/50 absolute top-0"></div><div className="w-full h-1/3 border-b border-white/50 absolute top-1/3"></div><div className="h-full w-1/3 border-r border-white/50 absolute left-0"></div><div className="h-full w-1/3 border-r border-white/50 absolute left-1/3"></div></div>
       </div>
       <div className="w-full max-w-xs mt-6 space-y-6">
          <div className="flex items-center gap-3"><ZoomOut size={16} className="text-gray-400"/><input type="range" min="0.1" max="3" step="0.05" value={scale} onChange={(e) => setScale(parseFloat(e.target.value))} className="flex-1 accent-pink-500"/><ZoomIn size={16} className="text-gray-400"/></div>
          <div className="flex gap-3"><button onClick={onCancel} className="flex-1 py-3 bg-gray-800 text-white rounded-lg font-bold">Cancel</button><button onClick={handleCrop} className="flex-1 py-3 bg-pink-600 text-white rounded-lg font-bold shadow-lg flex justify-center items-center gap-2"><Check size={18}/> Done</button></div>
          <div className="text-center text-xs text-gray-500 flex items-center justify-center gap-1"><Move size={12}/> Drag image to position</div>
       </div>
    </div>
  );
};

/**
 * ATTENDEE VIEW 
 */
const AttendeeView = ({ customerId, user }) => {
  const [sessionData, setSessionData] = useState(null);
  const [isValidSession, setIsValidSession] = useState(null);
  const [name, setName] = useState(localStorage.getItem('attendeeName') || '');
  const [message, setMessage] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [toast, setToast] = useState({ type: '', msg: '' });
  const [history, setHistory] = useState([]);
  
  // Cropper State
  const [showCropper, setShowCropper] = useState(false);
  const [tempImgSrc, setTempImgSrc] = useState(null);
  const maxChars = image ? 60 : 150;

  useEffect(() => {
    if (!customerId || typeof customerId !== 'string' || customerId.includes('/')) {
        setIsValidSession(false);
        return;
    }
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'customers', customerId);
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.disabled) setIsValidSession(false);
        else {
           setIsValidSession(true);
           setSessionData(data);
        }
      } else setIsValidSession(false);
    });
    return () => unsub();
  }, [customerId]);

  useEffect(() => {
    let interval;
    if (cooldown > 0) interval = setInterval(() => setCooldown(c => c - 1), 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Basic Size Check (Max 15MB Raw - we will resize anyway)
    if (file.size > 15 * 1024 * 1024) {
        alert("Image is too large (Max 15MB).");
        return;
    }

    // Support for GIFs: Skip resize and crop to preserve animation
    if (file.type === 'image/gif') {
        applyImage(file);
        return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
        if (img.width >= img.height) {
            // LANDSCAPE / SQUARE: Resize then Apply
            const resizedFile = await resizeImage(file, 2048); 
            applyImage(resizedFile);
        } else {
            // PORTRAIT: Require Crop (Crop output is already optimized)
            setTempImgSrc(objectUrl);
            setShowCropper(true);
        }
    };
    img.src = objectUrl;
    e.target.value = null; 
  };

  const applyImage = (file) => {
      if (message.length > 60) {
          setMessage(prev => prev.substring(0, 60));
          showToast('error', 'Text trimmed to 60 chars for photo post');
      }
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
  };

  const onCropConfirm = (croppedFile) => { setShowCropper(false); applyImage(croppedFile); if(tempImgSrc) URL.revokeObjectURL(tempImgSrc); setTempImgSrc(null); };
  const onCropCancel = () => { setShowCropper(false); if(tempImgSrc) URL.revokeObjectURL(tempImgSrc); setTempImgSrc(null); };
  const removeImage = () => { setImage(null); setImagePreview(null); };

  const showToast = (type, msg) => {
    setToast({ type, msg: String(msg) });
    setTimeout(() => setToast({ type: '', msg: '' }), 3000);
  };

  const handleSubmit = async () => {
    if (cooldown > 0) return showToast('error', `Please wait ${cooldown}s`);
    if (!name.trim()) return showToast('error', 'Please enter your name');
    if (!message.trim()) return showToast('error', 'Message text is required');
    
    setIsSubmitting(true);
    localStorage.setItem('attendeeName', name);

    try {
      let imageData = null;
      if (image) {
        imageData = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(image);
        });
      }
      const newMsg = {
        customerId, sender: name, text: message, image: imageData, type: imageData ? 'image' : 'text',
        status: 'pending', timestamp: serverTimestamp(), userId: user.uid
      };
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'messages'), newMsg);
      
      setHistory(prev => [newMsg, ...prev].slice(0, 5));
      setMessage('');
      removeImage();
      setCooldown(5); 
      showToast('success', 'Sent to stage!');
    } catch (error) { console.error(error); showToast('error', 'Failed to send.'); }
    setIsSubmitting(false);
  };

  const sendEmoji = async (emoji) => {
    try { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'emojis'), { customerId, emoji, timestamp: serverTimestamp() }); showToast('success', `Sent ${emoji}`); } catch (err) { console.error(err); }
  };

  if (isValidSession === false) return <div className="h-screen bg-gray-900 flex items-center justify-center text-white p-6"><AlertCircle size={48} className="text-red-500 mb-4"/><div className="text-xl">Event Not Found</div></div>;
  if (!sessionData) return <div className="h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-100 font-sans flex flex-col relative overflow-hidden">
       {showCropper && tempImgSrc && ( <ImageCropper imageSrc={tempImgSrc} onConfirm={onCropConfirm} onCancel={onCropCancel} /> )}
       <div className="bg-gray-900 h-48 relative shrink-0">
          {sessionData.backgroundImage && ( <img src={sessionData.backgroundImage} className="w-full h-full object-cover opacity-60" alt="Event BG" /> )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
             <h1 className="text-3xl font-bold text-white drop-shadow-lg text-center px-4" style={{textShadow: '0 2px 10px rgba(0,0,0,0.5)'}}>{String(sessionData.headerTitle || "Event Interaction")}</h1>
          </div>
       </div>
       {toast.msg && <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-xl font-bold text-white animate-bounce ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>{String(toast.msg)}</div>}
       <div className="flex-1 overflow-y-auto p-4 pb-24">
          <div className="max-w-md mx-auto space-y-4">
             <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <label className="block text-sm font-bold text-gray-500 mb-1">Message <span className="text-red-500">*</span></label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={maxChars} placeholder="Share your thoughts..." className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none h-24 text-gray-800" />
                <div className={`text-right text-xs mt-1 font-bold ${message.length >= maxChars ? 'text-red-500' : 'text-gray-400'}`}>{message.length}/{maxChars} {image && '(Photo Limit)'}</div>
             </div>
             <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <label className="block text-sm font-bold text-gray-500 mb-2">Photo (Optional)</label>
                {!imagePreview ? (
                  <label className="flex items-center justify-center w-full h-12 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 hover:border-blue-400 transition text-gray-500 font-medium"><ImagePlus size={20} className="mr-2"/> Upload Photo (JPG/PNG/GIF)<input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} /></label>
                ) : (
                  <div className="relative rounded-lg overflow-hidden bg-black group">
                     <img src={imagePreview} className="w-full h-48 object-contain bg-gray-900" alt="Preview" />
                     <button onClick={removeImage} className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full shadow-lg hover:scale-110 transition"><X size={16} /></button>
                  </div>
                )}
             </div>
             <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <label className="block text-sm font-bold text-gray-500 mb-1">Your Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Guest" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-800"/>
             </div>
             <button onClick={handleSubmit} disabled={isSubmitting || cooldown > 0} className={`w-full py-4 rounded-xl font-bold text-white text-lg shadow-lg transform transition active:scale-95 flex items-center justify-center gap-2 ${isSubmitting || cooldown > 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:brightness-110'}`}>{isSubmitting ? 'Sending...' : cooldown > 0 ? `Wait ${cooldown}s` : 'Send to Stage'}</button>
             {history.length > 0 && (
               <div className="mt-6 pt-6 border-t border-gray-200">
                 <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Recent Activity</h3>
                 {history.map((h, i) => ( <div key={i} className="text-xs text-gray-500 mb-1 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-400"></span> {h.type === 'image' ? 'Sent a photo' : 'Sent a message'}</div> ))}
               </div>
             )}
          </div>
       </div>
       <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur border-t border-gray-200 p-3 pb-6 safe-area-pb w-full">
          <div className="flex justify-between gap-2 overflow-x-auto no-scrollbar w-full px-2">
             {EMOJIS.map(e => (<button key={e} onClick={() => sendEmoji(e)} className="text-2xl w-10 h-10 flex-shrink-0 flex items-center justify-center bg-gray-100 rounded-full hover:bg-blue-100 hover:scale-110 transition">{e}</button>))}
          </div>
       </div>
       {/* CSS STYLES INLINE */}
       <style>{`
          @keyframes blast-up { 
              0% { transform: translateY(0) scale(0); opacity: 0; }
              20% { transform: translateY(-20px) scale(1.2) rotate(10deg); opacity: 1; }
              30% { transform: translateY(-20px) scale(1.2) rotate(-10deg); opacity: 1; }
              100% { transform: translateY(-120vh) scale(1) rotate(0deg); opacity: 0; }
          }
          .animate-blast-up { animation: blast-up 4s ease-in forwards; }
          .safe-area-pb { padding-bottom: env(safe-area-inset-bottom); }
       `}</style>
    </div>
  );
};

/**
 * STAGE VIEW
 */
const StageView = ({ customerId }) => {
  const [isValidSession, setIsValidSession] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [mediaSource, setMediaSource] = useState(null); 
  const [audioSource, setAudioSource] = useState(null); 
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [videoVolume, setVideoVolume] = useState(1);
  const [audioVolume, setAudioVolume] = useState(0.5);
  const [overlaysVisible, setOverlaysVisible] = useState(true);
  const [announcement, setAnnouncement] = useState(''); 
  const videoRef = useRef(null); const audioRef = useRef(null); const broadcastChannel = useRef(null);
  const allApprovedImagesRef = useRef([]); const allApprovedTextsRef = useRef([]); 
  const [emojis, setEmojis] = useState([]); const imgQueueRef = useRef([]); const textQueueRef = useRef([]); 
  const seenImgIds = useRef(new Set()); const seenTextIds = useRef(new Set());
  const imgHistoryIdx = useRef(0); const textHistoryIdx = useRef(0);
  const [imgSlots, setImgSlots] = useState(Array(3).fill(null)); const [textSlots, setTextSlots] = useState(Array(5).fill(null));
  const nextImgSlotIdx = useRef(0); const nextTextSlotIdx = useRef(0);

  useEffect(() => {
    if (!customerId || typeof customerId !== 'string' || customerId.includes('/')) { setIsValidSession(false); return; }
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'customers', customerId);
    const unsub = onSnapshot(docRef, (docSnap) => {
       if (docSnap.exists()) {
         const data = docSnap.data();
         if (data.disabled) setIsValidSession(false);
         else {
           setIsValidSession(true); setSessionData(data);
           setSettings({ imgTimer: data.settings?.imgTimer || 5, textTimer: data.settings?.textTimer || 5, imgCount: data.settings?.imgCount || 3, textCount: data.settings?.textCount || 5 });
         }
       } else setIsValidSession(false);
    });
    return () => unsub();
  }, [customerId]);

  useEffect(() => {
     const targetImgCount = settings.imgCount || 3;
     const targetTextCount = settings.textCount || 5;
     setImgSlots(prev => {
         if (prev.length === targetImgCount) return prev;
         if (prev.length < targetImgCount) return [...prev, ...Array(targetImgCount - prev.length).fill(null)];
         return prev.slice(0, targetImgCount);
     });
     setTextSlots(prev => {
         if (prev.length === targetTextCount) return prev;
         if (prev.length < targetTextCount) return [...prev, ...Array(targetTextCount - prev.length).fill(null)];
         return prev.slice(0, targetTextCount);
     });
     nextImgSlotIdx.current = nextImgSlotIdx.current % targetImgCount;
     nextTextSlotIdx.current = nextTextSlotIdx.current % targetTextCount;
  }, [settings.imgCount, settings.textCount]);

  useEffect(() => {
    broadcastChannel.current = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    broadcastChannel.current.onmessage = (e) => {
      const { action, payload } = e.data;
      if (action === 'SET_MEDIA') setMediaSource(payload);
      else if (action === 'SET_AUDIO') { setAudioSource(payload); setIsAudioPlaying(true); }
      else if (action === 'PLAY_VIDEO') setIsVideoPlaying(true);
      else if (action === 'PAUSE_VIDEO') setIsVideoPlaying(false);
      else if (action === 'SET_VIDEO_VOLUME') setVideoVolume(payload);
      else if (action === 'PLAY_AUDIO') setIsAudioPlaying(true);
      else if (action === 'PAUSE_AUDIO') setIsAudioPlaying(false);
      else if (action === 'SET_AUDIO_VOLUME') setAudioVolume(payload);
      else if (action === 'TOGGLE_OVERLAYS') setOverlaysVisible(payload);
      else if (action === 'ANNOUNCEMENT') { if (typeof payload === 'string' && payload.length > 0) { setAnnouncement(payload); setTimeout(() => setAnnouncement(''), 10000); } }
    };
    return () => broadcastChannel.current?.close();
  }, []);

  const handleVideoEnded = () => { broadcastChannel.current?.postMessage({ action: 'VIDEO_ENDED' }); };
  const handleAudioEnded = () => { broadcastChannel.current?.postMessage({ action: 'AUDIO_ENDED' }); };

  useEffect(() => { if(videoRef.current) { if(isVideoPlaying) videoRef.current.play().catch(()=>{}); else videoRef.current.pause(); } }, [isVideoPlaying, mediaSource]);
  useEffect(() => { if(videoRef.current) videoRef.current.volume = videoVolume; }, [videoVolume]);
  useEffect(() => { if(audioRef.current) { if(isAudioPlaying) audioRef.current.play().catch(()=>{}); else audioRef.current.pause(); } }, [isAudioPlaying, audioSource]);
  useEffect(() => { if(audioRef.current) audioRef.current.volume = audioVolume; }, [audioVolume]);

  useEffect(() => {
    if (!isValidSession || !customerId || typeof customerId !== 'string' || customerId.includes('/')) return;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'messages'), where('customerId', '==', customerId), where('status', '==', 'approved'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Include videos in image stream
      const imgs = items.filter(d => d.type === 'image' || d.type === 'video');
      const texts = items.filter(d => d.type === 'text');
      allApprovedImagesRef.current = imgs; allApprovedTextsRef.current = texts;
      imgs.forEach(i => { if (!seenImgIds.current.has(i.id)) { seenImgIds.current.add(i.id); imgQueueRef.current.push({ ...i, isNew: true }); } });
      texts.forEach(i => { if (!seenTextIds.current.has(i.id)) { seenTextIds.current.add(i.id); textQueueRef.current.push({ ...i, isNew: true }); } });
    });
    const eq = query(collection(db, 'artifacts', appId, 'public', 'data', 'emojis'), where('customerId', '==', customerId));
    const unsubE = onSnapshot(eq, (snap) => {
      snap.docChanges().forEach(c => {
         if (c.type === 'added' && c.doc.data().timestamp?.seconds > (Date.now()/1000 - 5)) {
           const id = c.doc.id;
           const emojiStr = typeof c.doc.data().emoji === 'string' ? c.doc.data().emoji : '👍'; 
           setEmojis(p => [...p, { id, emoji: emojiStr, left: Math.random()*80 + 10 }].slice(-25)); 
           setTimeout(() => setEmojis(p => p.filter(e => e.id !== id)), 3000);
         }
      });
    });
    return () => { unsubscribe(); unsubE(); };
  }, [customerId, isValidSession]);

  useEffect(() => {
    const tick = () => {
        const hasNew = imgQueueRef.current.length > 0;
        const totalApproved = allApprovedImagesRef.current.length;
        const displayedIds = new Set(imgSlots.map(s => s?.id).filter(Boolean));
        const maxSlots = settings.imgCount || 3;
        if (!hasNew && totalApproved <= maxSlots) { if (allApprovedImagesRef.current.every(i => displayedIds.has(i.id))) return; }
        let next = null;
        if (hasNew) { next = imgQueueRef.current.shift(); } else if (totalApproved > 0) {
            let attempts = 0;
            while(attempts < totalApproved) {
                const candidate = allApprovedImagesRef.current[imgHistoryIdx.current];
                imgHistoryIdx.current = (imgHistoryIdx.current + 1) % allApprovedImagesRef.current.length;
                if (!displayedIds.has(candidate.id) || totalApproved <= maxSlots) { next = { ...candidate, isNew: false }; break; }
                attempts++;
            }
        }
        if (next) {
            setImgSlots(prev => {
                const newSlots = [...prev]; const rot = Math.random() * 6 - 3; 
                newSlots[nextImgSlotIdx.current] = { ...next, key: Date.now(), anim: getRandomAnim(), rotation: rot };
                return newSlots;
            });
            nextImgSlotIdx.current = (nextImgSlotIdx.current + 1) % maxSlots; 
        }
    };
    const interval = setInterval(tick, settings.imgTimer * 1000);
    return () => clearInterval(interval);
  }, [settings.imgTimer, imgSlots, settings.imgCount]); 

  useEffect(() => {
    const tick = () => {
        const hasNew = textQueueRef.current.length > 0;
        const totalApproved = allApprovedTextsRef.current.length;
        const displayedIds = new Set(textSlots.map(s => s?.id).filter(Boolean));
        const maxSlots = settings.textCount || 5;
        if (!hasNew && totalApproved <= maxSlots) { if (allApprovedTextsRef.current.every(i => displayedIds.has(i.id))) return; }
        let next = null;
        if (hasNew) { next = textQueueRef.current.shift(); } else if (totalApproved > 0) {
            let attempts = 0;
            while(attempts < totalApproved + 1) {
                 const candidate = allApprovedTextsRef.current[textHistoryIdx.current];
                 textHistoryIdx.current = (textHistoryIdx.current + 1) % allApprovedTextsRef.current.length;
                 if(!displayedIds.has(candidate.id)) { next = { ...candidate, isNew: false }; break; }
                 attempts++;
            }
        }
        if (next) {
             setTextSlots(prev => {
                const newSlots = [...prev];
                newSlots[nextTextSlotIdx.current] = { ...next, key: Date.now(), anim: getRandomAnim() };
                return newSlots;
             });
             nextTextSlotIdx.current = (nextTextSlotIdx.current + 1) % maxSlots; 
        }
    };
    const interval = setInterval(tick, settings.textTimer * 1000);
    return () => clearInterval(interval);
  }, [settings.textTimer, textSlots, settings.textCount]); 

  const toggleFullscreen = () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else if (document.exitFullscreen) document.exitFullscreen(); };

  if (isValidSession === false) return <div className="h-screen bg-black flex items-center justify-center text-white">Event Invalid</div>;
  if (!sessionData) return <div className="h-screen bg-black flex items-center justify-center text-white">Loading...</div>;

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden font-sans group/stage">
      <div className="absolute inset-0 z-0 flex items-center justify-center bg-black transition-opacity duration-1000">
        {mediaSource ? (
          mediaSource.type === 'video' ? (<video ref={videoRef} src={mediaSource.url} className="w-full h-full object-contain" loop={false} onEnded={handleVideoEnded} autoPlay={isVideoPlaying} />) : (<img src={mediaSource.url} className="w-full h-full object-cover opacity-100" alt="Background" />)
        ) : sessionData.backgroundImage ? ( <img src={sessionData.backgroundImage} className="w-full h-full object-cover opacity-40" alt="Customer BG" /> ) : ( <div className="text-gray-600 text-4xl font-bold animate-pulse">Waiting for Signal...</div> )}
      </div>
      <audio ref={audioRef} src={audioSource} loop={false} onEnded={handleAudioEnded} />
      {announcement && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-red-600/90 animate-fade-in p-12 text-center">
           <div><div className="text-yellow-300 mb-4 animate-bounce"><Siren size={64} className="mx-auto"/></div><h1 className="text-white text-6xl font-black uppercase tracking-wider drop-shadow-xl">{String(announcement)}</h1></div>
        </div>
      )}
      <div className={`absolute inset-0 z-10 flex pointer-events-none p-8 transition-opacity duration-1000 ${overlaysVisible && !announcement ? 'opacity-100' : 'opacity-0'}`}>
        <div className="w-[30%] h-full flex flex-col justify-center items-center pl-8 relative">
          <div className="flex flex-col w-full items-center gap-6"> 
          {imgSlots.map((item, index) => (
             <div key={index} className="relative w-full flex justify-center pointer-events-auto"> 
                {item && (
                   <div key={item.key} className={`relative bg-white p-3 pb-3 transition-all duration-1000 flex flex-col items-center shadow-2xl ${item.anim}`} style={{ width: 'fit-content', maxWidth: '100%', transform: `rotate(${item.rotation}deg)` }}>
                      <div className="bg-gray-100 mb-2 shrink-0">
                        {item.type === 'video' ? (
                            <video src={item.image} className="object-contain" style={{ height: 'auto', width: 'auto', maxHeight: '25vh', maxWidth: '100%', display: 'block', objectFit: 'contain' }} autoPlay loop muted playsInline />
                        ) : (
                            <img src={item.image} className="object-contain" style={{ height: 'auto', width: 'auto', maxHeight: '25vh', maxWidth: '100%', display: 'block', objectFit: 'contain' }} alt="User upload" /> 
                        )}
                      </div>
                      <div className="flex flex-col items-center justify-center text-center" style={{ width: 0, minWidth: '100%' }}>
                         {item.text && (<div className={`text-[#2c2c2c] leading-none font-bold font-serif px-1 w-full break-words ${item.text.length > 50 ? 'text-xs' : 'text-sm md:text-base'}`} style={{ fontFamily: 'cursive' }}>{String(item.text)}</div>)}
                         <div className="mt-1 text-gray-500 text-[10px] font-bold font-sans self-end w-full text-right">@{String(item.sender)}</div>
                      </div>
                      {item.isNew && <div className="absolute -top-2 -right-2 bg-pink-600 text-white font-black px-3 py-1 rounded-full shadow-lg z-30 text-xs animate-bounce">NEW</div>}
                   </div>
                )}
             </div>
          ))}
          </div>
        </div>
        <div className="w-[50%]"></div>
        <div className="w-[20%] h-full flex flex-col justify-center pr-8 relative">
           <div className="flex flex-col gap-4 w-full h-full justify-center">
           {textSlots.map((item, index) => (
              <div key={index} className={`w-full flex justify-end`}>
                 {item && (
                    <div key={item.key} className={`bg-white/75 backdrop-blur-md p-4 rounded-xl text-black shadow-xl border-l-4 border-blue-500 flex flex-col w-fit max-w-full transition-all duration-1000 ${item.anim}`}>
                       {item.isNew && <div className="self-end -mt-2 -mr-2 mb-1 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">NEW</div>}
                       <div className={`font-bold mb-1 leading-snug break-words text-right ${item.text && item.text.length > 50 ? 'text-xs' : 'text-lg'}`}>"{String(item.text || '')}"</div>
                       <div className="text-right text-gray-600 text-xs font-bold uppercase">@{String(item.sender)}</div>
                    </div>
                 )}
              </div>
           ))}
           </div>
        </div>
      </div>
      {emojis.map((p) => <div key={p.id} className="absolute bottom-0 text-5xl animate-blast-up pointer-events-none z-50 drop-shadow-lg" style={{ left: `${p.left}%` }}>{String(p.emoji)}</div>)}
      <button onClick={toggleFullscreen} className="absolute bottom-8 right-8 z-50 p-3 bg-white/10 hover:bg-white/30 backdrop-blur rounded-full text-white transition opacity-0 group-hover/stage:opacity-100 pointer-events-auto"><Maximize size={24} /></button>
      {/* CSS STYLES REVERTED */}
      <style>{`
          @keyframes fade-in { 0% { opacity: 0; } 100% { opacity: 1; } }
          .animate-fade-in { animation: fade-in 1.2s ease-out forwards; }
          @keyframes pop-in { 
              0% { transform: scale(0.8); opacity: 0; } 
              60% { transform: scale(1.05); opacity: 1; } 
              100% { transform: scale(1); opacity: 1; } 
          }
          .animate-pop-in { animation: pop-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
          @keyframes slide-in-right { 
              0% { transform: translateX(100%); opacity: 0; } 
              100% { transform: translateX(0); opacity: 1; } 
          }
          .animate-slide-in-right { animation: slide-in-right 0.6s ease-out forwards; }
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

const AdminLogin = ({ onLogin }) => {
  const [u, setU] = useState(''); const [p, setP] = useState('');
  const [loading, setLoading] = useState(false);
  const handleLogin = async () => {
      setLoading(true);
      if(u === MASTER_ADMIN.user && p === MASTER_ADMIN.pass) {
          onLogin({ role: 'admin', name: 'Master' });
          return;
      }
      try {
          const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'customers'), where('name', '==', u), where('password', '==', p));
          const snap = await getDocs(q);
          if (!snap.empty) {
              const user = snap.docs[0].data();
              if (user.role === 'admin' || user.role === 'admin-read') { onLogin({ role: user.role, name: user.name }); return; }
          }
          alert('Invalid Credentials or Insufficient Permissions');
      } catch (e) { console.error(e); alert('Error logging in'); }
      setLoading(false);
  };
  return (
    <div className="h-screen bg-slate-900 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-lg w-96">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-slate-800"><Lock size={24}/> Admin Login</h2>
        <input className="w-full mb-3 p-3 border border-slate-300 rounded text-slate-900" placeholder="Username" value={u} onChange={e=>setU(e.target.value)} />
        <input className="w-full mb-6 p-3 border border-slate-300 rounded text-slate-900" type="password" placeholder="Password" value={p} onChange={e=>setP(e.target.value)} />
        <button onClick={handleLogin} disabled={loading} className="w-full bg-slate-800 hover:bg-slate-700 text-white p-3 rounded font-bold transition">{loading ? 'Checking...' : 'Login'}</button>
      </div>
    </div>
  );
};

const ModeratorLogin = ({ onLogin }) => {
  const [slug, setSlug] = useState(''); const [pass, setPass] = useState(''); const [isLoading, setIsLoading] = useState(false);
  const checkCreds = async () => {
    if (!slug || !pass) return;
    setIsLoading(true);
    try {
       const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'customers', slug);
       const snap = await getDoc(docRef);
       if (snap.exists() && snap.data().password === pass) onLogin(slug);
       else alert('Invalid Customer ID or Password');
    } catch (e) { console.error(e); alert('Error logging in'); }
    setIsLoading(false);
  };
  return (
     <div className="h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-xl shadow-lg w-96 text-white border border-gray-700">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><User size={24}/> Moderator Login</h2>
        <input className="w-full mb-3 p-3 bg-gray-700 border border-gray-600 rounded text-white" placeholder="Customer Slug (e.g. google-io)" value={slug} onChange={e=>setSlug(e.target.value)} />
        <input className="w-full mb-6 p-3 bg-gray-700 border border-gray-600 rounded text-white" type="password" placeholder="Password" value={pass} onChange={e=>setPass(e.target.value)} />
        <button onClick={checkCreds} disabled={isLoading} className="w-full bg-pink-600 hover:bg-pink-500 text-white p-3 rounded font-bold transition">{isLoading ? 'Checking...' : 'Enter Deck'}</button>
      </div>
    </div>
  );
};

const ModeratorView = ({ customerId, customerData }) => {
  const [localMedia, setLocalMedia] = useState([]); 
  const [activeVisualId, setActiveVisualId] = useState(null);
  const [activeAudioId, setActiveAudioId] = useState(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [videoVolume, setVideoVolume] = useState(1);
  const [audioVolume, setAudioVolume] = useState(0.5);
  const [videoAutoNext, setVideoAutoNext] = useState(true); 
  const [audioAutoNext, setAudioAutoNext] = useState(true);
  const [isImgSlideshow, setIsImgSlideshow] = useState(false);
  const [slideshowInterval, setSlideshowInterval] = useState(10); 
  const [sourceTab, setSourceTab] = useState('images'); 
  const [overlaysOn, setOverlaysOn] = useState(true);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true); 
  const [queue, setQueue] = useState([]);
  const [queueTab, setQueueTab] = useState('queue'); 
  const [contentFilter, setContentFilter] = useState('all'); 
  const [announcementText, setAnnouncementText] = useState('');
  const broadcastChannel = useRef(null);
  const [timers, setTimers] = useState({ imgTimer: 5, textTimer: 5, imgCount: 3, textCount: 5 });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [modHeaderTitle, setModHeaderTitle] = useState('');
  const [modBgImage, setModBgImage] = useState(null);
  const [generatingId, setGeneratingId] = useState(null); // For AI loader

  const handleDragOver = (e) => { e.preventDefault(); };
  const handleDrop = (e) => { e.preventDefault(); if (e.dataTransfer.files) handleFiles(Array.from(e.dataTransfer.files)); };

  useEffect(() => {
    broadcastChannel.current = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    broadcastChannel.current.onmessage = (e) => {
        const { action } = e.data;
        if (action === 'VIDEO_ENDED') handleVideoEnded();
        if (action === 'AUDIO_ENDED') handleAudioEnded();
    };
    return () => broadcastChannel.current?.close();
  }, [localMedia, activeVisualId, activeAudioId, videoAutoNext, audioAutoNext]);

  useEffect(() => { if (window.innerWidth < 1024) { setIsLeftPanelOpen(false); setIsRightPanelOpen(false); } }, []);

  useEffect(() => {
    if (!customerId || typeof customerId !== 'string' || customerId.includes('/')) return;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'messages'), where('customerId', '==', customerId));
    const unsubscribe = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));
      setQueue(items);
    });
    const custRef = doc(db, 'artifacts', appId, 'public', 'data', 'customers', customerId);
    getDoc(custRef).then(snap => { 
        if (snap.exists()) {
            const d = snap.data();
            if (d.settings) setTimers({ imgTimer: d.settings.imgTimer || 5, textTimer: d.settings.textTimer || 5, imgCount: d.settings.imgCount || 3, textCount: d.settings.textCount || 5 }); 
            setModHeaderTitle(d.headerTitle || '');
            setModBgImage(d.backgroundImage || null);
        }
    });
    return () => unsubscribe();
  }, [customerId]);

  const saveSettings = async () => {
     setIsSavingSettings(true);
     try { 
         await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'customers', customerId), { settings: timers, headerTitle: modHeaderTitle, backgroundImage: modBgImage }); 
         alert('Settings Saved!');
    } catch (e) { console.error(e); }
     setIsSavingSettings(false);
  };
  const handleBgSelect = (e) => { const file = e.target.files[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => setModBgImage(reader.result); reader.readAsDataURL(file); } };
  const broadcastAnnouncement = () => { if(!announcementText) return; broadcastChannel.current.postMessage({ action: 'ANNOUNCEMENT', payload: announcementText || ' ' }); setAnnouncementText(''); alert('Announcement broadcasted to stage!'); };

  useEffect(() => {
    let interval;
    if (sourceTab === 'images' && isImgSlideshow) {
      const images = localMedia.filter(m => m.type === 'image');
      if (images.length > 0) {
        interval = setInterval(() => {
           const currentIdx = images.findIndex(m => m.id === activeVisualId);
           const nextIdx = (currentIdx + 1) % images.length;
           if (images[nextIdx]) activateMedia(images[nextIdx]);
        }, slideshowInterval * 1000); 
      }
    }
    return () => clearInterval(interval);
  }, [sourceTab, isImgSlideshow, localMedia, activeVisualId, slideshowInterval]);

  const handleFiles = (files) => {
    const newMedia = files.map(file => {
        let type = 'image';
        if (file.type.startsWith('video')) type = 'video';
        if (file.type.startsWith('audio')) type = 'audio';
        return { id: Math.random().toString(36), file, url: URL.createObjectURL(file), type, name: file.name };
    });
    setLocalMedia(prev => [...prev, ...newMedia]);
  };
  const handleFileImport = (e) => handleFiles(Array.from(e.target.files));
  
  const removeMedia = (e, id) => { e.stopPropagation(); setLocalMedia(prev => prev.filter(m => m.id !== id)); if (activeVisualId === id) { setActiveVisualId(null); broadcastChannel.current.postMessage({ action: 'SET_MEDIA', payload: null }); } if (activeAudioId === id) { setActiveAudioId(null); broadcastChannel.current.postMessage({ action: 'SET_AUDIO', payload: null }); } };
  const activateMedia = (media) => {
    if (!media) return;
    if (media.type === 'audio') { setActiveAudioId(media.id); setIsAudioPlaying(true); broadcastChannel.current.postMessage({ action: 'SET_AUDIO', payload: media.url }); } 
    else { setActiveVisualId(media.id); broadcastChannel.current.postMessage({ action: 'SET_MEDIA', payload: { url: media.url, type: media.type } }); if (media.type === 'video') setIsVideoPlaying(true); }
  };
  
  const handleVideoEnded = () => {
      if (!videoAutoNext) return;
      const videos = localMedia.filter(m => m.type === 'video');
      const currentIndex = videos.findIndex(m => m.id === activeVisualId);
      if (currentIndex !== -1 && currentIndex + 1 < videos.length) activateMedia(videos[currentIndex + 1]); else if (videos.length > 0) activateMedia(videos[0]);
  };
  const handleAudioEnded = () => {
      if (!audioAutoNext) return;
      const tracks = localMedia.filter(m => m.type === 'audio');
      const currentIndex = tracks.findIndex(m => m.id === activeAudioId);
      if (currentIndex !== -1 && currentIndex + 1 < tracks.length) activateMedia(tracks[currentIndex + 1]); else if (tracks.length > 0) activateMedia(tracks[0]);
  };
  const nextMedia = () => {
    const isAudioTab = sourceTab === 'audio';
    const targetList = localMedia.filter(m => isAudioTab ? m.type === 'audio' : (sourceTab === 'videos' ? m.type === 'video' : m.type === 'image'));
    if(targetList.length === 0) return;
    const currentId = isAudioTab ? activeAudioId : activeVisualId;
    const currentIdx = targetList.findIndex(m => m.id === currentId);
    const nextIdx = (currentIdx + 1) % targetList.length;
    activateMedia(targetList[nextIdx]);
  };
  
  const toggleVideoPlay = () => { const newState = !isVideoPlaying; setIsVideoPlaying(newState); broadcastChannel.current.postMessage({ action: newState ? 'PLAY_VIDEO' : 'PAUSE_VIDEO' }); };
  const changeVideoVolume = (val) => { setVideoVolume(val); broadcastChannel.current.postMessage({ action: 'SET_VIDEO_VOLUME', payload: val }); };
  const toggleAudioPlay = () => { const newState = !isAudioPlaying; setIsAudioPlaying(newState); broadcastChannel.current.postMessage({ action: newState ? 'PLAY_AUDIO' : 'PAUSE_AUDIO' }); };
  const changeAudioVolume = (val) => { setAudioVolume(val); broadcastChannel.current.postMessage({ action: 'SET_AUDIO_VOLUME', payload: val }); };
  const toggleOverlays = () => { const newState = !overlaysOn; setOverlaysOn(newState); broadcastChannel.current.postMessage({ action: 'TOGGLE_OVERLAYS', payload: newState }); };
  const updateStatus = async (id, status) => { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'messages', id), { status }); };
  const deleteMessage = async (id) => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'messages', id)); };
  
  const generateAiVariant = async (msg) => { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'messages', msg.id), { text: `AI: "Look at this legend! ${msg.sender} is stealing the show!"`, aiEnhanced: true }); };

  /**
   * --- GEMINI / VERTEX AI VIDEO GENERATION LOGIC ---
   * Note: Image-to-Video generation requires Google Vertex AI (Cloud) credentials or 
   * specific API access (like Imagen 2.0/Veo) which is not available in the standard 
   * public Gemini flash preview key. 
   * * This function simulates the flow. In production, you would replace the timeout 
   * with a fetch call to your backend proxy that calls Vertex AI.
   */
  const generateAiVideo = async (msg) => {
      if (!msg.image) return alert("No image source found!");
      
      setGeneratingId(msg.id);
      
      // SIMULATED API CALL
      // In real app: const resp = await fetch('/api/generate-video', { method: 'POST', body: JSON.stringify({ image: msg.image }) });
      // const videoUrl = await resp.json();
      
      setTimeout(async () => {
         try {
             // For demo: we pretend the image is now a "video" by just changing the type
             // In real app: update 'image' field with the new video URL or add a 'videoUrl' field
             
             // Here we just swap the type to video so the Stage renders it in the video player (even though it's a static image source for this demo)
             // To make it real, replace msg.image with the actual .mp4 URL returned from AI
             
             await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'messages', msg.id), { 
                 type: 'video', // Change type to video
                 aiEnhanced: true,
                 text: "✨ AI Animated Memory"
             });
             setGeneratingId(null);
             alert("AI Video Generated!");
         } catch(e) {
             console.error(e);
             setGeneratingId(null);
         }
      }, 3000);
  };

  const filteredQueue = queue.filter(item => {
    const statusMatch = queueTab === 'queue' ? item.status === 'pending' : item.status === 'approved';
    const typeMatch = contentFilter === 'all' ? true : contentFilter === 'image' ? item.type === 'image' : item.type === 'text';
    return statusMatch && typeMatch;
  });

  const attendeeLink = `${window.location.origin}/${customerId}`;
  const videoList = localMedia.filter(m => m.type === 'video');
  const imageList = localMedia.filter(m => m.type === 'image');
  const audioList = localMedia.filter(m => m.type === 'audio');

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-gray-100 font-sans">
      <div className="h-16 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4 lg:px-6 z-20">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)} className="p-2 hover:bg-gray-700 rounded text-gray-300 transition"> {isLeftPanelOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />} </button>
          <div className="font-bold text-lg lg:text-xl text-pink-500 flex items-center gap-2"><span className="hidden lg:inline">Moderator Deck</span><span className="text-gray-400 text-sm font-normal border-l border-gray-600 pl-2 ml-2">{String(customerData.name)}</span></div>
        </div>
        <div className="flex items-center gap-3">
          <div className="group relative flex items-center">
             <div className="absolute top-10 right-0 w-32 bg-black text-white text-xs p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-50">Toggle Stage Overlays</div>
             <button onClick={toggleOverlays} className={`p-2 rounded-lg border transition ${overlaysOn ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-gray-700 border-gray-600 text-gray-400'}`}>{overlaysOn ? <Eye size={18} /> : <EyeOff size={18} />}</button>
          </div>
          <button onClick={() => { navigator.clipboard.writeText(attendeeLink); alert('Copied: ' + attendeeLink); }} className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-xs border border-gray-600 transition"><LinkIcon size={14} /> <span className="hidden sm:inline">Link</span></button>
          <button onClick={() => window.open(`/stage/${customerId}`, '_blank')} className="flex items-center gap-2 px-3 py-2 bg-pink-600 hover:bg-pink-500 rounded text-xs font-bold shadow-lg transition"><ExternalLink size={14} /> <span className="hidden sm:inline">Stage</span></button>
          <button onClick={() => setIsRightPanelOpen(!isRightPanelOpen)} className="p-2 hover:bg-gray-700 rounded text-gray-300 transition ml-2 border-l border-gray-600 pl-3"> {isRightPanelOpen ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />} </button>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden relative">
        <div className={`border-r border-gray-700 flex flex-col bg-gray-900 transition-all duration-300 ease-in-out ${isLeftPanelOpen ? 'w-full md:w-1/4 min-w-[300px]' : 'w-0 overflow-hidden opacity-0'}`} onDragOver={handleDragOver} onDrop={handleDrop}>
          <div className="p-4 border-b border-gray-800 font-bold flex justify-between items-center bg-gray-800/50 min-w-[300px]"><span>Media Source</span><label className="cursor-pointer px-3 py-1 bg-pink-600 hover:bg-pink-500 rounded text-xs flex items-center gap-1 transition">+ Import <input type="file" multiple className="hidden" onChange={handleFileImport} /></label></div>
          <div className="flex border-b border-gray-800 min-w-[300px]">
             <button onClick={() => setSourceTab('videos')} className={`flex-1 py-2 text-xs font-medium ${sourceTab === 'videos' ? 'bg-gray-800 text-white border-b-2 border-blue-500' : 'text-gray-400 hover:bg-gray-800'}`}>Videos ({videoList.length})</button>
             <button onClick={() => setSourceTab('images')} className={`flex-1 py-2 text-xs font-medium ${sourceTab === 'images' ? 'bg-gray-800 text-white border-b-2 border-pink-500' : 'text-gray-400 hover:bg-gray-800'}`}>Images ({imageList.length})</button>
             <button onClick={() => setSourceTab('audio')} className={`flex-1 py-2 text-xs font-medium ${sourceTab === 'audio' ? 'bg-gray-800 text-white border-b-2 border-green-500' : 'text-gray-400 hover:bg-gray-800'}`}>Music ({audioList.length})</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 min-w-[300px] border-2 border-transparent hover:border-dashed hover:border-gray-700">
            {sourceTab === 'audio' ? (
                audioList.map((m) => {
                  const isActive = activeAudioId === m.id;
                  return (
                    <div key={m.id} onClick={() => activateMedia(m)} className={`p-2 rounded cursor-pointer flex items-center gap-3 transition-all border group relative ${isActive ? 'bg-green-900/30 border-green-500' : 'bg-gray-800 border-gray-700 hover:bg-gray-700'}`}>
                      <div className="w-8 h-8 bg-black rounded flex items-center justify-center text-green-500 shrink-0 border border-gray-600"><Music size={16}/></div>
                      <div className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm pr-6">{m.name}</div>
                      {isActive && <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>}
                      <button onClick={(e) => removeMedia(e, m.id)} className="absolute right-2 text-gray-500 hover:text-red-500"><X size={14}/></button>
                    </div>
                  );
                })
            ) : (
                (sourceTab === 'videos' ? videoList : imageList).map((m) => {
                  const isActive = activeVisualId === m.id;
                  return (
                    <div key={m.id} onClick={() => activateMedia(m)} className={`p-2 rounded cursor-pointer flex items-center gap-3 transition-all border group relative ${isActive ? 'bg-pink-900/30 border-pink-500' : 'bg-gray-800 border-gray-700 hover:bg-gray-700'}`}>
                      <div className="w-12 h-12 bg-black rounded overflow-hidden shrink-0 border border-gray-600">
                        {m.type === 'image' ? <img src={m.url} className="w-full h-full object-cover"/> : <video src={m.url} className="w-full h-full object-cover"/>}
                      </div>
                      <div className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm pr-6">{m.name}</div>
                      {isActive && <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse"></div>}
                      <button onClick={(e) => removeMedia(e, m.id)} className="absolute right-2 text-gray-500 hover:text-red-500"><X size={14}/></button>
                    </div>
                  );
                })
            )}
             {localMedia.filter(m => m.type === (sourceTab === 'audio' ? 'audio' : sourceTab === 'videos' ? 'video' : 'image')).length === 0 && <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm"><p>Drag & Drop files here</p></div>}
          </div>
          <div className="p-4 bg-gray-800 border-t border-gray-700 min-w-[300px] space-y-4">
             <div className="bg-gray-900 p-2 rounded-lg border border-gray-700">
                <div className="text-[10px] text-gray-500 uppercase font-bold mb-2 flex justify-between"><span>Visual Stream</span><span className="text-pink-500">{activeVisualId ? 'ACTIVE' : 'IDLE'}</span></div>
                <div className="flex items-center gap-3"><button onClick={toggleVideoPlay} className="p-2 bg-white text-black rounded-full hover:scale-105 transition shadow-sm" title="Play/Pause Visual">{isVideoPlaying ? <Pause size={16} fill="black" /> : <Play size={16} className="ml-0.5" fill="black" />}</button><div className="flex-1 flex items-center gap-2"><Volume2 size={14} className="text-gray-400"/><input type="range" min="0" max="1" step="0.1" value={videoVolume} onChange={(e) => changeVideoVolume(parseFloat(e.target.value))} className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"/></div><button onClick={nextMedia} className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition"><SkipForward size={14} /></button></div>
                {sourceTab === 'images' ? (
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-400 border-t border-gray-800 pt-1"><div className="flex items-center gap-2"><span className="">Slideshow</span> <input type="checkbox" checked={isImgSlideshow} onChange={(e) => setIsImgSlideshow(e.target.checked)} className="rounded text-pink-500 focus:ring-0 cursor-pointer h-3 w-3"/></div>{isImgSlideshow && <input type="number" min="3" value={slideshowInterval} onChange={e=>setSlideshowInterval(Math.max(3, parseInt(e.target.value)))} className="w-10 bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-white text-[10px] text-center"/>}</div>
                ) : (
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-400 border-t border-gray-800 pt-1"><div className="flex items-center gap-2"><span className="">Auto-Play Next Video</span> <input type="checkbox" checked={videoAutoNext} onChange={(e) => setVideoAutoNext(e.target.checked)} className="rounded text-blue-500 focus:ring-0 cursor-pointer h-3 w-3"/></div></div>
                )}
             </div>
             <div className="bg-gray-900 p-2 rounded-lg border border-gray-700">
                <div className="text-[10px] text-gray-500 uppercase font-bold mb-2 flex justify-between"><span>Audio Stream</span><span className="text-green-500">{activeAudioId ? 'ACTIVE' : 'IDLE'}</span></div>
                <div className="flex items-center gap-3"><button onClick={toggleAudioPlay} className="p-2 bg-white text-black rounded-full hover:scale-105 transition shadow-sm" title="Play/Pause Music">{isAudioPlaying ? <Pause size={16} fill="black" /> : <Play size={16} className="ml-0.5" fill="black" />}</button><div className="flex-1 flex items-center gap-2"><Volume1 size={14} className="text-gray-400"/><input type="range" min="0" max="1" step="0.1" value={audioVolume} onChange={(e) => changeAudioVolume(parseFloat(e.target.value))} className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"/></div></div>
                <div className="mt-2 flex items-center justify-between text-xs text-gray-400 border-t border-gray-800 pt-1"><div className="flex items-center gap-2"><span className="">Auto-Play Next Music</span> <input type="checkbox" checked={audioAutoNext} onChange={(e) => setAudioAutoNext(e.target.checked)} className="rounded text-green-500 focus:ring-0 cursor-pointer h-3 w-3"/></div></div>
             </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col bg-gray-800/50 min-h-0 w-full overflow-hidden relative"> 
           <div className="flex border-b border-gray-700 shrink-0 bg-gray-800">
             <button onClick={() => setQueueTab('queue')} className={`flex-1 py-3 font-medium text-sm border-b-2 transition-colors ${queueTab === 'queue' ? 'border-pink-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>Pending ({queue.filter(i => i.status === 'pending').length})</button>
             <button onClick={() => setQueueTab('approved')} className={`flex-1 py-3 font-medium text-sm border-b-2 transition-colors ${queueTab === 'approved' ? 'border-green-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>Live ({queue.filter(i => i.status === 'approved').length})</button>
           </div>
           <div className="px-6 py-2 border-b border-gray-700 flex gap-2 overflow-x-auto shrink-0 bg-gray-800/30">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center mr-2">Filter:</span>
              {['all', 'text', 'image'].map(type => ( <button key={type} onClick={() => setContentFilter(type)} className={`px-3 py-1 rounded-full text-xs font-bold capitalize transition ${contentFilter === type ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>{type}</button>))}
           </div>
           <div className="flex-1 overflow-y-auto p-4 lg:p-6 min-h-0">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 pb-20"> 
              {filteredQueue.map((item) => (
                <div key={item.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden flex flex-col shadow-lg hover:shadow-xl transition-shadow h-auto">
                  {item.image && (
                    <div className="h-48 bg-gray-900 relative group border-b border-gray-700 shrink-0">
                       {/* --- THUMBNAIL RENDERING (GIF Support + Auto-Play Video) --- */}
                       {item.type === 'video' ? (
                           <video src={item.image} className="w-full h-full object-contain" autoPlay loop muted playsInline />
                       ) : (
                           // Standard img tag handles GIFs automatically
                           <img src={item.image} className="w-full h-full object-contain" alt="content" />
                       )}

                       {!item.aiEnhanced && item.status === 'pending' && <button onClick={() => generateAiVariant(item)} className="absolute top-2 right-2 bg-purple-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 shadow-lg hover:bg-purple-500 transition"><Wand2 size={12} /> AI</button>}
                       
                       {/* NEW LOCATION: GENERATE VIDEO BUTTON (In Pending) */}
                       {item.type === 'image' && item.status === 'pending' && (
                           <button 
                             onClick={() => generateAiVideo(item)} 
                             disabled={generatingId === item.id}
                             className="absolute bottom-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 shadow-lg hover:bg-blue-500 transition"
                           >
                             {generatingId === item.id ? <span className="animate-spin">⏳</span> : <Film size={12} />} 
                             {generatingId === item.id ? 'Generating...' : 'Animate'}
                           </button>
                       )}
                    </div>
                  )}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2"><span className="font-bold text-pink-400 truncate w-32">{String(item.sender)}</span><span className="text-xs text-gray-500 whitespace-nowrap">{new Date(item.timestamp?.seconds * 1000).toLocaleTimeString()}</span></div>
                      <p className="text-gray-300 text-sm mb-4 whitespace-pre-wrap break-words">{String(item.text || "(Photo only)")}</p>
                    </div>
                    <div className="flex gap-2">
                      {item.status === 'pending' ? (
                        <>
                          <button onClick={() => updateStatus(item.id, 'approved')} className="flex-1 bg-green-600 hover:bg-green-500 py-2 rounded flex justify-center items-center gap-2 text-sm font-bold transition"><Check size={16} /> Approve</button>
                          <button onClick={() => deleteMessage(item.id)} className="bg-red-900/20 hover:bg-red-900/50 text-red-400 px-3 py-2 rounded transition"><Trash2 size={16} /></button>
                        </>
                      ) : (
                        <>
                           <button onClick={() => updateStatus(item.id, 'pending')} className="flex-1 bg-yellow-600 hover:bg-yellow-500 py-2 rounded flex justify-center items-center gap-2 text-sm font-bold transition"><RotateCcw size={16} /> Hide</button>
                           <button onClick={() => deleteMessage(item.id)} className="bg-red-900/20 hover:bg-red-900/50 text-red-400 px-3 py-2 rounded transition"><Trash2 size={16} /></button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
             </div>
           </div>
        </div>
        <div className={`border-l border-gray-700 flex flex-col bg-gray-900 transition-all duration-300 ease-in-out ${isRightPanelOpen ? 'w-full md:w-1/4 min-w-[300px]' : 'w-0 overflow-hidden opacity-0'}`}>
            <div className="p-4 border-b border-gray-800 font-bold bg-gray-800/50 min-w-[300px]">Stage Settings</div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6 min-w-[300px]">
                 <div className="bg-red-900/20 border border-red-800 p-4 rounded-xl space-y-3">
                    <div className="font-bold text-red-400 flex items-center gap-2 text-sm uppercase"><Megaphone size={14}/> Emergency Broadcast</div>
                    <textarea rows="3" value={announcementText} onChange={e=>setAnnouncementText(e.target.value)} placeholder="Type alert message..." className="w-full bg-gray-950 border border-red-900 rounded p-2 text-white text-sm focus:border-red-500 outline-none resize-none"/>
                    <button onClick={broadcastAnnouncement} className="w-full bg-red-600 hover:bg-red-500 text-white py-2 text-xs font-bold rounded uppercase shadow-lg transition transform active:scale-95">BLAST ANNOUNCEMENT</button>
                 </div>
                 <div className="bg-gray-800/40 p-4 rounded-xl space-y-4 border border-gray-700">
                    <div className="font-bold text-gray-400 flex items-center gap-2 text-sm"><Settings size={14}/> Stage Configuration</div>
                    <div><label className="block text-gray-500 text-xs uppercase font-bold mb-1">Header Title</label><input type="text" value={modHeaderTitle} onChange={e=>setModHeaderTitle(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-2 text-white text-sm"/></div>
                    <div><label className="block text-gray-500 text-xs uppercase font-bold mb-1">Background Image</label><input type="file" onChange={handleBgSelect} className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-gray-600 file:text-white hover:file:bg-gray-500"/>{modBgImage && <div className="mt-2 h-20 rounded bg-black overflow-hidden border border-gray-600"><img src={modBgImage} className="w-full h-full object-cover opacity-50"/></div>}</div>
                    <div className="grid grid-cols-2 gap-3"><div><label className="block text-gray-500 text-xs uppercase font-bold mb-1">Img Speed (s)</label><input type="number" value={timers.imgTimer} onChange={e=>setTimers({...timers, imgTimer: parseInt(e.target.value) || 5})} className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-2 text-white text-sm"/></div><div><label className="block text-gray-500 text-xs uppercase font-bold mb-1">Text Speed (s)</label><input type="number" value={timers.textTimer} onChange={e=>setTimers({...timers, textTimer: parseInt(e.target.value) || 5})} className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-2 text-white text-sm"/></div></div>
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-700"><div><label className="block text-gray-500 text-xs uppercase font-bold mb-1 flex items-center gap-1"><ImageIcon size={10}/> Max Images</label><input type="number" min="1" max="3" value={timers.imgCount} onChange={e=>setTimers({...timers, imgCount: Math.min(3, parseInt(e.target.value) || 3)})} className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-2 text-white text-sm"/></div><div><label className="block text-gray-500 text-xs uppercase font-bold mb-1 flex items-center gap-1"><MessageSquare size={10}/> Max Texts</label><input type="number" min="1" max="6" value={timers.textCount} onChange={e=>setTimers({...timers, textCount: Math.min(6, parseInt(e.target.value) || 5)})} className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-2 text-white text-sm"/></div></div>
                    <button onClick={saveSettings} disabled={isSavingSettings} className="w-full bg-blue-600 py-2.5 rounded text-white font-bold hover:bg-blue-500 transition flex items-center justify-center gap-2 shadow-lg"><Save size={14}/> {isSavingSettings ? 'Saving...' : 'Apply Settings'}</button>
                 </div>
            </div>
        </div>
      </div>
    </div>
  );
};

const AdminView = ({ currentUser }) => {
  const [customers, setCustomers] = useState([]);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPass, setNewCustPass] = useState('');
  const [newCustRole, setNewCustRole] = useState('customer');
  const [stats, setStats] = useState({});

  useEffect(() => {
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'customers'));
    // FIX: Added error handler to prevent crash if permissions fail
    const unsub = onSnapshot(q, (snap) => {
        setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
        console.error("Error fetching customers:", error);
        // Optional: Set an error state here if you want to show a UI message
    });
    return () => unsub();
  }, []);

  const createCustomer = async () => {
    if (currentUser.role === 'admin-read') { alert("Read Only Access"); return; }
    if (!newCustName || !newCustPass) return;
    const id = createSlug(newCustName);
    if (!id) { alert("Invalid slug"); return; }
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'customers', id), { name: newCustName, password: newCustPass, role: newCustRole, createdAt: serverTimestamp(), disabled: false, settings: { imgTimer: 5, textTimer: 5 }, headerTitle: '', backgroundImage: null });
    setNewCustName(''); setNewCustPass(''); alert(`Created: ${newCustName}`);
  };

  const toggleDisable = async (custId, currentStatus) => {
    if (currentUser.role === 'admin-read') { alert("Read Only Access"); return; }
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'customers', custId), { disabled: !currentStatus });
  };
  const deleteCustomer = async (custId) => {
    if (currentUser.role === 'admin-read') { alert("Read Only Access"); return; }
    if (confirm('Are you sure you want to delete this customer? This cannot be undone.')) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'customers', custId));
    }
  };

  const loadStats = async (custId) => {
      const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'messages'), where('customerId', '==', custId));
      const snap = await getDocs(q);
      const count = snap.size;
      let imgCount = 0; let sizeBytes = 0;
      snap.docs.forEach(d => { const data = d.data(); if(data.type === 'image') imgCount++; if(data.text) sizeBytes += data.text.length; if(data.image) sizeBytes += data.image.length; });
      const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
      setStats(prev => ({ ...prev, [custId]: { count, imgCount, sizeMB } }));
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8 font-sans text-white">
      {/* CSS STYLES: Ensuring minimal styles required for admin view are present */}
      <style>{`
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold flex items-center gap-3 text-white"><Settings className="text-gray-400" /> Admin Control Panel</h1>
            <div className="text-right"><div className="text-sm text-gray-400">Logged in as</div><div className="font-bold text-pink-500">{currentUser.name} ({currentUser.role})</div></div>
        </div>
        {currentUser.role !== 'admin-read' && (
            <div className="bg-gray-800 p-6 rounded-xl shadow-md mb-8 border border-gray-700">
            <h3 className="font-bold text-lg mb-4 text-gray-300">Create New User / Event</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div><label className="block text-sm font-bold mb-1 text-gray-500">Event Name</label><input type="text" value={newCustName} onChange={(e) => setNewCustName(e.target.value)} className="w-full p-2 bg-gray-900 border border-gray-600 rounded text-white" placeholder="e.g. Townhall"/></div>
                <div><label className="block text-sm font-bold mb-1 text-gray-500">Password</label><input type="text" value={newCustPass} onChange={(e) => setNewCustPass(e.target.value)} className="w-full p-2 bg-gray-900 border border-gray-600 rounded text-white" placeholder="secret123"/></div>
            </div>
            <div className="flex gap-4 items-end">
                <div className="w-48"><label className="block text-sm font-bold mb-1 text-gray-500">Role</label><select value={newCustRole} onChange={e=>setNewCustRole(e.target.value)} className="w-full p-2 bg-gray-900 border border-gray-600 rounded text-white"><option value="customer">Customer (Event)</option><option value="admin">Admin (Full)</option><option value="admin-read">Admin (Read-Only)</option></select></div>
                <button onClick={createCustomer} className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-500 shadow-md transition">Create</button>
            </div>
            </div>
        )}
        <div className="grid gap-4">
          {customers.map(cust => (
            <div key={cust.id} className={`p-6 rounded-xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center border ${cust.disabled ? 'bg-red-900/20 border-red-800' : 'bg-gray-800 border-gray-700'}`}>
              <div className="mb-4 md:mb-0">
                <div className="font-bold text-xl text-white flex items-center gap-2">{String(cust.name)} {cust.disabled && <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded">DISABLED</span>}<span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded uppercase">{cust.role}</span></div>
                <div className="text-xs text-gray-500 mt-1 space-y-1"><div>ID: <span className="font-mono bg-gray-900 px-1 rounded text-gray-400">{String(cust.id)}</span></div><div>Pass: <span className="font-mono bg-gray-900 px-1 rounded text-gray-400">{String(cust.password)}</span></div>{cust.role === 'customer' && (<div className="flex gap-2 mt-2"><a href={`/${cust.id}`} target="_blank" className="text-blue-400 hover:underline">Attendee</a><span className="text-gray-600">|</span><a href={`/stage/${cust.id}`} target="_blank" className="text-blue-400 hover:underline">Stage</a></div>)}</div>
              </div>
              <div className="flex flex-col items-end gap-3">
                 {cust.role === 'customer' && (<div className="flex items-center gap-4 text-sm text-gray-400 bg-gray-900/50 p-2 rounded">{stats[cust.id] ? (<><div className="flex items-center gap-1"><MessageSquare size={14}/> {stats[cust.id].count} Msgs</div><div className="flex items-center gap-1"><ImagePlus size={14}/> {stats[cust.id].imgCount} Imgs</div><div className="flex items-center gap-1"><HardDrive size={14}/> {stats[cust.id].sizeMB} MB</div></>) : (<button onClick={() => loadStats(cust.id)} className="text-xs text-blue-400 hover:underline flex items-center gap-1"><BarChart3 size={14}/> Load Stats</button>)}</div>)}
                 {currentUser.role !== 'admin-read' && (<div className="flex gap-3"><button onClick={() => toggleDisable(cust.id, cust.disabled)} className={`px-4 py-2 text-sm border rounded font-medium ${cust.disabled ? 'bg-green-900/30 text-green-400 border-green-800' : 'bg-yellow-900/30 text-yellow-500 border-yellow-800'}`}>{cust.disabled ? 'Enable' : 'Disable'}</button><button onClick={() => deleteCustomer(cust.id)} className="px-4 py-2 text-sm bg-red-600/20 text-red-400 border border-red-900/50 rounded hover:bg-red-600/40 font-medium shadow-sm">Delete</button></div>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [route, setRoute] = useState({ view: 'loading', data: null });
  const [session, setSession] = useState(null); 

  useEffect(() => {
    const initAuth = async () => { if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token); else await signInAnonymously(auth); };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const cleanPath = window.location.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
    const parts = cleanPath.split('/');
    const firstPart = parts[0];
    if (firstPart === 'admin') setRoute({ view: 'admin-login' });
    else if (firstPart === 'moderator') setRoute({ view: 'mod-login' });
    else if (firstPart === 'stage') { const slug = parts[1]; if (slug) setRoute({ view: 'stage', data: slug }); else setRoute({ view: 'stage-setup' }); }
    else if (cleanPath !== '') setRoute({ view: 'attendee', data: cleanPath });
    else setRoute({ view: 'admin-login' }); 
  }, []);

  if (!user) return <div className="h-screen flex items-center justify-center text-gray-500 animate-pulse">Connecting...</div>;

  if (route.view === 'admin-login') {
     if (session && (session.role === 'admin' || session.role === 'admin-read')) return <AdminView currentUser={session} />;
     return <AdminLogin onLogin={(user) => setSession(user)} />;
  }
  if (route.view === 'mod-login') {
     if (session?.role === 'mod') return <ModeratorView customerId={session.slug} customerData={{name: session.slug}} />;
     return <ModeratorLogin onLogin={(slug) => setSession({ role: 'mod', slug })} />;
  }
  if (route.view === 'stage-setup') return <StageSetup onLaunch={(slug) => window.location.href = `/stage/${slug}`} />;
  if (route.view === 'stage') return <StageView customerId={route.data} />;
  if (route.view === 'attendee') return <AttendeeView customerId={route.data} user={user} />;

  return <div>404 Not Found</div>;
}