class Logger {
  private static MAX_LOG_SIZE = 1000; // 최대 로그 저장 개수
  private logs: Array<{
    timestamp: string;
    level: string;
    message: string;
    data?: any;
  }> = [];

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const dataString = data ? `\nData: ${JSON.stringify(data, null, 2)}` : '';
    return `[${timestamp}] ${level}: ${message}${dataString}`;
  }

  private saveLog(level: string, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    this.logs.push({ timestamp, level, message, data });
    
    // 로그 개수 제한
    if (this.logs.length > Logger.MAX_LOG_SIZE) {
      this.logs = this.logs.slice(-Logger.MAX_LOG_SIZE);
    }

    // localStorage에 저장 (선택적)
    try {
      localStorage.setItem('chat-logs', JSON.stringify(this.logs));
    } catch (e) {
      console.warn('Failed to save logs to localStorage');
    }
  }

  public getLogs() {
    return this.logs;
  }

  public clearLogs() {
    this.logs = [];
    try {
      localStorage.removeItem('chat-logs');
    } catch (e) {
      console.warn('Failed to clear logs from localStorage');
    }
  }

  public log(message: string, data?: any) {
    const formattedMessage = this.formatMessage('INFO', message, data);
    console.log(formattedMessage);
    this.saveLog('INFO', message, data);
  }

  public error(message: string, error?: Error | unknown) {
    const errorData = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error;

    const formattedMessage = this.formatMessage('ERROR', message, errorData);
    console.error(formattedMessage);
    this.saveLog('ERROR', message, errorData);
  }

  public warn(message: string, data?: any) {
    const formattedMessage = this.formatMessage('WARN', message, data);
    console.warn(formattedMessage);
    this.saveLog('WARN', message, data);
  }

  // 로그 다운로드 기능
  public downloadLogs() {
    const logText = this.logs
      .map(log => {
        const dataString = log.data ? `\nData: ${JSON.stringify(log.data, null, 2)}` : '';
        return `[${log.timestamp}] ${log.level}: ${log.message}${dataString}`;
      })
      .join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-logs-${new Date().toISOString()}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const logger = new Logger(); 