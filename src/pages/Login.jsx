// src/pages/Login.jsx
// Single "Sign in with Microsoft" button. Redirects to / on successful auth.

import { useState } from 'react';
import { signInWithMicrosoft } from '../lib/auth';

export default function Login() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithMicrosoft();
    } catch (e) {
      setError(e.message || 'Sign-in failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-50">
      <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full">
        <h1 className="text-2xl font-semibold text-navy-900 mb-2">Listing Portal</h1>
        <p className="text-sm text-slate-600 mb-6">Sign in with your Blac Property Group Microsoft account.</p>
        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full bg-navy-900 text-cream-100 py-2 rounded font-medium hover:bg-navy-800 disabled:opacity-50"
        >
          {loading ? 'Redirecting...' : 'Sign in with Microsoft'}
        </button>
        {error && (
          <p className="mt-4 text-sm text-red-600">{error}</p>
        )}
      </div>
    </div>
  );
}
