import { useEffect, useState } from 'react';
import { logger } from '@/utils/logger';

export function LogViewer() {
  const [logs, setLogs] = useState<Array<{
    timestamp: string;
    level: string;
    message: string;
    data?: any;
  }>>([]);

  useEffect(() => {
    setLogs(logger.getLogs());
    const interval = setInterval(() => {
      setLogs(logger.getLogs());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCopyLogs = async () => {
    try {
      const formattedLogs = logs.map(log => {
        const dataStr = log.data ? `\nData: ${JSON.stringify(log.data, null, 2)}` : '';
        return `[${log.timestamp}] ${log.level}: ${log.message}${dataStr}`;
      }).join('\n\n');

      await navigator.clipboard.writeText(formattedLogs);
      alert('로그가 클립보드에 복사되었습니다.');
    } catch (error) {
      console.error('로그 복사 중 오류:', error);
      alert('로그 복사 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="fixed bottom-20 right-4 w-1/3 max-w-lg h-1/3 bg-black bg-opacity-90 text-white p-2 overflow-auto text-xs font-mono rounded-lg shadow-lg z-50">
      <div className="sticky top-0 flex justify-between items-center mb-2 bg-black bg-opacity-90 py-1">
        <h3 className="text-sm font-semibold">로그 뷰어</h3>
        <button 
          onClick={handleCopyLogs}
          className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
        >
          로그 복사
        </button>
      </div>
      <div className="space-y-1 h-[calc(100%-2rem)] overflow-auto">
        {logs.map((log, index) => (
          <div 
            key={index} 
            className={`${
              log.level === 'ERROR' ? 'text-red-400' :
              log.level === 'WARN' ? 'text-yellow-400' :
              'text-green-400'
            } text-xs`}
          >
            <span className="opacity-50">[{log.timestamp}]</span>{' '}
            <span className="font-bold">{log.level}:</span>{' '}
            {log.message}
            {log.data && (
              <pre className="ml-4 text-gray-400 whitespace-pre-wrap break-words text-[10px]">
                {JSON.stringify(log.data, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 