import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Circle, 
  RotateCcw, 
  Save, 
  Play, 
  Grid, 
  Menu, 
  X, 
  Shuffle
} from 'lucide-react';
import GoBoard from './components/GoBoard';
import GameLog from './components/GameLog';
import { BoardSize, BoardState, SavedShape, StoneColor, DrillPhase, GameRecord } from './types';
import { loadShapes, saveShapes, loadLogs, saveLogs } from './services/storage';
import { playStoneSound } from './services/sound';

const INITIAL_STONES: BoardState = {};

function App() {
  // Navigation
  const [view, setView] = useState<'editor' | 'drill' | 'log'>('editor');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Editor State
  const [boardSize, setBoardSize] = useState<BoardSize>(19);
  const [stones, setStones] = useState<BoardState>(INITIAL_STONES);
  const [currentToolColor, setCurrentToolColor] = useState<StoneColor>('black');
  const [savedShapes, setSavedShapes] = useState<SavedShape[]>([]);
  const [newShapeName, setNewShapeName] = useState(""); // Input state for saving
  const [logs, setLogs] = useState<GameRecord[]>([]);

  // Drill State
  const [drillPhase, setDrillPhase] = useState<DrillPhase>('idle');
  const [drillTarget, setDrillTarget] = useState<BoardState | null>(null);
  const [drillTimer, setDrillTimer] = useState(0);
  const [feedback, setFeedback] = useState<{ missing: string[], extra: string[], correct: string[] } | undefined>(undefined);
  const [selectedShapeId, setSelectedShapeId] = useState<string>("");

  // Initialization
  useEffect(() => {
    setSavedShapes(loadShapes());
    // Load logs and ensure simple migration for legacy fields if needed
    const rawLogs = loadLogs();
    // @ts-ignore - Runtime migration handling for old 'opponent' field
    const migratedLogs = rawLogs.map(log => ({
      ...log,
      blackPlayer: log.blackPlayer || 'Black',
      // @ts-ignore
      whitePlayer: log.whitePlayer || log.opponent || 'White'
    }));
    setLogs(migratedLogs);
  }, []);

  // Timer for Drill
  useEffect(() => {
    let interval: any;
    if (drillPhase === 'memorize' && drillTimer > 0) {
      interval = setInterval(() => {
        setDrillTimer((prev) => prev - 1);
      }, 1000);
    } else if (drillPhase === 'memorize' && drillTimer === 0) {
      // Time up, start rebuild
      setStones({});
      setDrillPhase('rebuild');
    }
    return () => clearInterval(interval);
  }, [drillPhase, drillTimer]);

  // Actions
  const handleIntersectionClick = (x: number, y: number) => {
    if (drillPhase === 'memorize' || drillPhase === 'feedback') return;

    const key = `${x},${y}`;
    
    // Play sound if we are placing a new stone (not removing)
    if (!stones[key]) {
      playStoneSound();
    }

    setStones((prev) => {
      const newStones = { ...prev };
      if (newStones[key]) {
        delete newStones[key];
      } else {
        newStones[key] = currentToolColor;
      }
      return newStones;
    });
  };

  const clearBoard = () => {
    setStones({});
    if (drillPhase !== 'idle') {
      endDrill();
    }
  };

  const saveShape = () => {
    if (!newShapeName.trim()) {
      alert("Please enter a name for your shape.");
      return;
    }

    const newShape: SavedShape = {
      id: Date.now().toString(),
      name: newShapeName,
      size: boardSize,
      stones: { ...stones },
      createdAt: Date.now(),
    };
    const updated = [...savedShapes, newShape];
    setSavedShapes(updated);
    saveShapes(updated);
    setNewShapeName(""); // Clear input
  };

  const deleteShape = (id: string) => {
    if (!confirm("Delete this shape?")) return;
    const updated = savedShapes.filter(s => s.id !== id);
    setSavedShapes(updated);
    saveShapes(updated);
    if (selectedShapeId === id) setSelectedShapeId("");
  };

  // Drill Logic
  const startDrill = (shape: SavedShape) => {
    setBoardSize(shape.size);
    setStones(shape.stones); // Show target initially
    setDrillTarget(shape.stones);
    setDrillPhase('memorize');
    setDrillTimer(5); // 5 seconds to memorize
    setFeedback(undefined);
    setView('drill');
  };

  const startRandomDrill = () => {
    if (savedShapes.length === 0) {
      alert("No saved shapes found! Create some in the Editor first.");
      return;
    }
    const randomShape = savedShapes[Math.floor(Math.random() * savedShapes.length)];
    setSelectedShapeId(randomShape.id);
    startDrill(randomShape);
  };

  const checkDrill = () => {
    if (!drillTarget) return;

    const missing: string[] = [];
    const extra: string[] = [];
    const correct: string[] = [];

    // Check for correct and missing
    Object.entries(drillTarget).forEach(([key, color]) => {
      if (stones[key] === color) {
        correct.push(key);
      } else {
        missing.push(key);
      }
    });

    // Check for extras
    Object.keys(stones).forEach((key) => {
      if (!drillTarget[key]) {
        extra.push(key);
      } else if (stones[key] !== drillTarget[key]) {
        // If color mismatch, it counts as missing (wrong color) AND extra (wrong stone placed)
        // logic handled above for missing, add to extra here
        extra.push(key);
      }
    });

    setFeedback({ missing, extra, correct });
    setDrillPhase('feedback');
  };

  const endDrill = () => {
    setDrillPhase('idle');
    setFeedback(undefined);
    setDrillTarget(null);
    setStones({});
  };

  const retryDrill = () => {
    if (selectedShapeId) {
       const shape = savedShapes.find(s => s.id === selectedShapeId);
       if (shape) startDrill(shape);
    }
  };

  // Log Logic
  const addLog = (log: GameRecord) => {
    const updated = [...logs, log];
    setLogs(updated);
    saveLogs(updated);
  };

  const deleteLog = (id: string) => {
    if (!confirm("Delete this record?")) return;
    const updated = logs.filter(l => l.id !== id);
    setLogs(updated);
    saveLogs(updated);
  };

  const NavButton = ({ id, label, icon: Icon }: any) => (
    <button
      onClick={() => {
        setView(id);
        setMobileMenuOpen(false);
        // Reset specific states when switching main views
        if (id === 'editor') {
          endDrill();
          setStones({});
          setNewShapeName("");
        }
      }}
      className={`flex items-center gap-3 px-4 py-3 w-full rounded-lg transition-colors ${
        view === id 
          ? 'bg-stone-800 text-white shadow-md' 
          : 'text-stone-600 hover:bg-stone-200'
      }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-stone-100 font-sans text-stone-900">
      
      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-stone-50 border-r border-stone-200 p-4 shadow-sm z-10">
        <div className="mb-8 flex items-center gap-2 px-2">
          <Grid className="text-stone-800" />
          <h1 className="text-xl font-bold tracking-tight text-stone-800">Kifu Dojo</h1>
        </div>
        <nav className="space-y-2 flex-1">
          <NavButton id="editor" label="Shape Editor" icon={BookOpen} />
          <NavButton id="drill" label="Drill Mode" icon={Play} />
          <NavButton id="log" label="Game Log" icon={Save} />
        </nav>
        <div className="text-xs text-stone-400 px-4">
          v1.1.0
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 w-full bg-white border-b border-stone-200 p-4 z-20 flex justify-between items-center shadow-sm">
        <h1 className="text-lg font-bold text-stone-800 flex items-center gap-2">
          <Grid size={18} /> Kifu Dojo
        </h1>
        <button onClick={() => setMobileMenuOpen(true)}>
          <Menu className="text-stone-700" />
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-stone-900/50 z-30 md:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute right-0 top-0 h-full w-64 bg-stone-50 p-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8">
              <h2 className="font-bold text-stone-800">Menu</h2>
              <button onClick={() => setMobileMenuOpen(false)}><X className="text-stone-500" /></button>
            </div>
            <nav className="space-y-2">
              <NavButton id="editor" label="Shape Editor" icon={BookOpen} />
              <NavButton id="drill" label="Drill Mode" icon={Play} />
              <NavButton id="log" label="Game Log" icon={Save} />
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto md:p-6 p-4 pt-20 md:pt-6 bg-stone-100">
        
        {view === 'editor' && (
          <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-8 items-start">
            
            {/* Board Area */}
            <div className="flex-1 flex flex-col items-center w-full">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-200 mb-4 w-full flex flex-col sm:flex-row justify-between items-center gap-4">
                 <div className="flex gap-2 items-center">
                    {[9, 13, 19].map((s) => (
                      <button
                        key={s}
                        onClick={() => { setBoardSize(s as BoardSize); setStones({}); }}
                        className={`px-3 py-1 rounded text-sm font-medium transition ${
                          boardSize === s 
                            ? 'bg-stone-800 text-white' 
                            : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                 </div>
                 
                 <div className="flex gap-2 items-center bg-stone-100 p-1 rounded-lg">
                    <button
                      onClick={() => setCurrentToolColor('black')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition ${
                        currentToolColor === 'black' ? 'bg-white shadow text-stone-900' : 'text-stone-500'
                      }`}
                    >
                      <Circle size={14} fill="black" className="text-black" />
                    </button>
                    <button
                      onClick={() => setCurrentToolColor('white')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition ${
                        currentToolColor === 'white' ? 'bg-white shadow text-stone-900' : 'text-stone-500'
                      }`}
                    >
                      <Circle size={14} className="text-stone-400" />
                    </button>
                 </div>

                 <div className="flex gap-2 items-center w-full sm:w-auto">
                    <input 
                      type="text" 
                      placeholder="Shape Name" 
                      className="border border-stone-300 rounded px-3 py-1.5 text-sm w-full sm:w-40 focus:ring-2 focus:ring-stone-500 outline-none"
                      value={newShapeName}
                      onChange={(e) => setNewShapeName(e.target.value)}
                    />
                    <button onClick={saveShape} className="p-2 text-stone-500 bg-stone-100 hover:bg-emerald-50 hover:text-emerald-600 rounded transition" title="Save Shape">
                      <Save size={20} />
                    </button>
                    <button onClick={clearBoard} className="p-2 text-stone-500 hover:bg-red-50 hover:text-red-600 rounded transition" title="Clear Board">
                      <RotateCcw size={20} />
                    </button>
                 </div>
              </div>

              <GoBoard 
                size={boardSize} 
                stones={stones} 
                onIntersectionClick={handleIntersectionClick} 
              />
              <p className="mt-4 text-stone-500 text-sm">
                Click intersections to place stones. Click existing stones to remove them.
              </p>
            </div>

            {/* Saved Shapes Sidebar (in Editor) */}
            <div className="w-full lg:w-80 bg-white rounded-xl shadow-sm border border-stone-200 p-6">
              <h2 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">
                <BookOpen size={20} /> Saved Shapes
              </h2>
              {savedShapes.length === 0 ? (
                <p className="text-stone-400 text-sm italic">No saved shapes yet.</p>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                  {savedShapes.map(shape => (
                    <div key={shape.id} className="group flex items-center justify-between p-3 bg-stone-50 rounded-lg border border-stone-100 hover:border-stone-300 transition">
                      <div className="cursor-pointer" onClick={() => { setBoardSize(shape.size); setStones(shape.stones); }}>
                        <div className="font-medium text-stone-800">{shape.name}</div>
                        <div className="text-xs text-stone-500">{shape.size}x{shape.size} • {Object.keys(shape.stones).length} stones</div>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteShape(shape.id); }}
                        className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-500 transition p-1"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {view === 'drill' && (
           <div className="max-w-4xl mx-auto flex flex-col items-center">
             
             {drillPhase === 'idle' ? (
               <div className="text-center w-full max-w-md">
                 <h2 className="text-3xl font-bold text-stone-800 mb-6">Memory Drill</h2>
                 <p className="text-stone-600 mb-8">
                   Select a saved shape to memorize, or try a random one. 
                   You will have 5 seconds to study the shape before it disappears.
                 </p>
                 
                 <button 
                   onClick={startRandomDrill}
                   className="w-full flex justify-center items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition mb-6"
                 >
                   <Shuffle /> Random Drill
                 </button>

                 <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-4 text-left">
                   <h3 className="font-bold text-stone-700 mb-3 text-sm uppercase tracking-wide">Select Saved Shape</h3>
                   {savedShapes.length === 0 ? (
                      <p className="text-stone-400 text-sm">No saved shapes. Go to Editor to create one.</p>
                   ) : (
                     <div className="space-y-2 max-h-60 overflow-y-auto">
                        {savedShapes.map(shape => (
                          <button
                            key={shape.id}
                            onClick={() => { setSelectedShapeId(shape.id); startDrill(shape); }}
                            className="w-full text-left p-3 hover:bg-stone-50 rounded border border-transparent hover:border-stone-200 transition flex justify-between"
                          >
                            <span>{shape.name}</span>
                            <span className="text-xs text-stone-400 bg-stone-100 px-2 py-1 rounded">{shape.size}x{shape.size}</span>
                          </button>
                        ))}
                     </div>
                   )}
                 </div>
               </div>
             ) : (
               <div className="w-full flex flex-col items-center animate-fade-in">
                 {/* Drill Status Bar */}
                 <div className="w-full max-w-[600px] mb-6 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-stone-200">
                    <div className="font-bold text-stone-800 flex items-center gap-2">
                       {drillPhase === 'memorize' && <span className="text-amber-600">Memorize!</span>}
                       {drillPhase === 'rebuild' && <span className="text-indigo-600">Rebuild the shape</span>}
                       {drillPhase === 'feedback' && <span className="text-emerald-600">Results</span>}
                    </div>
                    
                    {drillPhase === 'memorize' && (
                       <div className="text-2xl font-mono font-bold text-red-500 animate-pulse">{drillTimer}s</div>
                    )}

                    <div className="flex gap-2">
                      {drillPhase === 'rebuild' && (
                         <button onClick={checkDrill} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition font-medium shadow">
                            Check Answer
                         </button>
                      )}
                      {drillPhase === 'feedback' && (
                        <div className="flex gap-2">
                          <button onClick={retryDrill} className="px-3 py-2 bg-stone-100 text-stone-700 rounded hover:bg-stone-200 transition text-sm">
                             Retry
                          </button>
                          <button onClick={() => setDrillPhase('idle')} className="px-3 py-2 bg-stone-800 text-white rounded hover:bg-stone-700 transition text-sm">
                             Done
                          </button>
                        </div>
                      )}
                      {drillPhase !== 'feedback' && (
                        <button onClick={endDrill} className="p-2 text-stone-400 hover:text-stone-600">
                           <X />
                        </button>
                      )}
                    </div>
                 </div>

                 {/* Board */}
                 <GoBoard 
                   size={boardSize} 
                   stones={stones} 
                   onIntersectionClick={handleIntersectionClick}
                   readOnly={drillPhase === 'memorize' || drillPhase === 'feedback'}
                   feedback={feedback}
                 />

                 {/* Controls for Rebuild Phase */}
                 {drillPhase === 'rebuild' && (
                    <div className="mt-6 flex gap-4 bg-white p-2 rounded-full shadow border border-stone-200">
                        <button
                          onClick={() => setCurrentToolColor('black')}
                          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition ${
                            currentToolColor === 'black' ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-100'
                          }`}
                        >
                          <Circle size={16} fill="currentColor" /> Black
                        </button>
                        <button
                          onClick={() => setCurrentToolColor('white')}
                          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition ${
                            currentToolColor === 'white' ? 'bg-stone-200 text-stone-800' : 'text-stone-500 hover:bg-stone-100'
                          }`}
                        >
                          <Circle size={16} className="text-stone-400" /> White
                        </button>
                    </div>
                 )}

                 {/* Feedback Stats */}
                 {drillPhase === 'feedback' && feedback && (
                    <div className="mt-6 grid grid-cols-3 gap-4 w-full max-w-[600px]">
                       <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-center">
                          <div className="text-2xl font-bold text-emerald-600">{feedback.correct.length}</div>
                          <div className="text-xs text-emerald-800 uppercase tracking-wide font-bold">Correct</div>
                       </div>
                       <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-center">
                          <div className="text-2xl font-bold text-red-600">{feedback.missing.length}</div>
                          <div className="text-xs text-red-800 uppercase tracking-wide font-bold">Missing</div>
                       </div>
                       <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 text-center">
                          <div className="text-2xl font-bold text-orange-600">{feedback.extra.length}</div>
                          <div className="text-xs text-orange-800 uppercase tracking-wide font-bold">Extra</div>
                       </div>
                    </div>
                 )}
               </div>
             )}
           </div>
        )}

        {view === 'log' && (
          <GameLog 
            logs={logs} 
            onAddLog={addLog} 
            onDeleteLog={deleteLog} 
          />
        )}

      </main>
    </div>
  );
}

export default App;