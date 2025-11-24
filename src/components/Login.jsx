import React, { useState } from 'react';
import { Lock, User } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { adminLogin } from '../services/api';

const appId = 'my-event-v1';

export const AdminLogin = ({ onLogin }) => {
    const [u, setU] = useState(''); const [p, setP] = useState('');
    const [loading, setLoading] = useState(false);
    const handleLogin = async () => {
        setLoading(true);
        try {
            await adminLogin(u, p); // Verify credentials with server
            // Pass credentials to parent - will be used for API calls
            onLogin({ role: 'admin', name: u, username: u, password: p });
        } catch (error) {
            alert(error.message || 'Login failed');
        }
        setLoading(false);
    };
    return (
        <div className="h-screen bg-slate-900 flex items-center justify-center">
            <div className="bg-white p-8 rounded-xl shadow-lg w-96">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-slate-800"><Lock size={24} /> Admin Login</h2>
                <input className="w-full mb-3 p-3 border border-slate-300 rounded text-slate-900" placeholder="Username" value={u} onChange={e => setU(e.target.value)} />
                <input className="w-full mb-6 p-3 border border-slate-300 rounded text-slate-900" type="password" placeholder="Password" value={p} onChange={e => setP(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleLogin()} />
                <button onClick={handleLogin} disabled={loading} className="w-full bg-slate-800 hover:bg-slate-700 text-white p-3 rounded font-bold transition">{loading ? 'Checking...' : 'Login'}</button>
            </div>
        </div>
    );
};

export const ModeratorLogin = ({ onLogin }) => {
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
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><User size={24} /> Moderator Login</h2>
                <input className="w-full mb-3 p-3 bg-gray-700 border border-gray-600 rounded text-white" placeholder="Customer Slug (e.g. google-io)" value={slug} onChange={e => setSlug(e.target.value)} />
                <input className="w-full mb-6 p-3 bg-gray-700 border border-gray-600 rounded text-white" type="password" placeholder="Password" value={pass} onChange={e => setPass(e.target.value)} />
                <button onClick={checkCreds} disabled={isLoading} className="w-full bg-pink-600 hover:bg-pink-500 text-white p-3 rounded font-bold transition">{isLoading ? 'Checking...' : 'Enter Deck'}</button>
            </div>
        </div>
    );
};
