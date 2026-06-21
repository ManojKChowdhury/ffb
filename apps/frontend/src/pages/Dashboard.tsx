import React from 'react';
import { Link } from '@tanstack/react-router';
import { Trophy, Calendar, Eye, PlayCircle } from 'lucide-react';

export function Dashboard() {
  const activeEvents = [
    {
      id: 'wc2026',
      title: 'FIFA World Cup 2026',
      location: 'USA, Canada & Mexico',
      dates: 'June 11 – July 19, 2026',
      status: 'Active Event',
      teamsCount: 48,
      matchesToday: 3,
      imageBanner: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=600'
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1">
      {/* Welcome Banner */}
      <div className="glass-panel p-8 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden mb-10">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4">
            <Trophy size={12} />
            <span>Season 2026 Is Live</span>
          </span>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl text-white tracking-tight leading-tight">
            Fantasy Football <br />
            <span className="bg-gradient-to-r from-emerald-400 to-lime-400 bg-clip-text text-transparent">Championship League</span>
          </h1>
          <p className="mt-4 text-slate-400 text-base leading-relaxed">
            Test your football knowledge against other fans. Submit outcome predictions before kickoff, accumulate points, and dominate the ranking board.
          </p>
        </div>
      </div>

      {/* Tournaments List Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display font-extrabold text-2xl text-white">Active Tournaments</h2>
          <span className="text-sm font-medium text-slate-400">{activeEvents.length} tournament available</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {activeEvents.map((event) => (
            <div key={event.id} className="group glass-panel rounded-2xl border border-slate-800 hover:border-slate-700/80 transition duration-300 overflow-hidden flex flex-col relative shadow-lg">
              {/* Event Header Banner */}
              <div className="h-44 bg-slate-900 relative overflow-hidden">
                <img 
                  src={event.imageBanner} 
                  alt={event.title} 
                  className="w-full h-full object-cover opacity-35 group-hover:scale-105 transition duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
                <span className="absolute top-4 right-4 bg-emerald-500 text-slate-950 text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg shadow-emerald-500/20">
                  {event.status}
                </span>
                <div className="absolute bottom-4 left-4">
                  <h3 className="font-display font-extrabold text-2xl text-white">{event.title}</h3>
                  <p className="text-xs text-slate-300 flex items-center mt-1">
                    <Calendar size={12} className="mr-1 text-emerald-400" />
                    {event.dates}
                  </p>
                </div>
              </div>

              {/* Event Body Info */}
              <div className="p-6 flex-1 flex flex-col justify-between">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-900">
                    <span className="text-[10px] uppercase font-semibold text-slate-500 block">Host Region</span>
                    <span className="text-sm font-bold text-slate-300 mt-0.5 block">{event.location}</span>
                  </div>
                  <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-900">
                    <span className="text-[10px] uppercase font-semibold text-slate-500 block">Matches Scheduled Today</span>
                    <span className="text-sm font-bold text-emerald-400 mt-0.5 block">{event.matchesToday} fixtures</span>
                  </div>
                </div>

                {/* THE TWO-BUTTON REQUIREMENT */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Button 1: View Match Results */}
                  <Link
                    to="/matches/$eventId"
                    params={{ eventId: event.id }}
                    className="flex items-center justify-center space-x-2 px-4 py-3 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-sm transition"
                  >
                    <Eye size={16} />
                    <span>View Match Results</span>
                  </Link>

                  {/* Button 2: Go to Fantasy Game */}
                  <Link
                    to="/fantasy/$eventId"
                    params={{ eventId: event.id }}
                    className="flex items-center justify-center space-x-2 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20"
                  >
                    <PlayCircle size={16} />
                    <span>Go to Fantasy Game</span>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
