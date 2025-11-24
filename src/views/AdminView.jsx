import React, { useState, useEffect } from 'react';
import { query, collection, getDocs, where } from 'firebase/firestore';
import { Settings, MessageSquare, ImagePlus, HardDrive, BarChart3, FileJson } from 'lucide-react';
import { db } from '../firebase';
import { getAdminCustomers, createAdminCustomer, updateAdminCustomer, deleteAdminCustomer, getStorageStats } from '../services/api';

const appId = 'my-event-v1';

const createSlug = (name) => {
    if (!name) return '';
    return String(name).toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
};

const AdminView = ({ currentUser }) => {
    const [customers, setCustomers] = useState([]);
    const [newCustName, setNewCustName] = useState('');
    const [newCustPass, setNewCustPass] = useState('');
    const [newCustRole, setNewCustRole] = useState('customer');
    const [stats, setStats] = useState({});
    const [debugData, setDebugData] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadCustomers();
    }, []);

    const loadCustomers = async () => {
        try {
            setLoading(true);
            const data = await getAdminCustomers(currentUser.username, currentUser.password);
            setCustomers(data);
        } catch (error) {
            console.error('Error fetching customers:', error);
            alert('Failed to load customers. Please refresh and login again.');
        } finally {
            setLoading(false);
        }
    };

    const createCustomer = async () => {
        if (currentUser.role === 'admin-read') { alert("Read Only Access"); return; }
        if (!newCustName || !newCustPass) return;
        const id = createSlug(newCustName);
        if (!id) { alert("Invalid slug"); return; }

        try {
            await createAdminCustomer(currentUser.username, currentUser.password, {
                id,
                name: newCustName,
                password: newCustPass,
                role: newCustRole,
                disabled: false,
                settings: { imgTimer: 5, textTimer: 5, imgCount: 3, textCount: 5 },
                headerTitle: '',
                backgroundImage: null
            });
            setNewCustName('');
            setNewCustPass('');
            alert(`Created: ${newCustName}`);
            loadCustomers(); // Refresh list
        } catch (error) {
            alert(error.message || 'Failed to create customer');
        }
    };

    const toggleDisable = async (custId, currentStatus) => {
        if (currentUser.role === 'admin-read') { alert("Read Only Access"); return; }
        try {
            await updateAdminCustomer(currentUser.username, currentUser.password, custId, { disabled: !currentStatus });
            loadCustomers();
        } catch (error) {
            alert(error.message || 'Failed to update customer');
        }
    };

    const deleteCustomer = async (custId) => {
        if (currentUser.role === 'admin-read') { alert("Read Only Access"); return; }
        if (confirm('Are you sure you want to delete this customer? This cannot be undone.')) {
            try {
                await deleteAdminCustomer(currentUser.username, currentUser.password, custId);
                loadCustomers();
            } catch (error) {
                alert(error.message || 'Failed to delete customer');
            }
        }
    };

    const loadStats = async (custId) => {
        try {
            // 1. Get message count from Firestore (fast, real-time)
            const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'messages'), where('customerId', '==', custId));
            const snap = await getDocs(q);
            const msgCount = snap.size;

            // 2. Get S3 storage stats from Server API (accurate file size)
            // We need to pass auth credentials since the API might be protected or public
            // For now, the stats endpoint is public in server/index.js, but let's check
            const s3Stats = await getStorageStats(custId);

            setStats(prev => ({
                ...prev,
                [custId]: {
                    count: msgCount,
                    imgCount: s3Stats.fileCount,
                    sizeMB: s3Stats.sizeMB
                }
            }));
        } catch (error) {
            console.error("Failed to load stats:", error);
            alert("Failed to load storage stats");
        }
    };

    const inspectData = async (custId) => {
        if (debugData[custId]) { setDebugData(prev => { const n = { ...prev }; delete n[custId]; return n; }); return; }
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'messages'), where('customerId', '==', custId));
        const snap = await getDocs(q);
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
            .slice(0, 5);
        setDebugData(prev => ({ ...prev, [custId]: docs }));
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                    <div>Loading admin panel...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 p-8 font-sans text-white">
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
                            <div><label className="block text-sm font-bold mb-1 text-gray-500">Event Name</label><input type="text" value={newCustName} onChange={(e) => setNewCustName(e.target.value)} className="w-full p-2 bg-gray-900 border border-gray-600 rounded text-white" placeholder="e.g. Townhall" /></div>
                            <div><label className="block text-sm font-bold mb-1 text-gray-500">Password</label><input type="text" value={newCustPass} onChange={(e) => setNewCustPass(e.target.value)} className="w-full p-2 bg-gray-900 border border-gray-600 rounded text-white" placeholder="secret123" /></div>
                        </div>
                        <div className="flex gap-4 items-end">
                            <div className="w-48"><label className="block text-sm font-bold mb-1 text-gray-500">Role</label><select value={newCustRole} onChange={e => setNewCustRole(e.target.value)} className="w-full p-2 bg-gray-900 border border-gray-600 rounded text-white"><option value="customer">Customer (Event)</option><option value="admin">Admin (Full)</option><option value="admin-read">Admin (Read-Only)</option></select></div>
                            <button onClick={createCustomer} className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-500 shadow-md transition">Create</button>
                        </div>
                    </div>
                )}
                <div className="grid gap-4">
                    {customers.map(cust => (
                        <div key={cust.id} className={`p-6 rounded-xl shadow-sm flex flex-col border ${cust.disabled ? 'bg-red-900/20 border-red-800' : 'bg-gray-800 border-gray-700'}`}>
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
                                <div>
                                    <div className="font-bold text-xl text-white flex items-center gap-2">{String(cust.name)} {cust.disabled && <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded">DISABLED</span>}<span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded uppercase">{cust.role}</span></div>
                                    <div className="text-xs text-gray-500 mt-1 space-y-1"><div>ID: <span className="font-mono bg-gray-900 px-1 rounded text-gray-400">{String(cust.id)}</span></div><div>Pass: <span className="font-mono bg-gray-900 px-1 rounded text-gray-400">{String(cust.password)}</span></div>{cust.role === 'customer' && (<div className="flex gap-2 mt-2"><a href={`/${cust.id}`} target="_blank" className="text-blue-400 hover:underline">Attendee</a><span className="text-gray-600">|</span><a href={`/stage/${cust.id}`} target="_blank" className="text-blue-400 hover:underline">Stage</a><span className="text-gray-600">|</span><a href={`/recap/${cust.id}`} target="_blank" className="text-pink-400 hover:underline">Recap (Slideshow)</a><span className="text-gray-600">|</span><a href={`/moderator`} target="_blank" className="text-blue-400 hover:underline">Moderator Page</a></div>)}</div>
                                </div>
                                <div className="flex flex-col items-end gap-3 mt-4 md:mt-0">
                                    {cust.role === 'customer' && (
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-4 text-sm text-gray-400 bg-gray-900/50 p-2 rounded">
                                                {stats[cust.id] ? (<><div className="flex items-center gap-1"><MessageSquare size={14} /> {stats[cust.id].count}</div><div className="flex items-center gap-1"><ImagePlus size={14} /> {stats[cust.id].imgCount}</div><div className="flex items-center gap-1"><HardDrive size={14} /> {stats[cust.id].sizeMB} MB</div></>) : (<button onClick={() => loadStats(cust.id)} className="text-xs text-blue-400 hover:underline flex items-center gap-1"><BarChart3 size={14} /> Stats</button>)}
                                            </div>
                                            <button onClick={() => inspectData(cust.id)} className={`text-xs px-3 py-2 rounded border flex items-center gap-1 transition ${debugData[cust.id] ? 'bg-pink-600 text-white border-pink-500' : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'}`}><FileJson size={14} /> {debugData[cust.id] ? 'Close' : 'Data'}</button>
                                        </div>
                                    )}
                                    {currentUser.role !== 'admin-read' && (<div className="flex gap-3"><button onClick={() => toggleDisable(cust.id, cust.disabled)} className={`px-4 py-2 text-sm border rounded font-medium ${cust.disabled ? 'bg-green-900/30 text-green-400 border-green-800' : 'bg-yellow-900/30 text-yellow-500 border-yellow-800'}`}>{cust.disabled ? 'Enable' : 'Disable'}</button><button onClick={() => deleteCustomer(cust.id)} className="px-4 py-2 text-sm bg-red-600/20 text-red-400 border border-red-900/50 rounded hover:bg-red-600/40 font-medium shadow-sm">Delete</button></div>)}
                                </div>
                            </div>
                            {debugData[cust.id] && (
                                <div className="mt-4 bg-black p-4 rounded text-xs font-mono text-green-400 overflow-x-auto border border-gray-700">
                                    <div className="mb-2 font-bold text-gray-500 uppercase">Latest 5 Database Entries:</div>
                                    {debugData[cust.id].length === 0 ? <div className="text-gray-500 italic">No messages found.</div> : (
                                        <table className="w-full text-left border-collapse">
                                            <thead><tr className="border-b border-gray-800 text-gray-500"><th className="p-1">Type</th><th className="p-1">Status</th><th className="p-1">AI?</th><th className="p-1">Content Preview</th></tr></thead>
                                            <tbody>
                                                {debugData[cust.id].map(msg => (
                                                    <tr key={msg.id} className="border-b border-gray-900 hover:bg-gray-900">
                                                        <td className="p-1 text-pink-400">{msg.type}</td>
                                                        <td className={`p-1 ${msg.status === 'approved' ? 'text-green-500' : 'text-yellow-500'}`}>{msg.status}</td>
                                                        <td className="p-1">{msg.aiEnhanced ? 'YES' : '-'}</td>
                                                        <td className="p-1 text-gray-300 truncate max-w-[200px]" title={JSON.stringify(msg)}>{msg.text || (msg.image ? '[Image Data]' : '[Empty]')}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AdminView;
