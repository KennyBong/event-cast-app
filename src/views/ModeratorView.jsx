import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, query, collection, where, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import {
    PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Eye, EyeOff, Link as LinkIcon, ExternalLink,
    Music, X, Pause, Play, Volume2, SkipForward, Volume1, Megaphone, Settings, ImageIcon, MessageSquare, Save,
    Check, RotateCcw, Trash2, Wand2, Film
} from 'lucide-react';
import { db } from '../firebase';

const BROADCAST_CHANNEL_NAME = 'event_stage_sync';
const appId = 'my-event-v1';

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
    const broadcastAnnouncement = () => { if (!announcementText) return; broadcastChannel.current.postMessage({ action: 'ANNOUNCEMENT', payload: announcementText || ' ' }); setAnnouncementText(''); alert('Announcement broadcasted to stage!'); };

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
        if (targetList.length === 0) return;
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

    const generateAiVideo = async (msg) => {
        if (!msg.image) return alert("No image source found!");

        setGeneratingId(msg.id);

        setTimeout(async () => {
            try {
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'messages', msg.id), {
                    type: 'video', // Change type to video
                    aiEnhanced: true,
                    text: "✨ AI Animated Memory"
                });
                setGeneratingId(null);
                alert("AI Video Generated!");
            } catch (e) {
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
                                        <div className="w-8 h-8 bg-black rounded flex items-center justify-center text-green-500 shrink-0 border border-gray-600"><Music size={16} /></div>
                                        <div className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm pr-6">{m.name}</div>
                                        {isActive && <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>}
                                        <button onClick={(e) => removeMedia(e, m.id)} className="absolute right-2 text-gray-500 hover:text-red-500"><X size={14} /></button>
                                    </div>
                                );
                            })
                        ) : (
                            (sourceTab === 'videos' ? videoList : imageList).map((m) => {
                                const isActive = activeVisualId === m.id;
                                return (
                                    <div key={m.id} onClick={() => activateMedia(m)} className={`p-2 rounded cursor-pointer flex items-center gap-3 transition-all border group relative ${isActive ? 'bg-pink-900/30 border-pink-500' : 'bg-gray-800 border-gray-700 hover:bg-gray-700'}`}>
                                        <div className="w-12 h-12 bg-black rounded overflow-hidden shrink-0 border border-gray-600">
                                            {m.type === 'image' ? <img src={m.url} className="w-full h-full object-cover" /> : <video src={m.url} className="w-full h-full object-cover" />}
                                        </div>
                                        <div className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm pr-6">{m.name}</div>
                                        {isActive && <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse"></div>}
                                        <button onClick={(e) => removeMedia(e, m.id)} className="absolute right-2 text-gray-500 hover:text-red-500"><X size={14} /></button>
                                    </div>
                                );
                            })
                        )}
                        {localMedia.filter(m => m.type === (sourceTab === 'audio' ? 'audio' : sourceTab === 'videos' ? 'video' : 'image')).length === 0 && <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm"><p>Drag & Drop files here</p></div>}
                    </div>
                    <div className="p-4 bg-gray-800 border-t border-gray-700 min-w-[300px] space-y-4">
                        <div className="bg-gray-900 p-2 rounded-lg border border-gray-700">
                            <div className="text-[10px] text-gray-500 uppercase font-bold mb-2 flex justify-between"><span>Visual Stream</span><span className="text-pink-500">{activeVisualId ? 'ACTIVE' : 'IDLE'}</span></div>
                            <div className="flex items-center gap-3"><button onClick={toggleVideoPlay} className="p-2 bg-white text-black rounded-full hover:scale-105 transition shadow-sm" title="Play/Pause Visual">{isVideoPlaying ? <Pause size={16} fill="black" /> : <Play size={16} className="ml-0.5" fill="black" />}</button><div className="flex-1 flex items-center gap-2"><Volume2 size={14} className="text-gray-400" /><input type="range" min="0" max="1" step="0.1" value={videoVolume} onChange={(e) => changeVideoVolume(parseFloat(e.target.value))} className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer" /></div><button onClick={nextMedia} className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition"><SkipForward size={14} /></button></div>
                            {sourceTab === 'images' ? (
                                <div className="mt-2 flex items-center justify-between text-xs text-gray-400 border-t border-gray-800 pt-1"><div className="flex items-center gap-2"><span className="">Slideshow</span> <input type="checkbox" checked={isImgSlideshow} onChange={(e) => setIsImgSlideshow(e.target.checked)} className="rounded text-pink-500 focus:ring-0 cursor-pointer h-3 w-3" /></div>{isImgSlideshow && <input type="number" min="3" value={slideshowInterval} onChange={e => setSlideshowInterval(Math.max(3, parseInt(e.target.value)))} className="w-10 bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-white text-[10px] text-center" />}</div>
                            ) : (
                                <div className="mt-2 flex items-center justify-between text-xs text-gray-400 border-t border-gray-800 pt-1"><div className="flex items-center gap-2"><span className="">Auto-Play Next Video</span> <input type="checkbox" checked={videoAutoNext} onChange={(e) => setVideoAutoNext(e.target.checked)} className="rounded text-blue-500 focus:ring-0 cursor-pointer h-3 w-3" /></div></div>
                            )}
                        </div>
                        <div className="bg-gray-900 p-2 rounded-lg border border-gray-700">
                            <div className="text-[10px] text-gray-500 uppercase font-bold mb-2 flex justify-between"><span>Audio Stream</span><span className="text-green-500">{activeAudioId ? 'ACTIVE' : 'IDLE'}</span></div>
                            <div className="flex items-center gap-3"><button onClick={toggleAudioPlay} className="p-2 bg-white text-black rounded-full hover:scale-105 transition shadow-sm" title="Play/Pause Music">{isAudioPlaying ? <Pause size={16} fill="black" /> : <Play size={16} className="ml-0.5" fill="black" />}</button><div className="flex-1 flex items-center gap-2"><Volume1 size={14} className="text-gray-400" /><input type="range" min="0" max="1" step="0.1" value={audioVolume} onChange={(e) => changeAudioVolume(parseFloat(e.target.value))} className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer" /></div></div>
                            <div className="mt-2 flex items-center justify-between text-xs text-gray-400 border-t border-gray-800 pt-1"><div className="flex items-center gap-2"><span className="">Auto-Play Next Music</span> <input type="checkbox" checked={audioAutoNext} onChange={(e) => setAudioAutoNext(e.target.checked)} className="rounded text-green-500 focus:ring-0 cursor-pointer h-3 w-3" /></div></div>
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
                        {['all', 'text', 'image'].map(type => (<button key={type} onClick={() => setContentFilter(type)} className={`px-3 py-1 rounded-full text-xs font-bold capitalize transition ${contentFilter === type ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>{type}</button>))}
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
                            <div className="font-bold text-red-400 flex items-center gap-2 text-sm uppercase"><Megaphone size={14} /> Emergency Broadcast</div>
                            <textarea rows="3" value={announcementText} onChange={e => setAnnouncementText(e.target.value)} placeholder="Type alert message..." className="w-full bg-gray-950 border border-red-900 rounded p-2 text-white text-sm focus:border-red-500 outline-none resize-none" />
                            <button onClick={broadcastAnnouncement} className="w-full bg-red-600 hover:bg-red-500 text-white py-2 text-xs font-bold rounded uppercase shadow-lg transition transform active:scale-95">BLAST ANNOUNCEMENT</button>
                        </div>
                        <div className="bg-gray-800/40 p-4 rounded-xl space-y-4 border border-gray-700">
                            <div className="font-bold text-gray-400 flex items-center gap-2 text-sm"><Settings size={14} /> Stage Configuration</div>
                            <div><label className="block text-gray-500 text-xs uppercase font-bold mb-1">Header Title</label><input type="text" value={modHeaderTitle} onChange={e => setModHeaderTitle(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-2 text-white text-sm" /></div>
                            <div><label className="block text-gray-500 text-xs uppercase font-bold mb-1">Background Image</label><input type="file" onChange={handleBgSelect} className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-gray-600 file:text-white hover:file:bg-gray-500" />{modBgImage && <div className="mt-2 h-20 rounded bg-black overflow-hidden border border-gray-600"><img src={modBgImage} className="w-full h-full object-cover opacity-50" /></div>}</div>
                            <div className="grid grid-cols-2 gap-3"><div><label className="block text-gray-500 text-xs uppercase font-bold mb-1">Img Speed (s)</label><input type="number" value={timers.imgTimer} onChange={e => setTimers({ ...timers, imgTimer: parseInt(e.target.value) || 5 })} className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-2 text-white text-sm" /></div><div><label className="block text-gray-500 text-xs uppercase font-bold mb-1">Text Speed (s)</label><input type="number" value={timers.textTimer} onChange={e => setTimers({ ...timers, textTimer: parseInt(e.target.value) || 5 })} className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-2 text-white text-sm" /></div></div>
                            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-700"><div><label className="block text-gray-500 text-xs uppercase font-bold mb-1 flex items-center gap-1"><ImageIcon size={10} /> Max Images</label><input type="number" min="1" max="3" value={timers.imgCount} onChange={e => setTimers({ ...timers, imgCount: Math.min(3, parseInt(e.target.value) || 3) })} className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-2 text-white text-sm" /></div><div><label className="block text-gray-500 text-xs uppercase font-bold mb-1 flex items-center gap-1"><MessageSquare size={10} /> Max Texts</label><input type="number" min="1" max="6" value={timers.textCount} onChange={e => setTimers({ ...timers, textCount: Math.min(6, parseInt(e.target.value) || 5) })} className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-2 text-white text-sm" /></div></div>
                            <button onClick={saveSettings} disabled={isSavingSettings} className="w-full bg-blue-600 py-2.5 rounded text-white font-bold hover:bg-blue-500 transition flex items-center justify-center gap-2 shadow-lg"><Save size={14} /> {isSavingSettings ? 'Saving...' : 'Apply Settings'}</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ModeratorView;
