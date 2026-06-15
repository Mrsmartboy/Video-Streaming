import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, apiFetch } from '../context/AuthContext';
import { API_AUTH_REGISTER } from '../constants/apiUrlConstants';
import { BookOpen, AlertCircle, Loader } from 'lucide-react';

export const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'STUDENT' | 'INSTRUCTOR'>('STUDENT');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await apiFetch(API_AUTH_REGISTER, {
        method: 'POST',
        body: JSON.stringify({ name, email, password, role }),
      });
      login(data.token, data.user);
      
      if (data.user.role === 'INSTRUCTOR') {
        navigate('/instructor-dashboard');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-radial from-zinc-900 to-zinc-950 p-4">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f1f23_1px,transparent_1px),linear-gradient(to_bottom,#1f1f23_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />
      
      <div className="w-full max-w-md glass-panel rounded-2xl p-8 shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-6">
          <div className="p-3 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-xl shadow-lg mb-3">
            <BookOpen className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Get Started</h1>
          <p className="text-zinc-400 text-sm mt-1">Create your learning account</p>
        </div>

        {error && (
          <div className="mb-5 p-4 bg-red-950/40 border border-red-800/60 rounded-xl flex items-start gap-3 text-red-200 text-xs">
            <AlertCircle className="shrink-0 text-red-400" size={16} />
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-zinc-300 text-xs font-semibold uppercase tracking-wider mb-2">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
              placeholder="John Doe"
              required
            />
          </div>

          <div>
            <label className="block text-zinc-300 text-xs font-semibold uppercase tracking-wider mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-zinc-300 text-xs font-semibold uppercase tracking-wider mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
              placeholder="••••••••"
              required
            />
          </div>

          <div>
            <label className="block text-zinc-300 text-xs font-semibold uppercase tracking-wider mb-2">Join As</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('STUDENT')}
                className={`py-2 px-4 rounded-xl border text-xs font-semibold tracking-wide cursor-pointer transition ${
                  role === 'STUDENT'
                    ? 'bg-violet-600/20 border-violet-500 text-violet-400'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                STUDENT
              </button>
              <button
                type="button"
                onClick={() => setRole('INSTRUCTOR')}
                className={`py-2 px-4 rounded-xl border text-xs font-semibold tracking-wide cursor-pointer transition ${
                  role === 'INSTRUCTOR'
                    ? 'bg-violet-600/20 border-violet-500 text-violet-400'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                INSTRUCTOR
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl transition shadow-lg shadow-violet-900/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader className="animate-spin" size={18} />
                Creating account...
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-zinc-400">
          Already have an account?{' '}
          <Link to="/login" className="text-violet-400 hover:underline hover:text-violet-300 font-medium">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};
