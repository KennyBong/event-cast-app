import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { auth } from './firebase';
import AttendeeView from './views/AttendeeView';
import StageView from './views/StageView';
import ModeratorView from './views/ModeratorView';
import AdminView from './views/AdminView';
import { AdminLogin, ModeratorLogin } from './components/Login';

const StageSetup = ({ onLaunch }) => {
  const [slug, setSlug] = useState('');
  return (
    <div className="h-screen bg-black flex items-center justify-center text-white">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Stage Display</h1>
        <input
          className="bg-gray-800 border border-gray-700 p-3 rounded text-white mb-4 w-64 text-center"
          placeholder="Enter Event Slug"
          value={slug}
          onChange={e => setSlug(e.target.value)}
        />
        <button
          onClick={() => onLaunch(slug)}
          className="block w-full bg-pink-600 hover:bg-pink-500 py-3 rounded font-bold"
        >
          Launch Stage
        </button>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [route, setRoute] = useState({ view: 'loading', data: null });
  const [session, setSession] = useState(null);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth Error:", err);
        setAuthError(err.message);
      }
    };
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

  if (authError) return (
    <div className="h-screen flex flex-col items-center justify-center text-red-500 p-8 text-center">
      <h2 className="text-2xl font-bold mb-4">Connection Failed</h2>
      <p className="mb-4">Could not connect to the event server.</p>
      <div className="bg-gray-900 text-gray-300 p-4 rounded text-left font-mono text-xs max-w-lg overflow-auto">
        {authError}
      </div>
      <p className="mt-4 text-gray-600 text-sm">Please check your internet connection or contact the organizer.</p>
    </div>
  );

  if (!user) return <div className="h-screen flex items-center justify-center text-gray-500 animate-pulse">Connecting...</div>;

  if (route.view === 'admin-login') {
    if (session && (session.role === 'admin' || session.role === 'admin-read')) return <AdminView currentUser={session} />;
    return <AdminLogin onLogin={(user) => setSession(user)} />;
  }
  if (route.view === 'mod-login') {
    if (session?.role === 'mod') return <ModeratorView customerId={session.slug} customerData={{ name: session.slug }} />;
    return <ModeratorLogin onLogin={(slug) => setSession({ role: 'mod', slug })} />;
  }
  if (route.view === 'stage-setup') return <StageSetup onLaunch={(slug) => window.location.href = `/stage/${slug}`} />;
  if (route.view === 'stage') return <StageView customerId={route.data} />;
  if (route.view === 'attendee') return <AttendeeView customerId={route.data} user={user} />;

  return <div>404 Not Found</div>;
}