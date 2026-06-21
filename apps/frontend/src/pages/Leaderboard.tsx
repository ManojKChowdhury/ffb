import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Award, Medal, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import { Link } from '@tanstack/react-router';

export function Leaderboard() {
  const token = localStorage.getItem('token');

  // Query users sorted by points DESC
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3001/api/leaderboard', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to load leaderboard rankings');
      return res.json();
    }
  });

  const rankings = data?.leaderboard || [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-5 border-b border-slate-800">
        <div>
          <Link to="/" className="inline-flex items-center text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition mb-3">
            <ArrowLeft size={16} className="mr-1" />
            Back to Dashboard
          </Link>
          <h1 className="font-display font-extrabold text-3xl text-white tracking-tight">
            Leaderboard Standings
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Global rankings of predict league participants based on correct predictions
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl text-sm font-semibold transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={14} className={isRefetching ? 'animate-spin' : ''} />
          <span>{isRefetching ? 'Refresh' : 'Sync'}</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="w-10 h-10 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-400 font-medium">Analyzing points tally...</p>
        </div>
      ) : isError ? (
        <div className="flex items-center space-x-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl">
          <AlertCircle size={20} className="shrink-0" />
          <span className="text-sm font-medium">Failed to retrieve rankings. Verify database and backend server status.</span>
        </div>
      ) : rankings.length === 0 ? (
        <div className="glass-panel p-10 text-center rounded-2xl border border-slate-800 text-slate-400 font-medium">
          No users registered yet. Standings will build once users submit predictions.
        </div>
      ) : (
        <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-semibold text-xs tracking-wider uppercase">
                  <th className="py-4 px-6 text-center w-20">Rank</th>
                  <th className="py-4 px-6">Contestant</th>
                  <th className="py-4 px-6 text-right w-36">Total Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {rankings.map((user: any, index: number) => {
                  const rank = index + 1;
                  
                  // Render custom rank symbols for top 3
                  let rankRender;
                  if (rank === 1) {
                    rankRender = (
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        <Trophy size={16} />
                      </span>
                    );
                  } else if (rank === 2) {
                    rankRender = (
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-300/10 text-slate-300 border border-slate-300/30">
                        <Award size={16} />
                      </span>
                    );
                  } else if (rank === 3) {
                    rankRender = (
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-700/15 text-amber-600 border border-amber-700/30">
                        <Medal size={16} />
                      </span>
                    );
                  } else {
                    rankRender = <span className="text-sm font-bold text-slate-500">{rank}</span>;
                  }

                  return (
                    <tr
                      key={user.username}
                      className={`hover:bg-slate-900/30 transition-colors ${
                        rank <= 3 ? 'bg-slate-950/20' : ''
                      }`}
                    >
                      <td className="py-4 px-6 text-center">{rankRender}</td>
                      <td className="py-4 px-6">
                        <span className="font-bold text-slate-100 block text-sm">@{user.username}</span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <span className="font-display font-extrabold text-base text-emerald-400">
                          {user.total_points} pt{user.total_points !== 1 ? 's' : ''}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
