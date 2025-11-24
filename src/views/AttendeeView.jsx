import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, collection, serverTimestamp, addDoc } from 'firebase/firestore';
import { AlertCircle, ImagePlus, X } from 'lucide-react';
import { db } from '../firebase';
import ImageCropper from '../components/ImageCropper';
import { uploadFileToS3, submitMessage } from '../services/api';
import { sendEmojiSocket } from '../services/socket';

const EMOJIS = ['❤️', '🔥', '👏', '😂', '😮', '🎉'];
const appId = 'my-event-v1';

/**
 * UTILITY: Resize Image to Max Width
 */
const resizeImage = (file, maxWidth) => {
    return new Promise((resolve) => {
        if (file.type === 'image/gif') return resolve(file);
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            let w = img.width;
            let h = img.height;
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
            }, file.type, 0.9);
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
        img.src = url;
    });
};

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

        if (file.size > 15 * 1024 * 1024) {
            alert("Image is too large (Max 15MB).");
            return;
        }

        if (file.type === 'image/gif') {
            applyImage(file);
            return;
        }

        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = async () => {
            if (img.width >= img.height) {
                const resizedFile = await resizeImage(file, 1500);
                applyImage(resizedFile);
            } else {
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

    const onCropConfirm = (croppedFile) => { setShowCropper(false); applyImage(croppedFile); if (tempImgSrc) URL.revokeObjectURL(tempImgSrc); setTempImgSrc(null); };
    const onCropCancel = () => { setShowCropper(false); if (tempImgSrc) URL.revokeObjectURL(tempImgSrc); setTempImgSrc(null); };
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
            let imageUrl = null;
            if (image) {
                // Upload to S3 via Server
                imageUrl = await uploadFileToS3(image, customerId);
            }

            const newMsg = {
                customerId,
                sender: name,
                text: message,
                imageUrl: imageUrl,
                type: imageUrl ? 'image' : 'text',
                userId: user.uid
            };

            // Submit to Server (which writes to Firestore)
            await submitMessage(newMsg);

            // Optimistic update or wait for Firestore listener? 
            // Let's do optimistic for history
            setHistory(prev => [{ ...newMsg, status: 'pending' }, ...prev].slice(0, 5));

            setMessage('');
            removeImage();
            setCooldown(5);
            showToast('success', 'Sent to stage!');
        } catch (error) {
            console.error(error);
            showToast('error', error.message || 'Failed to send.');
        }
        setIsSubmitting(false);
    };

    const sendEmoji = (emoji) => {
        sendEmojiSocket(customerId, emoji);
        showToast('success', `Sent ${emoji}`);
    };

    if (isValidSession === false) return <div className="h-screen bg-gray-900 flex items-center justify-center text-white p-6"><AlertCircle size={48} className="text-red-500 mb-4" /><div className="text-xl">Event Not Found</div></div>;
    if (!sessionData) return <div className="h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-100 font-sans flex flex-col relative overflow-hidden">
            {showCropper && tempImgSrc && (<ImageCropper imageSrc={tempImgSrc} onConfirm={onCropConfirm} onCancel={onCropCancel} />)}
            <div className="bg-gray-900 h-48 relative shrink-0">
                {sessionData.backgroundImage && (<img src={sessionData.backgroundImage} className="w-full h-full object-cover opacity-60" alt="Event BG" />)}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <h1 className="text-3xl font-bold text-white drop-shadow-lg text-center px-4" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>{String(sessionData.headerTitle || "Event Interaction")}</h1>
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
                            <label className="flex items-center justify-center w-full h-12 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 hover:border-blue-400 transition text-gray-500 font-medium"><ImagePlus size={20} className="mr-2" /> Upload Photo (JPG/PNG/GIF)<input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} /></label>
                        ) : (
                            <div className="relative rounded-lg overflow-hidden bg-black group">
                                <img src={imagePreview} className="w-full h-48 object-contain bg-gray-900" alt="Preview" />
                                <button onClick={removeImage} className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full shadow-lg hover:scale-110 transition"><X size={16} /></button>
                            </div>
                        )}
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                        <label className="block text-sm font-bold text-gray-500 mb-1">Your Name</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Guest" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-800" />
                    </div>
                    <button onClick={handleSubmit} disabled={isSubmitting || cooldown > 0} className={`w-full py-4 rounded-xl font-bold text-white text-lg shadow-lg transform transition active:scale-95 flex items-center justify-center gap-2 ${isSubmitting || cooldown > 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:brightness-110'}`}>{isSubmitting ? 'Sending...' : cooldown > 0 ? `Wait ${cooldown}s` : 'Send to Stage'}</button>
                    {history.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-gray-200">
                            <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Recent Activity</h3>
                            {history.map((h, i) => (<div key={i} className="text-xs text-gray-500 mb-1 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-400"></span> {h.type === 'image' ? 'Sent a photo' : 'Sent a message'}</div>))}
                        </div>
                    )}
                </div>
            </div>
            <div className="absolute bottom-6 left-4 right-4 rounded-2xl bg-white/90 backdrop-blur border border-gray-200 p-3 pb-3 shadow-2xl safe-area-pb z-50">
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

export default AttendeeView;
