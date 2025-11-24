import React, { useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Play, Pause, Share2 } from 'lucide-react';

const appId = 'my-event-v1';

const RecapView = ({ customerId }) => {
    const [items, setItems] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const [loading, setLoading] = useState(true);
    const [headerTitle, setHeaderTitle] = useState('');
    const [backgroundImage, setBackgroundImage] = useState('');

    // Fetch Data & Sign URLs
    useEffect(() => {
        if (!customerId) return;

        const eventRef = doc(db, 'artifacts', appId, 'public', 'data', 'customers', customerId);
        const unsubEvent = onSnapshot(eventRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setHeaderTitle(data.headerTitle || 'Event Recap');
                setBackgroundImage(data.backgroundImage || '');
            }
        });

        const q = query(
            collection(db, 'artifacts', appId, 'public', 'data', 'messages'),
            where('customerId', '==', customerId),
            where('status', '==', 'approved')
        );

        const unsubMsg = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));

            setItems(data);
            setLoading(false);
        });

        return () => { unsubEvent(); unsubMsg(); };
    }, [customerId]);

    // Slideshow Logic
    useEffect(() => {
        if (!isPlaying || items.length === 0) return;
        const timer = setInterval(() => {
            setCurrentIndex(prev => prev + 1);
        }, 4000);
        return () => clearInterval(timer);
    }, [isPlaying, items.length]);

    // Generate random rotations for the stack effect
    const rotations = useMemo(() => items.map(() => Math.random() * 10 - 5), [items.length]);

    // Distribute visible items into 3 slots
    const getSlotItems = (slotIndex) => {
        if (items.length === 0) return [];

        const result = [];
        // We want the 3 most recent items for this slot
        // The logical index for an item in this slot is `k * 3 + slotIndex`
        // We need to find `k` such that `k * 3 + slotIndex <= currentIndex`
        // And then take the last 3 such items.

        // Start from the current step and go backwards to find items for this slot
        for (let i = 0; i < 5; i++) {
            // Calculate the logical index for the item that would be at this position in the stack
            // For example, if currentIndex is 5, slotIndex is 2:
            // i=0: logicalIdx = 5 - (5 % 3) + 2 - (0 * 3) = 5 - 2 + 2 = 5. (This is the top item for slot 2)
            // i=1: logicalIdx = 5 - (5 % 3) + 2 - (1 * 3) = 5 - 2 + 2 - 3 = 2. (This is the item behind it)
            // i=2: logicalIdx = 5 - (5 % 3) + 2 - (2 * 3) = 5 - 2 + 2 - 6 = -1. (This would be too far back)

            // The current item being "revealed" is at `currentIndex`.
            // The slot it goes into is `currentIndex % 3`.
            // If `slotIndex` matches `currentIndex % 3`, then `currentIndex` itself is the top item for this slot.
            // Otherwise, the top item for this slot would be `currentIndex - (currentIndex % 3) + slotIndex`.
            // This calculation needs to be careful about `slotIndex` being greater than `currentIndex % 3`.

            let logicalIdx;
            if (slotIndex <= (currentIndex % 3)) {
                logicalIdx = currentIndex - ((currentIndex % 3) - slotIndex) - (i * 3);
            } else {
                // If slotIndex is ahead of current item's slot, it means the current item hasn't reached this slot yet in the current "cycle"
                // So we look at the previous cycle's item for this slot.
                logicalIdx = currentIndex - ((currentIndex % 3) + (3 - slotIndex)) - (i * 3);
            }


            if (logicalIdx >= 0) {
                result.unshift(items[logicalIdx % items.length]);
            }
        }
        return result;
    };

    const slot0Items = getSlotItems(0);
    const slot1Items = getSlotItems(1);
    const slot2Items = getSlotItems(2);

    if (loading) return <div className="h-screen bg-neutral-900 flex items-center justify-center text-white font-sans">Loading Memories...</div>;
    if (items.length === 0) return <div className="h-screen bg-neutral-900 flex items-center justify-center text-white font-sans">No memories yet. Start the event!</div>;

    return (
        <div className="h-screen w-screen bg-neutral-900 overflow-hidden relative font-sans flex flex-col items-center justify-center">

            {/* Ambient Background - Use event background */}
            <div className="absolute inset-0 opacity-70 blur-sm transition-all duration-1000"
                style={{
                    backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
                    backgroundColor: '#222',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                }}
            />
            {/* Dark overlay for readability */}
            <div className="absolute inset-0 bg-black/30" />

            {/* Header */}
            <div className="absolute top-8 z-20 text-center">
                <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-lg tracking-wider font-display">
                    {headerTitle}
                </h1>
                <div className="text-pink-400 text-lg mt-1 tracking-widest uppercase font-medium">Memory Lane</div>
            </div>

            {/* 3 Columns Container */}
            <div className="relative w-full px-10 h-[70vh] grid grid-cols-3 gap-20 z-10">
                {[slot0Items, slot1Items, slot2Items].map((stackItems, colIndex) => (
                    <div key={colIndex} className="relative w-full h-full flex items-center justify-center">
                        {stackItems.map((item, stackIndex) => {
                            // Calculate depth (0 is furthest back, length-1 is top)
                            const isTop = stackIndex === stackItems.length - 1;
                            const depth = stackItems.length - 1 - stackIndex; // 0 for top, 1 for behind, 2 for last

                            // Random rotation for "nature" look
                            // Increased tilt range: -12 to +12 degrees
                            const rotation = (item.id.charCodeAt(0) % 25 - 12);
                            const scale = 1 - (depth * 0.05);
                            const translateY = depth * -10; // Stack upwards slightly? Or downwards? "Stack on top" usually means z-axis.
                            // Let's just offset them slightly to show the pile

                            return (
                                <div
                                    key={`${item.id}-${colIndex}-${stackIndex}`}
                                    className={`absolute bg-white p-3 pb-3 shadow-2xl transition-all duration-700 ease-in-out flex flex-col items-center
                                        ${isTop ? 'z-20' : 'z-10'}
                                    `}
                                    style={{
                                        width: 'fit-content',
                                        maxWidth: '100%',
                                        transform: `rotate(${rotation}deg) scale(${scale}) translateY(${translateY}px)`,
                                        zIndex: stackIndex
                                    }}
                                >
                                    <div className="bg-gray-100 mb-2 shrink-0">
                                        {item.type === 'image' && (
                                            <img
                                                src={item.image}
                                                className="block"
                                                style={{
                                                    height: 'auto',
                                                    width: 'auto',
                                                    maxHeight: '55vh',
                                                    maxWidth: '100%',
                                                    display: 'block',
                                                    objectFit: 'contain'
                                                }}
                                                alt="Memory"
                                            />
                                        )}
                                        {item.type !== 'image' && (
                                            <div className="w-64 h-64 flex items-center justify-center bg-gray-50 p-6 text-center border border-gray-200">
                                                <p className="text-xl font-bold text-gray-800 leading-tight font-display">
                                                    "{item.text}"
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col items-center justify-center text-center" style={{ width: 0, minWidth: '100%' }}>
                                        {item.text && item.type === 'image' && (
                                            <div
                                                className={`text-[#2c2c2c] leading-none font-bold font-serif px-1 w-full break-words ${item.text.length > 50 ? 'text-xs' : 'text-sm md:text-base'}`}
                                                style={{ fontFamily: 'cursive' }}
                                            >
                                                {item.text}
                                            </div>
                                        )}
                                        <div className="mt-1 text-gray-500 text-[10px] font-bold font-sans self-end w-full text-right">
                                            @{item.sender}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>

            {/* Controls */}
            <div className="absolute bottom-12 flex gap-6 z-20">
                <button onClick={() => setIsPlaying(!isPlaying)} className="p-4 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-all hover:scale-110">
                    {isPlaying ? <Pause size={28} /> : <Play size={28} />}
                </button>
                <button onClick={() => navigator.share?.({ title: 'Event Recap', url: window.location.href })} className="p-4 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-all hover:scale-110">
                    <Share2 size={28} />
                </button>
            </div>

            {/* Styles */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700&family=Permanent+Marker&display=swap');
                
                .font-display { font-family: 'Outfit', sans-serif; }
                .font-handwriting { font-family: 'Permanent Marker', cursive; }
            `}</style>
        </div>
    );
};



export default RecapView;
