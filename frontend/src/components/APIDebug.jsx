import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export function APIDebugPanel() {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [storageInfo, setStorageInfo] = useState({});

  useEffect(() => {
    // Get storage info
    try {
      const token = localStorage.getItem('session_token');
      setStorageInfo({
        hasToken: !!token,
        tokenLength: token?.length || 0,
        storage: 'localStorage available'
      });
    } catch (e) {
      try {
        const token = sessionStorage.getItem('session_token');
        setStorageInfo({
          hasToken: !!token,
          tokenLength: token?.length || 0,
          storage: 'sessionStorage (localStorage unavailable)'
        });
      } catch (e2) {
        setStorageInfo({
          hasToken: false,
          storage: 'No storage available (private mode)'
        });
      }
    }

    // Intercept console.log for API calls
    const originalLog = console.log;
    console.log = (...args) => {
      if (typeof args[0] === 'string' && (args[0].includes('📡') || args[0].includes('🔌'))) {
        setLogs(l => [...l.slice(-9), { time: new Date().toLocaleTimeString(), msg: args.join(' ') }]);
      }
      originalLog.apply(console, args);
    };

    return () => { console.log = originalLog; };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 font-mono text-xs w-80">
      <button
        onClick={() => setOpen(!open)}
        className="w-full bg-[#1A1A1A] border border-[#2A2A2A] p-2 rounded-sm flex items-center justify-between text-[#4FC3C3] hover:bg-[#2A2A2A] transition-colors mb-1"
      >
        <span>🔧 API Debug</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-3 space-y-2">
          <div className="bg-[#0A0A0A] p-2 rounded border border-[#2A2A2A]">
            <p className="text-[#6B6B6B] mb-1">Storage:</p>
            <p className="text-[#4FC3C3]">{storageInfo.storage}</p>
            {storageInfo.hasToken && <p className="text-[#10B981]">✓ Token present ({storageInfo.tokenLength} bytes)</p>}
            {!storageInfo.hasToken && <p className="text-[#EF4444]">✗ No token found</p>}
          </div>
          <div className="bg-[#0A0A0A] p-2 rounded border border-[#2A2A2A]">
            <p className="text-[#6B6B6B] mb-1">Recent API Calls:</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-[#6B6B6B]" >No API calls yet</p>
              ) : (
                logs.map((log, i) => (
                  <p key={i} className="text-[#A3A3A3] break-words">
                    <span className="text-[#6B6B6B]">[{log.time}]</span> {log.msg}
                  </p>
                ))
              )}
            </div>
          </div>
          <p className="text-[#6B6B6B] text-xs text-center">
            Open F12 Console for full details
          </p>
        </div>
      )}
    </div>
  );
}
