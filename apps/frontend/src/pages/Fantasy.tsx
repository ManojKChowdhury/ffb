import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Lock, Play, Trophy, CheckCircle2, RotateCcw, ArrowLeft, Clock, Coins, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { Link, useParams } from '@tanstack/react-router';
import { API_URL } from '../config';

export function Fantasy() {
  const { eventId } = useParams({ from: '/fantasy/$eventId' });
  const token = localStorage.getItem('token');
  const queryClient = useQueryClient();
  const enableSimulation = import.meta.env.VITE_ENABLE_SIMULATION === 'true';

  // Score states for each match resolve simulator
  const [resolveScores, setResolveScores] = useState<Record<string, { home: number; away: number }>>({});

  // Local score prediction states that are not yet committed to backend
  const [localPredictions, setLocalPredictions] = useState<Record<string, { home: string; away: string }>>({});
  
  // Local bet stake amount inputs
  const [localBets, setLocalBets] = useState<Record<string, string>>({});

  // Validation errors (per match) for uncommitted inputs
  const [validationErrors, setValidationErrors] = useState<Record<string, { homeScore?: boolean; awayScore?: boolean; stake?: boolean }>>({});

  // Fetch user details for wallet balance check
  const { data: userData } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      if (!token) return null;
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load user profile');
      return res.json();
    },
    enabled: !!token
  });
  const user = userData?.user;

  // 1. Fetch matches
  const { data: matchesData, isLoading: matchesLoading } = useQuery({
    queryKey: ['matches', eventId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/matches?eventId=${eventId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load matches');
      return res.json();
    },
    refetchInterval: 5000 // Poll every 5 seconds for real-time status updates
  });

  // 2. Fetch current user predictions
  const { data: predictionsData } = useQuery({
    queryKey: ['my-predictions'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/predictions/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load predictions');
      return res.json();
    }
  });

  const matches = matchesData?.matches || [];
  const predictions = predictionsData?.predictions || [];

  const [showCompleted, setShowCompleted] = React.useState(false);

  // Group matches helper
  const groupMatchesByDate = (matchList: any[]) => {
    const groups: { dateStr: string; items: any[] }[] = [];
    matchList.forEach((match: any) => {
      const kickoffDate = new Date(match.kickoff_time);
      const dateStr = kickoffDate.toLocaleDateString([], {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
      let group = groups.find(g => g.dateStr === dateStr);
      if (!group) {
        group = { dateStr, items: [] };
        groups.push(group);
      }
      group.items.push(match);
    });
    return groups;
  };

  const [teamFilter, setTeamFilter] = useState('');

  // Filter matches based on search term
  const filteredMatches = React.useMemo(() => {
    if (!teamFilter.trim()) return matches;
    const term = teamFilter.toLowerCase();
    return matches.filter((m: any) =>
      m.home_team.toLowerCase().includes(term) ||
      m.away_team.toLowerCase().includes(term)
    );
  }, [matches, teamFilter]);

  const activeMatches = filteredMatches.filter((m: any) => m.status !== 'COMPLETED');
  const completedMatches = filteredMatches.filter((m: any) => m.status === 'COMPLETED');

  const activeGroups = groupMatchesByDate(activeMatches);
  const completedGroups = groupMatchesByDate(completedMatches);

  // Build predictions map: matchId -> outcome and betAmount
  const predictionsMap = React.useMemo(() => {
    const map: Record<string, { outcome: 'HOME_WIN' | 'DRAW' | 'AWAY_WIN'; betAmount: number; homeScore: number; awayScore: number; isProcessed: boolean }> = {};
    predictions.forEach((pred: any) => {
      if (pred.predicted_home_score !== undefined && pred.predicted_away_score !== undefined) {
        let outcome: 'HOME_WIN' | 'DRAW' | 'AWAY_WIN' = 'DRAW';
        if (pred.predicted_home_score > pred.predicted_away_score) {
          outcome = 'HOME_WIN';
        } else if (pred.predicted_home_score < pred.predicted_away_score) {
          outcome = 'AWAY_WIN';
        }
        map[pred.match_id] = {
          outcome,
          betAmount: pred.bet_amount || 0,
          homeScore: pred.predicted_home_score,
          awayScore: pred.predicted_away_score,
          isProcessed: pred.is_processed
        };
      }
    });
    return map;
  }, [predictions]);

  // Mutation to submit prediction with bet stake
  const submitPredictionMutation = useMutation({
    mutationFn: async (payload: { matchId: string; predictedHomeScore: number; predictedAwayScore: number; betAmount: number }) => {
      const res = await fetch(`${API_URL}/api/predictions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit bet prediction');
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-predictions'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (err: Error) => {
      alert(err.message);
    }
  });

  // Simulation Mutation: Kickoff
  const simulateKickoffMutation = useMutation({
    mutationFn: async (matchId: string) => {
      const res = await fetch(`${API_URL}/api/simulation/kickoff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ matchId })
      });
      if (!res.ok) throw new Error('Kickoff simulation failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches', eventId] });
    }
  });

  // Simulation Mutation: Resolve
  const simulateResolveMutation = useMutation({
    mutationFn: async (payload: { matchId: string; homeScore: number; awayScore: number }) => {
      const res = await fetch(`${API_URL}/api/simulation/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Scoring simulation failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches', eventId] });
      queryClient.invalidateQueries({ queryKey: ['my-predictions'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    }
  });

  // Simulation Mutation: Reset
  const simulateResetMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/api/simulation/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Reset failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches', eventId] });
      queryClient.invalidateQueries({ queryKey: ['my-predictions'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      setResolveScores({});
      alert('Data reset to defaults successfully.');
    }
  });

  const getPredictedScores = (matchId: string) => {
    if (localPredictions[matchId] !== undefined) {
      return localPredictions[matchId];
    }
    const saved = predictionsMap[matchId];
    if (saved) {
      return { home: String(saved.homeScore), away: String(saved.awayScore) };
    }
    return { home: '', away: '' };
  };

  const getPredictedBet = (matchId: string) => {
    if (localBets[matchId] !== undefined) {
      return localBets[matchId];
    }
    const saved = predictionsMap[matchId];
    return saved?.betAmount ? String(saved.betAmount) : '';
  };

  const handleLocalPredictionChange = (matchId: string, team: 'home' | 'away', value: string) => {
    if (value !== '' && !/^\d+$/.test(value)) return;
    const current = getPredictedScores(matchId);
    setLocalPredictions(prev => ({
      ...prev,
      [matchId]: {
        ...current,
        [team]: value
      }
    }));

    // Clear validation error when user types a value
    if (value !== '') {
      setValidationErrors(prev => {
        const matchErrors = prev[matchId];
        if (!matchErrors) return prev;
        const nextErrors = { ...matchErrors };
        if (team === 'home') delete nextErrors.homeScore;
        if (team === 'away') delete nextErrors.awayScore;
        return { ...prev, [matchId]: nextErrors };
      });
    }
  };

  const handleBetChange = (matchId: string, value: string) => {
    if (value !== '' && !/^\d+$/.test(value)) return;
    setLocalBets(prev => ({ ...prev, [matchId]: value }));

    // Clear validation error when user types a value
    if (value !== '') {
      setValidationErrors(prev => {
        const matchErrors = prev[matchId];
        if (!matchErrors) return prev;
        const nextErrors = { ...matchErrors };
        delete nextErrors.stake;
        return { ...prev, [matchId]: nextErrors };
      });
    }
  };

  const isPredictionChanged = (matchId: string) => {
    const local = localPredictions[matchId];
    const localBet = localBets[matchId];
    const saved = predictionsMap[matchId];
    
    if (!saved) {
      const hasLocalScores = local !== undefined && (local.home !== '' || local.away !== '');
      const hasLocalBet = localBet !== undefined && localBet !== '';
      return hasLocalScores || hasLocalBet;
    }
    
    const scoresChanged = local !== undefined && (local.home !== String(saved.homeScore) || local.away !== String(saved.awayScore));
    const betChanged = localBet !== undefined && Number(localBet) !== saved.betAmount;
    
    return scoresChanged || betChanged;
  };

  const handlePredict = (matchId: string) => {
    const scores = getPredictedScores(matchId);
    const betStr = getPredictedBet(matchId);
    
    const errors: { homeScore?: boolean; awayScore?: boolean; stake?: boolean } = {};
    if (scores.home === '') errors.homeScore = true;
    if (scores.away === '') errors.awayScore = true;
    if (betStr === '') errors.stake = true;

    if (Object.keys(errors).length > 0) {
      setValidationErrors(prev => ({
        ...prev,
        [matchId]: errors
      }));
      return;
    }
    
    const homeScore = parseInt(scores.home, 10);
    const awayScore = parseInt(scores.away, 10);
    const betAmount = parseInt(betStr, 10);
    if (isNaN(betAmount) || betAmount <= 0) {
      alert('Bet amount must be a positive integer.');
      return;
    }

    const saved = predictionsMap[matchId];
    const savedBetAmount = saved?.betAmount || 0;
    const currentBalance = user?.wallet_balance || 0;
    const affordableBalance = currentBalance + savedBetAmount;

    if (betAmount > affordableBalance) {
      alert(`Insufficient wallet balance. You can stake up to ${affordableBalance} tokens (including refund from previous bet).`);
      return;
    }

    submitPredictionMutation.mutate({
      matchId,
      predictedHomeScore: homeScore,
      predictedAwayScore: awayScore,
      betAmount
    });
  };

  const handleResolveSubmit = (e: React.FormEvent, matchId: string) => {
    e.preventDefault();
    const scores = resolveScores[matchId] || { home: 0, away: 0 };
    simulateResolveMutation.mutate({
      matchId,
      homeScore: scores.home,
      awayScore: scores.away
    });
  };

  const renderPredictCard = (match: any) => {
    const kickoffDate = new Date(match.kickoff_time);
    const isLocked = new Date() >= kickoffDate || match.status !== 'SCHEDULED';

    return (
      <div
        key={match.id}
        className={`glass-panel p-6 rounded-2xl border transition duration-300 relative ${
          isLocked ? 'border-slate-800/80 bg-slate-950/20' : 'border-slate-800 hover:border-slate-700/60'
        }`}
      >
        {/* Locked Banner Overlay */}
        {isLocked && (
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[0.5px] rounded-2xl flex items-center justify-center opacity-0 hover:opacity-100 transition duration-300 pointer-events-none">
            <div className="bg-slate-900 border border-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-lg">
              <Lock size={12} className="text-rose-400" />
              <span>Predictions Locked</span>
            </div>
          </div>
        )}

        {/* Match Fixture Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-900">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center">
            <Clock size={13} className="mr-1.5 text-emerald-400" />
            {kickoffDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>

          {/* Lock status Badge */}
          {isLocked ? (
            <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center space-x-1">
              <Lock size={10} />
              <span>Locked</span>
            </span>
          ) : (
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
              Open For Predictions
            </span>
          )}
        </div>

        {/* Arena Grid */}
        <div className="grid grid-cols-3 items-center py-4 mb-4">
          {/* Home */}
          <div className="text-center font-bold text-slate-200">
            <span>{match.home_team}</span>
          </div>
          
          {/* Score or VS */}
          <div className="text-center">
            {match.status !== 'SCHEDULED' ? (
              <span className="font-display font-black text-2xl text-white">
                {match.home_score} - {match.away_score}
              </span>
            ) : (
              <span className="text-slate-600 font-bold text-xs bg-slate-950 px-2.5 py-1 rounded border border-slate-900">VS</span>
            )}
            {match.status === 'COMPLETED' && (
              <span className="block text-[10px] text-slate-500 font-semibold uppercase mt-1">Full Time</span>
            )}
            {match.status === 'LIVE' && (
              <span className="block text-[10px] text-rose-400 font-semibold uppercase mt-1 animate-pulse">Live</span>
            )}
          </div>

          {/* Away */}
          <div className="text-center font-bold text-slate-200">
            <span>{match.away_team}</span>
          </div>
        </div>

        {/* Predictions Choice Group */}
        <div className="mt-4 pt-4 border-t border-slate-900">
          <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 text-center">
            Your Prediction
          </span>

          {isLocked ? (
            <div className="flex flex-col items-center space-y-2 max-w-sm mx-auto">
              <div className="flex justify-center items-center gap-4 bg-slate-950/50 py-3 px-4 rounded-xl border border-slate-900/60 w-full shadow-inner">
                <span className="text-xs font-semibold text-slate-400 truncate max-w-[120px] text-right flex-1">{match.home_team}</span>
                <span className="font-display font-extrabold text-xs px-3 py-1 bg-slate-900 rounded border border-slate-800 text-emerald-400">
                  {predictionsMap[match.id] ? (
                    predictionsMap[match.id].outcome === 'HOME_WIN' ? 'Home Win' :
                    predictionsMap[match.id].outcome === 'AWAY_WIN' ? 'Away Win' : 'Draw'
                  ) : 'No bet placed'}
                </span>
                <span className="text-xs font-semibold text-slate-400 truncate max-w-[120px] text-left flex-1">{match.away_team}</span>
              </div>
              {predictionsMap[match.id] && (
                <div className="text-[10px] text-slate-500 font-bold flex items-center space-x-1">
                  <Coins size={10} className="text-yellow-500/60" />
                  <span>Staked: {predictionsMap[match.id].betAmount} tokens</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4 max-w-lg mx-auto bg-slate-950/30 p-4 rounded-2xl border border-slate-900">
              {/* 1. Score Prediction Inputs */}
              <div className="flex items-center justify-center gap-4">
                <div className="flex items-center gap-2 bg-slate-950/60 p-2 rounded-xl border border-slate-800/80 shadow-md w-full justify-center">
                  {/* Home score input */}
                  <div className="flex items-center gap-2 px-2">
                    <span className="text-xs font-bold text-slate-300 truncate max-w-[90px]">{match.home_team}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={getPredictedScores(match.id).home}
                      onChange={(e) => handleLocalPredictionChange(match.id, 'home', e.target.value)}
                      placeholder="0"
                      className={`w-12 h-9 bg-slate-900 rounded-lg text-white font-extrabold text-center text-sm outline-none transition ${
                        validationErrors[match.id]?.homeScore
                          ? 'border border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                          : 'border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                      }`}
                    />
                  </div>
                  
                  <span className="text-slate-600 font-bold text-sm">:</span>

                  {/* Away score input */}
                  <div className="flex items-center gap-2 px-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={getPredictedScores(match.id).away}
                      onChange={(e) => handleLocalPredictionChange(match.id, 'away', e.target.value)}
                      placeholder="0"
                      className={`w-12 h-9 bg-slate-900 rounded-lg text-white font-extrabold text-center text-sm outline-none transition ${
                        validationErrors[match.id]?.awayScore
                          ? 'border border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                          : 'border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                      }`}
                    />
                    <span className="text-xs font-bold text-slate-300 truncate max-w-[90px]">{match.away_team}</span>
                  </div>
                </div>
              </div>

              {/* 2. Stake Input & Submit */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className={`flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-xl w-full sm:w-auto transition ${
                  validationErrors[match.id]?.stake
                    ? 'border border-rose-500'
                    : 'border border-slate-800'
                }`}>
                  <Coins size={14} className="text-yellow-500" />
                  <span className="text-[10px] text-slate-500 font-extrabold uppercase">Stake</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={getPredictedBet(match.id)}
                    onChange={(e) => handleBetChange(match.id, e.target.value)}
                    placeholder="Amount"
                    className="w-20 bg-transparent border-none text-white font-extrabold text-sm outline-none focus:ring-0 text-center"
                  />
                </div>

                {/* Submit Bet Button */}
                {(() => {
                  const scores = getPredictedScores(match.id);
                  const betStr = getPredictedBet(match.id);
                  const betVal = parseInt(betStr, 10) || 0;
                  const saved = predictionsMap[match.id];
                  const savedBetAmount = saved?.betAmount || 0;
                  const currentBalance = user?.wallet_balance || 0;
                  const affordable = currentBalance + savedBetAmount;
                  
                  const isAffordable = betVal <= affordable;
                  const isChanged = isPredictionChanged(match.id);
                  const isPending = submitPredictionMutation.isPending;

                  const isSubmitDisabled = isPending || !isAffordable || (!isChanged && !!saved);

                  return (
                    <button
                      onClick={() => handlePredict(match.id)}
                      disabled={isSubmitDisabled}
                      className={`w-full sm:w-auto px-5 py-2 rounded-xl font-extrabold text-xs transition cursor-pointer shadow-lg flex items-center justify-center space-x-1.5 flex-1 ${
                        !isAffordable
                          ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400 cursor-not-allowed'
                          : (isChanged || !saved)
                          ? 'bg-emerald-500 hover:bg-emerald-400 border border-emerald-400 text-slate-950 hover:text-black shadow-emerald-500/10'
                          : 'bg-slate-900 border border-emerald-500/30 text-emerald-400 hover:bg-slate-800'
                      }`}
                    >
                      {!isAffordable ? (
                        <span>Insufficient Tokens</span>
                      ) : isChanged ? (
                        <span>Place Bet</span>
                      ) : saved ? (
                        <>
                          <CheckCircle2 size={13} className="text-emerald-400" />
                          <span>Bet Placed ({saved.betAmount} tokens)</span>
                        </>
                      ) : (
                        <span>Place Bet</span>
                      )}
                    </button>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const updateScoreState = (matchId: string, team: 'home' | 'away', val: number) => {
    setResolveScores(prev => ({
      ...prev,
      [matchId]: {
        ...(prev[matchId] || { home: 0, away: 0 }),
        [team]: val
      }
    }));
  };

  return (
    <div className={`w-[70vw] mx-auto py-10 flex-1`}>
      {/* Back Link */}
      <Link to="/" className="inline-flex items-center text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition mb-6">
        <ArrowLeft size={16} className="mr-1" />
        Back to Dashboard
      </Link>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Left Column: Matches Prediction List */}
        <div className="flex-1 space-y-6">
          <div>
            <h1 className="font-display font-extrabold text-3xl text-white tracking-tight">
              Matchday Predictions
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Submit your predictions before kickoff locks down. Earn 1 point for each correct prediction.
            </p>
          </div>

          {/* Team Filter Search Input */}
          {!matchesLoading && matches.length > 0 && (
            <div className="flex items-center bg-slate-950/60 border border-slate-800 px-4 py-2 rounded-xl focus-within:border-emerald-500/50 transition mb-6">
              <Search size={16} className="text-slate-400 mr-2" />
              <input
                type="text"
                placeholder="Filter matches by team name..."
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="bg-transparent border-none text-white text-sm outline-none w-full focus:ring-0"
              />
            </div>
          )}

          {matchesLoading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-10 h-10 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-slate-400 font-medium">Loading match fixtures...</p>
            </div>
          ) : matches.length === 0 ? (
            <div className="glass-panel p-8 text-center rounded-2xl text-slate-400 border border-slate-900">
              No active match fixtures today.
            </div>
          ) : filteredMatches.length === 0 ? (
            <div className="glass-panel p-8 text-center rounded-2xl text-slate-400 border border-slate-900">
              No matches found matching "{teamFilter}".
            </div>
          ) : (
            <div className="space-y-10">
              {activeGroups.length > 0 ? (
                <div className="space-y-10">
                  {activeGroups.map((group) => (
                    <div key={group.dateStr} className="space-y-4">
                      <div className="flex items-center space-x-3 border-b border-slate-800 pb-2">
                        <Calendar size={18} className="text-emerald-400" />
                        <h2 className="font-display font-bold text-lg text-slate-200 tracking-tight">
                          {group.dateStr}
                        </h2>
                        <span className="text-xs bg-slate-900 text-slate-400 px-2.5 py-0.5 rounded-full border border-slate-800 font-medium">
                          {group.items.length} {group.items.length === 1 ? 'fixture' : 'fixtures'}
                        </span>
                      </div>

                      <div className="space-y-6">
                        {group.items.map((match: any) => renderPredictCard(match))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  No active or upcoming fixtures today.
                </div>
              )}

              {/* Collapsible Completed Matches */}
              {completedGroups.length > 0 && (
                <div className="pt-6 border-t border-slate-900">
                  <button
                    onClick={() => setShowCompleted(!showCompleted)}
                    className="w-full flex items-center justify-between p-4 bg-slate-900/50 hover:bg-slate-900 border border-slate-800/80 rounded-2xl transition duration-200 cursor-pointer text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-slate-400">
                        {showCompleted ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      </span>
                      <span className="font-display font-bold text-base text-slate-200">
                        Completed Matches
                      </span>
                      <span className="text-xs bg-slate-950 text-slate-400 px-2.5 py-0.5 rounded-full border border-slate-800 font-medium">
                        {completedMatches.length} {completedMatches.length === 1 ? 'match' : 'matches'}
                      </span>
                    </div>
                  </button>

                  {showCompleted && (
                    <div className="mt-8 space-y-10">
                      {completedGroups.map((group) => (
                        <div key={group.dateStr} className="space-y-4">
                          <div className="flex items-center space-x-3 border-b border-slate-800 pb-2">
                            <Calendar size={18} className="text-slate-400" />
                            <h2 className="font-display font-bold text-lg text-slate-300 tracking-tight">
                              {group.dateStr}
                            </h2>
                            <span className="text-xs bg-slate-900 text-slate-400 px-2.5 py-0.5 rounded-full border border-slate-800 font-medium">
                              {group.items.length} {group.items.length === 1 ? 'fixture' : 'fixtures'}
                            </span>
                          </div>

                          <div className="space-y-6">
                            {group.items.map((match: any) => renderPredictCard(match))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Simulation Controller (Sandbox Panel) */}
        {enableSimulation && (
          <div className="w-full lg:w-96 space-y-6 shrink-0">
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 relative overflow-hidden shadow-xl">
              <div className="absolute -top-12 -right-12 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl"></div>
              
              <div className="flex items-center space-x-2 pb-4 mb-4 border-b border-slate-800">
                <Trophy className="text-emerald-400" size={20} />
                <h2 className="font-display font-extrabold text-lg text-white">Simulation Sandbox</h2>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                Use these tools to manually kickoff matches (locking predictions) and submit scores to trigger the points calculator engine.
              </p>

              <div className="space-y-6">
                {matches.map((match: any) => {
                  const isCompleted = match.status === 'COMPLETED';
                  const isLive = match.status === 'LIVE';
                  const scores = resolveScores[match.id] || { home: 0, away: 0 };

                  return (
                    <div key={match.id} className="bg-slate-950/40 p-4 rounded-xl border border-slate-900 space-y-3.5">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-300">{match.home_team} vs {match.away_team}</span>
                        <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded uppercase border border-slate-800">
                          {match.status}
                        </span>
                      </div>

                      {/* Step 1: Force Kickoff */}
                      {!isCompleted && !isLive && (
                        <button
                          onClick={() => simulateKickoffMutation.mutate(match.id)}
                          disabled={simulateKickoffMutation.isPending}
                          className="w-full flex items-center justify-center space-x-1.5 py-1.5 rounded-lg bg-indigo-600/10 hover:bg-indigo-600 border border-indigo-500/20 hover:border-indigo-400 text-indigo-400 hover:text-white text-xs font-bold transition cursor-pointer"
                        >
                          <Play size={11} />
                          <span>Simulate Kickoff (Lock Out)</span>
                        </button>
                      )}

                      {/* Step 2: Resolve Scores */}
                      {!isCompleted && (
                        <form onSubmit={(e) => handleResolveSubmit(e, match.id)} className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1">
                              <label className="text-[10px] text-slate-500 font-semibold uppercase">{match.home_team}</label>
                              <input
                                type="number"
                                min="0"
                                value={scores.home}
                                onChange={(e) => updateScoreState(match.id, 'home', parseInt(e.target.value) || 0)}
                                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white text-xs font-bold text-center mt-1"
                              />
                            </div>
                            <span className="text-slate-600 font-black text-sm pt-4">:</span>
                            <div className="flex-1">
                              <label className="text-[10px] text-slate-500 font-semibold uppercase">{match.away_team}</label>
                              <input
                                type="number"
                                min="0"
                                value={scores.away}
                                onChange={(e) => updateScoreState(match.id, 'away', parseInt(e.target.value) || 0)}
                                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white text-xs font-bold text-center mt-1"
                              />
                            </div>
                          </div>

                          <button
                            type="submit"
                            disabled={simulateResolveMutation.isPending}
                            className="w-full flex items-center justify-center space-x-1 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 border border-emerald-500/20 hover:border-emerald-400 text-emerald-400 hover:text-slate-950 text-xs font-bold transition cursor-pointer"
                          >
                            <CheckCircle2 size={11} />
                            <span>Resolve Match Outcomes</span>
                          </button>
                        </form>
                      )}

                      {isCompleted && (
                        <div className="text-center bg-slate-900 border border-slate-800 rounded p-2.5">
                          <span className="text-xs font-bold text-emerald-400 flex items-center justify-center">
                            <CheckCircle2 size={13} className="mr-1" />
                            Match Resolved ({match.home_score} - {match.away_score})
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Reset Everything */}
                <div className="pt-4 border-t border-slate-800">
                  <button
                    onClick={() => simulateResetMutation.mutate()}
                    disabled={simulateResetMutation.isPending}
                    className="w-full flex items-center justify-center space-x-1.5 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 border border-rose-500/20 hover:border-rose-400 text-rose-400 hover:text-white text-xs font-bold transition cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    <span>Reset All Sandbox Data</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
