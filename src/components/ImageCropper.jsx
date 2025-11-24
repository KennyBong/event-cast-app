import React, { useState, useRef } from 'react';
import { Crop, ZoomOut, ZoomIn, Check, Move } from 'lucide-react';

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
        canvas.width = 1200; canvas.height = 1500;
        const ctx = canvas.getContext('2d');
        const naturalWidth = imgRef.current.naturalWidth;
        const naturalHeight = imgRef.current.naturalHeight;

        const drawX = pos.x * (1200 / VP_W);
        const drawY = pos.y * (1200 / VP_W);
        const drawW = naturalWidth * scale * (1200 / VP_W);
        const drawH = naturalHeight * scale * (1200 / VP_W);

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
            <div className="text-white font-bold mb-4 text-lg flex items-center gap-2"><Crop size={20} /> Adjust Portrait</div>
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
                <div className="flex items-center gap-3"><ZoomOut size={16} className="text-gray-400" /><input type="range" min="0.1" max="3" step="0.05" value={scale} onChange={(e) => setScale(parseFloat(e.target.value))} className="flex-1 accent-pink-500" /><ZoomIn size={16} className="text-gray-400" /></div>
                <div className="flex gap-3"><button onClick={onCancel} className="flex-1 py-3 bg-gray-800 text-white rounded-lg font-bold">Cancel</button><button onClick={handleCrop} className="flex-1 py-3 bg-pink-600 text-white rounded-lg font-bold shadow-lg flex justify-center items-center gap-2"><Check size={18} /> Done</button></div>
                <div className="text-center text-xs text-gray-500 flex items-center justify-center gap-1"><Move size={12} /> Drag image to position</div>
            </div>
        </div>
    );
};

export default ImageCropper;
