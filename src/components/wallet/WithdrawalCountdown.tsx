import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface WithdrawalCountdownProps {
  secondsUntilNext: number;
  nextWindowDay: string;
  nextWindowTime: string;
}

export const WithdrawalCountdown = ({ 
  secondsUntilNext, 
  nextWindowDay,
  nextWindowTime 
}: WithdrawalCountdownProps) => {
  const [timeLeft, setTimeLeft] = useState(secondsUntilNext);
  
  useEffect(() => {
    setTimeLeft(secondsUntilNext);
    
    const interval = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [secondsUntilNext]);
  
  const days = Math.floor(timeLeft / 86400);
  const hours = Math.floor((timeLeft % 86400) / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;
  
  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <Clock className="h-5 w-5 text-orange-600 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-orange-900 mb-1">
            Next Withdrawal Window
          </p>
          <p className="text-xs text-orange-700 mb-2">
            {nextWindowDay} at {nextWindowTime} UTC
          </p>
          <div className="flex gap-2 font-mono text-lg font-bold text-orange-900">
            {days > 0 && <span>{String(days).padStart(2, '0')}d</span>}
            <span>{String(hours).padStart(2, '0')}h</span>
            <span>:</span>
            <span>{String(minutes).padStart(2, '0')}m</span>
            <span>:</span>
            <span>{String(seconds).padStart(2, '0')}s</span>
          </div>
        </div>
      </div>
    </div>
  );
};
