import React from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { Trophy, LogOut, LayoutDashboard, Coins } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '../config';

export function Navigation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = localStorage.getItem('token');

  // Fetch current user details dynamically (including live points tally)
  const { data } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      if (!token) return null;
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('token');
          navigate({ to: '/login' });
        }
        throw new Error('Failed to fetch user');
      }
      return res.json();
    },
    enabled: !!token
  });

  const handleLogout = () => {
    localStorage.removeItem('token');
    queryClient.clear();
    navigate({ to: '/login' });
  };

  if (!token) return null;

  const user = data?.user;

  return (
    <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center space-x-2 font-display font-extrabold text-xl tracking-tight text-white">
              <span className="bg-gradient-to-r from-emerald-400 to-lime-400 bg-clip-text text-transparent">CHAMPIONSHIP</span>
              <span className="text-slate-400 font-medium text-sm px-1.5 py-0.5 rounded border border-slate-800 bg-slate-950">FANTASY</span>
            </Link>
            <div className="hidden md:flex items-center space-x-4">
              <Link
                to="/"
                activeProps={{ className: 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' }}
                inactiveProps={{ className: 'text-slate-300 hover:text-white hover:bg-slate-800/50 border border-transparent' }}
                className="flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition"
              >
                <LayoutDashboard size={16} />
                <span>Dashboard</span>
              </Link>
              <Link
                to="/leaderboard"
                activeProps={{ className: 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' }}
                inactiveProps={{ className: 'text-slate-300 hover:text-white hover:bg-slate-800/50 border border-transparent' }}
                className="flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition"
              >
                <Trophy size={16} />
                <span>Leaderboard</span>
              </Link>
            </div>
          </div>

          <div className="flex items-center space-x-6">
            {user && (
              <div className="flex items-center space-x-3 bg-slate-950 px-4 py-1.5 rounded-full border border-slate-800">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 pulse-glow"></div>
                <span className="text-xs text-slate-400 font-medium hidden sm:inline">@{user.username}</span>
                <span className="text-slate-600 hidden sm:inline">|</span>
                <div className="flex items-center space-x-1.5">
                  <Trophy size={14} className="text-amber-400" />
                  <span className="text-sm font-extrabold text-white">{user.points ?? user.total_points ?? 0} pts</span>
                </div>
                <span className="text-slate-600">|</span>
                <div className="flex items-center space-x-1.5">
                  <Coins size={14} className="text-yellow-400" />
                  <span className="text-sm font-extrabold text-emerald-400">{user.wallet_balance ?? 1000} tokens</span>
                </div>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition border border-transparent hover:border-rose-500/20"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Log Out</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
