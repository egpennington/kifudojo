import React, { useState, useEffect } from 'react';
import { GameRecord, BoardSize, BoardState, StoneColor, Move } from '../types';
import { Trash2, PlusCircle, Calendar, ChevronDown, ChevronUp, Play, SkipBack, SkipForward, FastForward, RotateCcw } from 'lucide-react';
import GoBoard from './GoBoard';
import { playStoneSound } from '../services/sound';

// --- Simple Go Logic Helpers ---
const getNeighbors = (x: number, y: number, size: number) => {
  const neighbors = [];
  if (x > 0) neighbors.push([x - 1, y]);
  if (x < size - 1) neighbors.push([x + 1, y]);
  if (y > 0) neighbors.push([x, y - 1]);
  if (y < size - 1) neighbors.push([x, y + 1]);
  return neighbors;
};

const getGroup = (board: BoardState, startX: number, startY: number, size: number) => {
  const color = board[`${startX},${startY}`];
  if (!color) return null;

  const group: string[] = [`${startX},${startY}`];
  const queue = [[startX, startY]];
  const visited = new Set<string>();
  visited.add(`${startX},${startY}`);

  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!;
    getNeighbors(cx, cy, size).forEach(([nx, ny]) => {
      const key = `${nx},${ny}`;
      if (board[key] === color && !visited.has(key)) {
        visited.add(key);
        group.push(key);
        queue.push([nx, ny]);
      }
    });
  }
  return group;
};

const countLiberties = (board: BoardState, group: string[], size: number) => {
  const liberties = new Set<string>();
  group.forEach(key => {
    const [x, y] = key.split(',').map(Number);
    getNeighbors(x, y, size).forEach(([nx, ny]) => {
      if (!board[`${nx},${ny}`]) {
        liberties.add(`${nx},${ny}`);
      }
    });
  });
  return liberties.size;
};

// --- Component ---

interface GameLogProps {
  logs: GameRecord[];
  onAddLog: (log: GameRecord) => void;
  onDeleteLog: (id: string) => void;
}

const GameLog: React.FC<GameLogProps> = ({ logs, onAddLog, onDeleteLog }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [blackPlayer, setBlackPlayer] = useState('');
  const [whitePlayer, setWhitePlayer] = useState('');
  const [size, setSize] = useState<BoardSize>(19);
  const [result, setResult] = useState('');
  const [notes, setNotes] = useState('');
  
  // Recorder State
  const [moves, setMoves] = useState<Move[]>([]);
  const [board, setBoard] = useState<BoardState>({}); // Computed board
  const [captures, setCaptures] = useState({ black: 0, white: 0 }); // Black: stones B has captured
  const [turn, setTurn] = useState<StoneColor>('black');
  
  // Replay State
  const [replayMoveIndex, setReplayMoveIndex] = useState<number>(-1); // -1 = empty board
  const [replayAuto, setReplayAuto] = useState(false);

  // --- Recorder Logic ---
  const handleBoardClick = (x: number, y: number) => {
    if (board[`${x},${y}`]) return; // Cannot place on top

    playStoneSound();

    const newBoard = { ...board };
    newBoard[`${x},${y}`] = turn;
    
    // Check Captures
    const neighbors = getNeighbors(x, y, size);
    let capturedStones = 0;
    const opponent = turn === 'black' ? 'white' : 'black';

    // Remove opponent groups with 0 liberties
    neighbors.forEach(([nx, ny]) => {
       if (newBoard[`${nx},${ny}`] === opponent) {
         const group = getGroup(newBoard, nx, ny, size);
         if (group && countLiberties(newBoard, group, size) === 0) {
           group.forEach(k => {
             delete newBoard[k];
             capturedStones++;
           });
         }
       }
    });

    // Suicide check (simplified: if no liberties after capture check, undo)
    const myGroup = getGroup(newBoard, x, y, size);
    if (myGroup && countLiberties(newBoard, myGroup, size) === 0) {
      alert("Suicide move not allowed (or currently unsupported in this basic recorder).");
      return;
    }

    // Update State
    setBoard(newBoard);
    setMoves([...moves, { x, y, color: turn, captures: capturedStones }]);
    
    if (capturedStones > 0) {
      setCaptures(prev => ({
        ...prev,
        [turn]: prev[turn] + capturedStones
      }));
    }

    setTurn(turn === 'black' ? 'white' : 'black');
  };

  const undoLastMove = () => {
    if (moves.length === 0) return;
    // Basic undo: just remove last move and re-calculate whole board from scratch
    // because reversing captures is hard without storing diffs.
    const newMoves = moves.slice(0, -1);
    
    // Replay all to get state
    const { board: b, captures: c } = replayGame(newMoves, size);
    setBoard(b);
    setCaptures(c);
    setMoves(newMoves);
    setTurn(newMoves.length % 2 === 0 ? 'black' : 'white');
  };

  const resetRecorder = () => {
    setMoves([]);
    setBoard({});
    setCaptures({ black: 0, white: 0 });
    setTurn('black');
  };

  // --- Replay Logic ---
  const replayGame = (moveList: Move[], boardSize: number) => {
    let b: BoardState = {};
    let c = { black: 0, white: 0 };
    
    moveList.forEach(m => {
      const { x, y, color } = m;
      b[`${x},${y}`] = color;
      
      const opponent = color === 'black' ? 'white' : 'black';
      const neighbors = getNeighbors(x, y, boardSize);
      
      neighbors.forEach(([nx, ny]) => {
         if (b[`${nx},${ny}`] === opponent) {
           const group = getGroup(b, nx, ny, boardSize);
           if (group && countLiberties(b, group, boardSize) === 0) {
             group.forEach(k => delete b[k]);
             c[color] += group.length;
           }
         }
      });
    });
    return { board: b, captures: c };
  };

  // Replay Render Logic
  const currentReplayState = React.useMemo(() => {
    if (!expandedLogId) return null;
    const log = logs.find(l => l.id === expandedLogId);
    if (!log || !log.moves) return null;
    
    const movesUntilIndex = log.moves.slice(0, replayMoveIndex + 1);
    return {
      ...replayGame(movesUntilIndex, log.size),
      lastMove: movesUntilIndex[movesUntilIndex.length - 1]
    };
  }, [expandedLogId, replayMoveIndex, logs]);

  useEffect(() => {
    let interval: any;
    if (replayAuto && expandedLogId) {
       interval = setInterval(() => {
          setReplayMoveIndex(prev => {
             const log = logs.find(l => l.id === expandedLogId);
             if (log && prev < log.moves.length - 1) {
                return prev + 1;
             }
             setReplayAuto(false);
             return prev;
          });
       }, 500);
    }
    return () => clearInterval(interval);
  }, [replayAuto, expandedLogId, logs]);


  // --- Submit ---
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blackPlayer && !whitePlayer) {
      alert("Please enter at least one player name");
      return;
    }

    onAddLog({
      id: Date.now().toString(),
      date,
      blackPlayer: blackPlayer || 'Black',
      whitePlayer: whitePlayer || 'White',
      size,
      result: result || '?',
      notes,
      finalStones: board,
      moves,
      captures
    });

    // Reset
    setDate(new Date().toISOString().split('T')[0]);
    setBlackPlayer('');
    setWhitePlayer('');
    setResult('');
    setNotes('');
    resetRecorder();
    setIsFormOpen(false);
  };

  // --- Sub-Components ---
  const CaptureBowl = ({ color, count }: { color: 'black' | 'white', count: number }) => (
    <div className="flex flex-col items-center">
      <div className={`relative w-16 h-16 rounded-full border-4 flex items-center justify-center shadow-inner ${color === 'black' ? 'bg-stone-800 border-stone-600' : 'bg-stone-100 border-stone-300'}`}>
         {/* Lid Handle appearance */}
         <div className={`w-12 h-12 rounded-full border opacity-20 ${color === 'black' ? 'border-white' : 'border-black'}`}></div>
         <span className={`absolute text-xl font-bold ${color === 'black' ? 'text-white' : 'text-stone-800'}`}>
           {count}
         </span>
      </div>
      <span className="text-xs font-bold uppercase mt-1 text-stone-500">{color} Captures</span>
    </div>
  );

  return (
    <div className="w-full max-w-5xl mx-auto p-4 space-y-6 pb-20">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-stone-800">Game Records</h2>
        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="flex items-center gap-2 px-4 py-2 bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition"
        >
          {isFormOpen ? 'Cancel' : <><PlusCircle size={18} /> New Record</>}
        </button>
      </div>

      {/* --- ADD NEW GAME FORM --- */}
      {isFormOpen && (
        <div className="bg-white p-6 rounded-xl shadow-md border border-stone-200 mb-8 animate-fade-in-down">
          <div className="flex flex-col xl:flex-row gap-8">
            {/* Input Fields */}
            <div className="flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-stone-500 mb-1">Date</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded focus:ring-2 focus:ring-stone-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-stone-500 mb-1">Board Size</label>
                  <select 
                    value={size} 
                    onChange={e => { setSize(Number(e.target.value) as BoardSize); resetRecorder(); }} 
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-stone-500 outline-none"
                  >
                    <option value={9}>9x9</option>
                    <option value={13}>13x13</option>
                    <option value={19}>19x19</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-stone-500 mb-1">Black Player</label>
                  <input type="text" value={blackPlayer} onChange={e => setBlackPlayer(e.target.value)} placeholder="Name" className="w-full p-2 border rounded focus:ring-2 focus:ring-stone-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-stone-500 mb-1">White Player</label>
                  <input type="text" value={whitePlayer} onChange={e => setWhitePlayer(e.target.value)} placeholder="Name" className="w-full p-2 border rounded focus:ring-2 focus:ring-stone-500 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-stone-500 mb-1">Result</label>
                <input type="text" value={result} onChange={e => setResult(e.target.value)} placeholder="e.g. B+Res, W+10.5" className="w-full p-2 border rounded focus:ring-2 focus:ring-stone-500 outline-none" />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-stone-500 mb-1">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-2 border rounded focus:ring-2 focus:ring-stone-500 outline-none h-24" placeholder="Kifu info, comments..." />
              </div>

              <button onClick={handleSubmit} className="w-full py-3 bg-emerald-600 text-white rounded font-bold hover:bg-emerald-700 transition shadow-sm mt-4">
                Save Record
              </button>
            </div>

            {/* Board Recorder */}
            <div className="flex-1 flex flex-col items-center bg-stone-50 p-4 rounded-xl border border-stone-100">
               <div className="w-full flex justify-between items-center mb-4 px-2">
                 <CaptureBowl color="black" count={captures.black} />
                 <div className="flex flex-col items-center">
                    <span className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-1">Game Recorder</span>
                    <div className="flex items-center gap-2 bg-white px-4 py-1.5 rounded-full border border-stone-200 shadow-sm">
                       <div className={`w-3 h-3 rounded-full ${turn === 'black' ? 'bg-black' : 'bg-white border border-stone-300'}`}></div>
                       <span className="font-bold text-stone-700">{turn === 'black' ? 'Black' : 'White'} to play</span>
                    </div>
                 </div>
                 <CaptureBowl color="white" count={captures.white} />
               </div>

               <GoBoard 
                 size={size} 
                 stones={board} 
                 onIntersectionClick={handleBoardClick} 
                 lastMove={moves.length > 0 ? moves[moves.length-1] : null}
               />
               
               <div className="mt-4 flex gap-3 w-full justify-center">
                 <button onClick={undoLastMove} disabled={moves.length === 0} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-stone-300 rounded hover:bg-stone-50 disabled:opacity-50">
                   <RotateCcw size={14} /> Undo Move
                 </button>
                 <button onClick={resetRecorder} disabled={moves.length === 0} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-stone-300 rounded hover:bg-stone-50 disabled:opacity-50 text-red-600">
                   <Trash2 size={14} /> Clear Board
                 </button>
               </div>
               <p className="mt-2 text-xs text-stone-400">Captured stones are removed automatically.</p>
            </div>
          </div>
        </div>
      )}

      {/* --- LOGS LIST --- */}
      {logs.length === 0 && !isFormOpen ? (
        <div className="text-center py-12 text-stone-500 bg-white rounded-xl border border-stone-200 border-dashed">
          <Calendar className="mx-auto mb-2 opacity-50" size={48} />
          <p>No games recorded yet.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {logs.slice().reverse().map(log => (
            <div key={log.id} className="bg-white rounded-lg shadow-sm border border-stone-200 hover:shadow-md transition overflow-hidden">
               {/* Log Header */}
              <div 
                className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center cursor-pointer hover:bg-stone-50 transition gap-4"
                onClick={() => {
                   if (expandedLogId !== log.id) {
                     setExpandedLogId(log.id);
                     setReplayMoveIndex(log.moves ? log.moves.length - 1 : -1);
                     setReplayAuto(false);
                   } else {
                     setExpandedLogId(null);
                   }
                }}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <div className="flex items-center gap-2 font-bold text-lg text-stone-800">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-black"></span> {log.blackPlayer || 'Black'}</span>
                      <span className="text-stone-300 text-sm">vs</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-white border border-stone-300"></span> {log.whitePlayer || (log as any).opponent || 'White'}</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 bg-stone-100 text-stone-600 rounded-full border border-stone-300">
                      {log.size}x{log.size}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${log.result.toLowerCase().startsWith('w') ? 'bg-white border border-stone-300 text-stone-800' : 'bg-stone-800 text-white'}`}>
                      {log.result}
                    </span>
                  </div>
                  <div className="text-sm text-stone-500">{log.date}</div>
                </div>
                <div className="flex items-center gap-4">
                  {expandedLogId === log.id ? <ChevronUp className="text-stone-400" /> : <ChevronDown className="text-stone-400" />}
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteLog(log.id); }}
                    className="text-stone-300 hover:text-red-500 transition p-2"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              
              {/* Expanded Replay Area */}
              {expandedLogId === log.id && (
                <div className="border-t border-stone-100 bg-stone-50 p-6 flex flex-col items-center gap-6 animate-fade-in cursor-default" onClick={e => e.stopPropagation()}>
                   {log.notes && (
                     <div className="w-full bg-white p-4 rounded border border-stone-200 text-stone-700 text-sm">
                       <span className="block text-xs font-bold uppercase text-stone-400 mb-1">Notes</span>
                       {log.notes}
                     </div>
                   )}
                   
                   {/* Replay Board */}
                   {log.moves && log.moves.length > 0 ? (
                     <div className="w-full max-w-[500px] flex flex-col items-center">
                        <div className="flex justify-between w-full mb-2 px-4 text-sm font-bold text-stone-500">
                           <span>B Captures: {currentReplayState?.captures.black}</span>
                           <span>Move: {replayMoveIndex + 1} / {log.moves.length}</span>
                           <span>W Captures: {currentReplayState?.captures.white}</span>
                        </div>
                        
                        <GoBoard 
                          size={log.size} 
                          stones={currentReplayState?.board || {}} 
                          readOnly 
                          lastMove={currentReplayState?.lastMove}
                        />

                        {/* Replay Controls */}
                        <div className="flex items-center gap-2 mt-4 bg-white p-2 rounded-full shadow border border-stone-200">
                           <button onClick={() => setReplayMoveIndex(-1)} className="p-2 hover:bg-stone-100 rounded-full text-stone-600"><SkipBack size={20} /></button>
                           <button onClick={() => setReplayMoveIndex(Math.max(-1, replayMoveIndex - 1))} className="p-2 hover:bg-stone-100 rounded-full text-stone-600"><ChevronDown className="rotate-90" size={20} /></button>
                           <button onClick={() => setReplayAuto(!replayAuto)} className={`p-2 rounded-full ${replayAuto ? 'bg-stone-800 text-white' : 'hover:bg-stone-100 text-stone-800'}`}>
                             <Play size={20} fill={replayAuto ? "currentColor" : "none"} />
                           </button>
                           <button onClick={() => setReplayMoveIndex(Math.min(log.moves.length - 1, replayMoveIndex + 1))} className="p-2 hover:bg-stone-100 rounded-full text-stone-600"><ChevronDown className="-rotate-90" size={20} /></button>
                           <button onClick={() => setReplayMoveIndex(log.moves.length - 1)} className="p-2 hover:bg-stone-100 rounded-full text-stone-600"><SkipForward size={20} /></button>
                        </div>
                     </div>
                   ) : (
                     <div className="flex flex-col items-center">
                        <GoBoard size={log.size} stones={log.finalStones || (log as any).stones || {}} readOnly />
                        <p className="mt-2 text-stone-400 text-sm italic">Legacy record (no move data available)</p>
                     </div>
                   )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GameLog;