import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { Link, useParams } from '@tanstack/react-router';

export function Results() {
  const { eventId } = useParams({ from: '/matches/$eventId' });
  const token = localStorage.getItem('token');

  // Fetch matches from Fastify backend
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['matches', eventId],
    queryFn: async () => {
      const res = await fetch(`http://localhost:3001/api/matches?eventId=${eventId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to load matches');
      return res.json();
    }
  });

  const matches = data?.matches || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 pb-5 border-b border-slate-800 gap-4">
        <div>
          <Link to="/" className="inline-flex items-center text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition mb-3">
            <ArrowLeft size={16} className="mr-1" />
            Back to Dashboard
          </Link>
          <h1 className="font-display font-extrabold text-3xl text-white tracking-tight">
            Match Scorelines & Results
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Historical and live updates for FIFA World Cup 2026 matches
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl text-sm font-semibold transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={14} className={isRefetching ? 'animate-spin' : ''} />
          <span>{isRefetching ? 'Refreshing...' : 'Refresh Scores'}</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="w-10 h-10 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-400 font-medium">Fetching match details...</p>
        </div>
      ) : isError ? (
        <div className="flex items-center space-x-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl max-w-lg mx-auto">
          <AlertCircle size={20} className="shrink-0" />
          <span className="text-sm font-medium">Failed to retrieve matches. Please check your backend connection.</span>
        </div>
      ) : matches.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          No matches found for this tournament.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {matches.map((match: any) => {
            const kickoffDate = new Date(match.kickoff_time);
            const formattedTime = kickoffDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const formattedDate = kickoffDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

            return (
              <div
                key={match.id}
                className="glass-panel p-6 rounded-2xl border border-slate-800 hover:border-slate-700/70 transition duration-300 flex flex-col justify-between"
              >
                {/* Match Card Header */}
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-900">
                  <span className="text-[11px] font-semibold text-slate-400 flex items-center">
                    <Calendar size={13} className="mr-1.5 text-emerald-400" />
                    {formattedDate} @ {formattedTime}
                  </span>
                  
                  {match.status === 'COMPLETED' ? (
                    <span className="bg-slate-950 text-slate-400 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-slate-800 uppercase tracking-wider">
                      Completed
                    </span>
                  ) : match.status === 'LIVE' ? (
                    <span className="bg-red-500/10 text-red-400 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-red-500/20 uppercase tracking-wider animate-pulse flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                      <span>Live</span>
                    </span>
                  ) : (
                    <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-wider">
                      Scheduled
                    </span>
                  )}
                </div>

                {/* Scoreboard Arena */}
                <div className="flex items-center justify-between py-4">
                  {/* Home Team */}
                  <div className="flex-1 text-center">
                    <div className="w-12 h-12 bg-slate-950 rounded-full border border-slate-800 flex items-center justify-center font-display font-black text-white text-base mx-auto shadow-md">
                      {match.home_team.substring(0, 3).toUpperCase()}
                    </div>
                    <span className="block text-sm font-bold text-slate-200 mt-2 truncate">{match.home_team}</span>
                  </div>

                  {/* Score */}
                  <div className="px-6 text-center">
                    {match.status !== 'SCHEDULED' ? (
                      <div className="flex items-center space-x-4">
                        <span className="font-display font-black text-3xl text-white">{match.home_score}</span>
                        <span className="text-slate-600 font-bold text-xl">:</span>
                        <span className="font-display font-black text-3xl text-white">{match.away_score}</span>
                      </div>
                    ) : (
                      <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-900 text-xs font-semibold text-slate-500">
                        VS
                      </div>
                    )}
                  </div>

                  {/* Away Team */}
                  <div className="flex-1 text-center">
                    <div className="w-12 h-12 bg-slate-950 rounded-full border border-slate-800 flex items-center justify-center font-display font-black text-white text-base mx-auto shadow-md">
                      {match.away_team.substring(0, 3).toUpperCase()}
                    </div>
                    <span className="block text-sm font-bold text-slate-200 mt-2 truncate">{match.away_team}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
