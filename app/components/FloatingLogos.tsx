import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

interface Logo {
  id: number;
  x: number;
  y: number;
  size: number;
  rotation: number;
  velocity: { x: number; y: number };
  initialVelocity: { x: number; y: number };
}

interface DrawPoint {
  x: number;
  y: number;
}

interface GameProps {
  isMinimized: boolean;
}

const INITIAL_SIZE = 40;
const BASE_SPEED = 0.5;
const SPEED_INCREASE = 0.05;
const INITIAL_LOGO_COUNT = 15;
const MIN_CIRCLE_POINTS = 20; // Minimum points needed to form a valid circle
const CIRCLE_CLOSE_THRESHOLD = 30; // Distance to connect end points
const CURSOR_COLLISION_THRESHOLD = 15;

export const FloatingLogos = ({ isMinimized }: GameProps) => {
  const [logos, setLogos] = useState<Logo[]>([]);
  const [score, setScore] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState<DrawPoint[]>([]);
  const [gameActive, setGameActive] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const speedMultiplierRef = useRef(1);

  // Watch for window minimize to start game
  useEffect(() => {
    if (isMinimized && !gameActive) {
      setGameActive(true);
      initializeLogos();
    } else if (!isMinimized) {
      setGameActive(false);
      setLogos([]); // Clear logos when chat is open
      setScore(0);
      speedMultiplierRef.current = 1;
    }
  }, [isMinimized, gameActive]);

  // Initialize logos
  const initializeLogos = () => {
    const initialLogos: Logo[] = Array.from({ length: INITIAL_LOGO_COUNT }, (_, i) => ({
      id: i,
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size: INITIAL_SIZE,
      rotation: Math.random() * 360,
      velocity: {
        x: (Math.random() - 0.5) * BASE_SPEED,
        y: (Math.random() - 0.5) * BASE_SPEED
      },
      initialVelocity: {
        x: (Math.random() - 0.5) * BASE_SPEED,
        y: (Math.random() - 0.5) * BASE_SPEED
      }
    }));
    setLogos(initialLogos);
    setScore(0);
    speedMultiplierRef.current = 1;
  };

  // Track cursor position
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      cursorRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Logo movement and collision detection
  useEffect(() => {
    let animationFrameId: number;

    const updateLogos = () => {
      if (!gameActive) return;

      setLogos(prevLogos => {
        const updatedLogos = [...prevLogos];
        const currentSpeedMultiplier = speedMultiplierRef.current;

        updatedLogos.forEach(logo => {
          // Apply speed multiplier to initial velocities
          logo.velocity.x = logo.initialVelocity.x * currentSpeedMultiplier;
          logo.velocity.y = logo.initialVelocity.y * currentSpeedMultiplier;

          // Update position
          logo.x += logo.velocity.x;
          logo.y += logo.velocity.y;
          logo.rotation += logo.velocity.x;

          // Bounce off walls
          if (logo.x <= 0 || logo.x + logo.size >= window.innerWidth) {
            logo.velocity.x *= -1;
            logo.initialVelocity.x *= -1;
            logo.x = Math.max(0, Math.min(window.innerWidth - logo.size, logo.x));
          }
          if (logo.y <= 0 || logo.y + logo.size >= window.innerHeight) {
            logo.velocity.y *= -1;
            logo.initialVelocity.y *= -1;
            logo.y = Math.max(0, Math.min(window.innerHeight - logo.size, logo.y));
          }

          // Check cursor collision
          const logoCenter = {
            x: logo.x + logo.size / 2,
            y: logo.y + logo.size / 2
          };
          const distance = Math.sqrt(
            Math.pow(logoCenter.x - cursorRef.current.x, 2) +
            Math.pow(logoCenter.y - cursorRef.current.y, 2)
          );
          
          if (distance < logo.size / 2 + CURSOR_COLLISION_THRESHOLD) {
            initializeLogos(); // Reset game on collision
            return updatedLogos;
          }
        });

        // Handle collisions between logos
        for (let i = 0; i < updatedLogos.length; i++) {
          for (let j = i + 1; j < updatedLogos.length; j++) {
            const logo1 = updatedLogos[i];
            const logo2 = updatedLogos[j];

            const dx = (logo1.x + logo1.size / 2) - (logo2.x + logo2.size / 2);
            const dy = (logo1.y + logo1.size / 2) - (logo2.y + logo2.size / 2);
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < (logo1.size + logo2.size) / 2) {
              // Elastic collision
              const angle = Math.atan2(dy, dx);
              const sin = Math.sin(angle);
              const cos = Math.cos(angle);

              // Rotate velocities
              const vx1 = logo1.velocity.x * cos + logo1.velocity.y * sin;
              const vy1 = logo1.velocity.y * cos - logo1.velocity.x * sin;
              const vx2 = logo2.velocity.x * cos + logo2.velocity.y * sin;
              const vy2 = logo2.velocity.y * cos - logo2.velocity.x * sin;

              // Dampen the velocities after collision
              const dampening = 0.85; // Add slight energy loss in collisions
              logo1.velocity.x = (vx2 * cos - vy1 * sin) * dampening;
              logo1.velocity.y = (vy1 * cos + vx2 * sin) * dampening;
              logo2.velocity.x = (vx1 * cos - vy2 * sin) * dampening;
              logo2.velocity.y = (vy2 * cos + vx1 * sin) * dampening;

              // Prevent sticking
              const overlap = (logo1.size + logo2.size) / 2 - distance;
              const moveX = (overlap * dx) / distance / 2;
              const moveY = (overlap * dy) / distance / 2;

              logo1.x += moveX;
              logo1.y += moveY;
              logo2.x -= moveX;
              logo2.y -= moveY;
            }
          }
        }

        return updatedLogos;
      });

      animationFrameId = requestAnimationFrame(updateLogos);
    };

    if (gameActive) {
      animationFrameId = requestAnimationFrame(updateLogos);
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [gameActive]);

  // Check if a point is inside the drawn path
  const isPointInPath = (point: { x: number; y: number }, path: DrawPoint[]): boolean => {
    let inside = false;
    for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
      const xi = path[i].x, yi = path[i].y;
      const xj = path[j].x, yj = path[j].y;
      
      const intersect = ((yi > point.y) !== (yj > point.y)) 
        && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // Check if the path forms a complete circle
  const isCircleClosed = (points: DrawPoint[]): boolean => {
    if (points.length < MIN_CIRCLE_POINTS) return false;
    
    const startPoint = points[0];
    const endPoint = points[points.length - 1];
    const distance = Math.sqrt(
      Math.pow(endPoint.x - startPoint.x, 2) + 
      Math.pow(endPoint.y - startPoint.y, 2)
    );
    
    return distance < CIRCLE_CLOSE_THRESHOLD;
  };

  // Handle mouse events for drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseDown = (e: MouseEvent) => {
      setIsDrawing(true);
      setDrawPoints([{ x: e.clientX, y: e.clientY }]);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDrawing) return;
      setDrawPoints(prev => [...prev, { x: e.clientX, y: e.clientY }]);
    };

    const handleMouseUp = () => {
      if (!isDrawing || !gameActive) return;
      setIsDrawing(false);

      if (isCircleClosed(drawPoints)) {
        setLogos(prevLogos => {
          const remainingLogos = prevLogos.filter(logo => {
            const logoCenter = {
              x: logo.x + logo.size / 2,
              y: logo.y + logo.size / 2
            };
            const captured = isPointInPath(logoCenter, drawPoints);
            if (captured) {
              // Handle each captured logo individually
              handleLogoCapture();
            }
            return !captured;
          });
          
          return remainingLogos;
        });
      }
      setDrawPoints([]);
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
    };
  }, [isDrawing, drawPoints, gameActive]);

  // Draw the path and handle animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw the path
      if (drawPoints.length > 1) {
        ctx.beginPath();
        ctx.moveTo(drawPoints[0].x, drawPoints[0].y);
        drawPoints.forEach((point, i) => {
          if (i > 0) {
            ctx.lineTo(point.x, point.y);
          }
        });
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Add glow effect
        ctx.shadowColor = '#3B82F6';
        ctx.shadowBlur = 15;
        ctx.stroke();
      }

      requestAnimationFrame(animate);
    };

    const animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [drawPoints]);

  // Update score and speed multiplier when capturing logos
  const handleLogoCapture = () => {
    setScore(prev => {
      const newScore = prev + 1;
      speedMultiplierRef.current = 1 + (newScore * SPEED_INCREASE);
      return newScore;
    });
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-20"
        style={{ display: gameActive ? 'block' : 'none' }}
      />
      <div className="fixed inset-0 pointer-events-none z-10">
        {logos.map(logo => (
          <div
            key={logo.id}
            className="absolute transition-transform duration-100"
            style={{
              left: `${logo.x}px`,
              top: `${logo.y}px`,
              width: `${logo.size}px`,
              height: `${logo.size}px`,
              transform: `rotate(${logo.rotation}deg)`,
            }}
          >
            <Image
              src="/base-logo.png"
              alt="Base Logo"
              width={40}
              height={40}
              className="w-full h-full object-contain"
            />
          </div>
        ))}
      </div>
      {gameActive && (
        <div className="fixed top-4 right-4 z-30 bg-gray-900/70 backdrop-blur-md rounded-xl p-4 
          border border-blue-500/20 text-white font-mono space-y-2">
          <div>Score: {score}</div>
          <div className="text-xs text-gray-400">
            Speed: {Math.round(speedMultiplierRef.current * 100)}%
          </div>
        </div>
      )}
    </>
  );
}; 