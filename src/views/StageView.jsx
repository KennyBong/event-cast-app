import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, query, collection, where } from 'firebase/firestore';
import { Siren, Maximize } from 'lucide-react';
import { db } from '../firebase';

const BROADCAST_CHANNEL_NAME = 'event_stage_sync';
const DEFAULT_SETTINGS = { imgTimer: 5, textTimer: 5, imgCount: 3, textCount: 5 };
const ANIMATIONS = ['animate-fade-in', 'animate-pop-in', 'animate-slide-in-right'];
const getRandomAnim = () => ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];
const appId = 'my-event-v1';

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

    useEffect(() => { if (videoRef.current) { if (isVideoPlaying) videoRef.current.play().catch(() => { }); else videoRef.current.pause(); } }, [isVideoPlaying, mediaSource]);
    useEffect(() => { if (videoRef.current) videoRef.current.volume = videoVolume; }, [videoVolume]);
    useEffect(() => { if (audioRef.current) { if (isAudioPlaying) audioRef.current.play().catch(() => { }); else audioRef.current.pause(); } }, [isAudioPlaying, audioSource]);
    useEffect(() => { if (audioRef.current) audioRef.current.volume = audioVolume; }, [audioVolume]);

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

            // IMMEDIATELY REMOVE UNAPPROVED ITEMS FROM DISPLAY
            const approvedImgIds = new Set(imgs.map(i => i.id));
            const approvedTextIds = new Set(texts.map(t => t.id));
            setImgSlots(prev => prev.map(slot => slot && approvedImgIds.has(slot.id) ? slot : null));
            setTextSlots(prev => prev.map(slot => slot && approvedTextIds.has(slot.id) ? slot : null));
        });
        const eq = query(collection(db, 'artifacts', appId, 'public', 'data', 'emojis'), where('customerId', '==', customerId));
        const unsubE = onSnapshot(eq, (snap) => {
            snap.docChanges().forEach(c => {
                if (c.type === 'added' && c.doc.data().timestamp?.seconds > (Date.now() / 1000 - 5)) {
                    const id = c.doc.id;
                    const emojiStr = typeof c.doc.data().emoji === 'string' ? c.doc.data().emoji : '👍';
                    setEmojis(p => [...p, { id, emoji: emojiStr, left: Math.random() * 80 + 10 }].slice(-25));
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
                while (attempts < totalApproved) {
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
                while (attempts < totalApproved + 1) {
                    const candidate = allApprovedTextsRef.current[textHistoryIdx.current];
                    textHistoryIdx.current = (textHistoryIdx.current + 1) % allApprovedTextsRef.current.length;
                    if (!displayedIds.has(candidate.id)) { next = { ...candidate, isNew: false }; break; }
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
                ) : sessionData.backgroundImage ? (<img src={sessionData.backgroundImage} className="w-full h-full object-cover opacity-40" alt="Customer BG" />) : (<div className="text-gray-600 text-4xl font-bold animate-pulse">Waiting for Signal...</div>)}
            </div>
            <audio ref={audioRef} src={audioSource} loop={false} onEnded={handleAudioEnded} />
            {announcement && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-red-600/90 animate-fade-in p-12 text-center">
                    <div><div className="text-yellow-300 mb-4 animate-bounce"><Siren size={64} className="mx-auto" /></div><h1 className="text-white text-6xl font-black uppercase tracking-wider drop-shadow-xl">{String(announcement)}</h1></div>
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
                                        <div className={`font-bold mb-1 leading-snug break-words text-right ${item.text && item.text.length > 50 ? 'text-lg' : 'text-3xl'}`}>"{String(item.text || '')}"</div>
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
        </div>
    );
};

export default StageView;
