import React, { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trophy, ShieldAlert, Lock, User } from 'lucide-react';
import { LoginSchema } from '@fantasy/shared';

export function Login() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: async () => {
      // Validate locally first using Zod schema
      const parseResult = LoginSchema.safeParse({ username, password });
      if (!parseResult.success) {
        throw new Error(parseResult.error.errors[0].message);
      }

      const res = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Invalid username or password');
      }

      return data;
    },
    onSuccess: (data) => {
      localStorage.setItem('token', data.token);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      navigate({ to: '/' });
    },
    onError: (err: Error) => {
      setValidationError(err.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    loginMutation.mutate();
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 glass-panel p-8 rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden">
        {/* Background glow decoration */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl"></div>

        <div className="text-center relative">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4">
            <Trophy size={28} />
          </div>
          <h2 className="font-display font-extrabold text-3xl text-white tracking-tight">
            Welcome Back
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Sign in to check live results and manage predictions
          </p>
        </div>

        <form className="mt-8 space-y-6 relative" onSubmit={handleSubmit}>
          {validationError && (
            <div className="flex items-center space-x-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-lg text-sm">
              <ShieldAlert size={16} className="shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Username
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <User size={18} />
                </span>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm transition"
                  placeholder="e.g. striker99"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <Lock size={18} />
                </span>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm transition"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl text-sm font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-lime-400 hover:from-emerald-300 hover:to-lime-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/10"
            >
              {loginMutation.isPending ? 'Logging In...' : 'Access Dashboard'}
            </button>
          </div>
        </form>

        <div className="text-center relative">
          <p className="text-sm text-slate-400">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-emerald-400 hover:text-emerald-300 transition">
              Create Profile
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
