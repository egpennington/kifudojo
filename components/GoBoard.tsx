import React, { useMemo } from 'react';
import { BoardSize, BoardState, STAR_POINTS, StoneColor } from '../types';

interface GoBoardProps {
  size: BoardSize;
  stones: BoardState;
  onIntersectionClick?: (x: number, y: number) => void;
  readOnly?: boolean;
  lastMove?: { x: number, y: number } | null;
  feedback?: {
    missing: string[]; // keys "x,y"
    extra: string[];
    correct: string[];
  };
}

const GoBoard: React.FC<GoBoardProps> = ({ size, stones, onIntersectionClick, readOnly, lastMove, feedback }) => {
  // Padding around the grid
  const padding = 30;
  // Grid cell size
  const cellSize = 40;
  // Total canvas size
  const boardPixelSize = (size - 1) * cellSize + padding * 2;

  const handleBoardClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (readOnly || !onIntersectionClick) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const xRaw = e.clientX - rect.left;
    const yRaw = e.clientY - rect.top;

    // Convert pixel to grid coordinate
    // The grid starts at `padding`
    const xGrid = Math.round((xRaw - padding) / cellSize);
    const yGrid = Math.round((yRaw - padding) / cellSize);

    if (xGrid >= 0 && xGrid < size && yGrid >= 0 && yGrid < size) {
      onIntersectionClick(xGrid, yGrid);
    }
  };

  const starPoints = STAR_POINTS[size] || [];

  // Generate grid lines
  const gridLines = useMemo(() => {
    const lines = [];
    // Vertical
    for (let i = 0; i < size; i++) {
      lines.push(
        <line
          key={`v-${i}`}
          x1={padding + i * cellSize}
          y1={padding}
          x2={padding + i * cellSize}
          y2={boardPixelSize - padding}
          stroke="#000"
          strokeWidth="1"
        />
      );
    }
    // Horizontal
    for (let i = 0; i < size; i++) {
      lines.push(
        <line
          key={`h-${i}`}
          x1={padding}
          y1={padding + i * cellSize}
          x2={boardPixelSize - padding}
          y2={padding + i * cellSize}
          stroke="#000"
          strokeWidth="1"
        />
      );
    }
    return lines;
  }, [size, boardPixelSize]);

  return (
    <div className="relative inline-block shadow-2xl rounded bg-[#e3b06e] border-2 border-[#8b5a2b]">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${boardPixelSize} ${boardPixelSize}`}
        className="w-full h-full max-w-[600px] max-h-[600px] select-none touch-none"
        onClick={handleBoardClick}
        style={{ aspectRatio: '1/1' }}
      >
        {/* Board Texture / Background Area */}
        <rect x="0" y="0" width={boardPixelSize} height={boardPixelSize} fill="#DCB35C" opacity="0.2" />

        {/* Grid */}
        {gridLines}

        {/* Star Points */}
        {starPoints.map(([x, y]) => (
          <circle
            key={`star-${x}-${y}`}
            cx={padding + x * cellSize}
            cy={padding + y * cellSize}
            r={4}
            fill="#000"
          />
        ))}

        {/* Stones */}
        {Object.entries(stones).map(([key, color]) => {
          const [x, y] = key.split(',').map(Number);
          const isMissing = feedback?.missing.includes(key);
          const isExtra = feedback?.extra.includes(key);
          const isCorrect = feedback?.correct.includes(key);
          const isLastMove = lastMove && lastMove.x === x && lastMove.y === y;

          // If it's a missing stone (ghost), we render it differently
          if (isMissing) return null; 

          return (
            <g key={key}>
              {/* Shadow */}
              <circle
                cx={padding + x * cellSize + 2}
                cy={padding + y * cellSize + 2}
                r={cellSize * 0.45}
                fill="rgba(0,0,0,0.3)"
              />
              {/* Stone Body */}
              <circle
                cx={padding + x * cellSize}
                cy={padding + y * cellSize}
                r={cellSize * 0.45}
                fill={color === 'black' ? '#111' : '#fcfcfc'}
                stroke={color === 'white' ? '#ddd' : '#000'}
                strokeWidth={1}
              />
              {/* Gloss for Black Stones */}
              {color === 'black' && (
                <circle
                  cx={padding + x * cellSize - cellSize * 0.15}
                  cy={padding + y * cellSize - cellSize * 0.15}
                  r={cellSize * 0.1}
                  fill="rgba(255,255,255,0.2)"
                />
              )}
              {/* Gradient/Shading for White Stones */}
              {color === 'white' && (
                <circle
                  cx={padding + x * cellSize - cellSize * 0.1}
                  cy={padding + y * cellSize - cellSize * 0.1}
                  r={cellSize * 0.35}
                  fill="url(#whiteStoneGradient)"
                  opacity="0.1"
                />
              )}

              {/* Last Move Marker */}
              {isLastMove && (
                <circle
                  cx={padding + x * cellSize}
                  cy={padding + y * cellSize}
                  r={cellSize * 0.2}
                  fill="none"
                  stroke={color === 'black' ? 'white' : 'black'}
                  strokeWidth={2}
                />
              )}

              {/* Feedback Overlays */}
              {isExtra && (
                <path
                  d={`M ${padding + x * cellSize - 10} ${padding + y * cellSize - 10} L ${padding + x * cellSize + 10} ${padding + y * cellSize + 10} M ${padding + x * cellSize + 10} ${padding + y * cellSize - 10} L ${padding + x * cellSize - 10} ${padding + y * cellSize + 10}`}
                  stroke="#ef4444"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              )}
              {isCorrect && (
                <circle
                   cx={padding + x * cellSize}
                   cy={padding + y * cellSize}
                   r={cellSize * 0.2}
                   fill="#22c55e"
                />
              )}
            </g>
          );
        })}

        {/* Missing Stones (Ghosts) */}
        {feedback?.missing.map((key) => {
           const [x, y] = key.split(',').map(Number);
           return (
             <g key={`missing-${key}`}>
                <circle
                  cx={padding + x * cellSize}
                  cy={padding + y * cellSize}
                  r={cellSize * 0.45}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="3"
                  strokeDasharray="4 4"
                />
             </g>
           );
        })}

        {/* Interaction Targets (invisible, larger click area) */}
        {!readOnly && Array.from({ length: size * size }).map((_, i) => {
          const x = i % size;
          const y = Math.floor(i / size);
          return (
            <rect
              key={`target-${x}-${y}`}
              x={padding + x * cellSize - cellSize / 2}
              y={padding + y * cellSize - cellSize / 2}
              width={cellSize}
              height={cellSize}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                  e.stopPropagation(); // Prevent SVG click from firing duplicate
                  onIntersectionClick && onIntersectionClick(x, y);
              }}
            />
          );
        })}

        <defs>
          <radialGradient id="whiteStoneGradient">
            <stop offset="0%" stopColor="#fff" />
            <stop offset="100%" stopColor="#ddd" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
};

export default GoBoard;