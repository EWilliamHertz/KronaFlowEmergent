import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { API } from '../config/api';

export default function DiagnosticBar() {
  const [status, setStatus] = useState(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const checkAPI = async () => {
      try {
        const res = await fetch(API + '/dashboard/stats', {
          headers: {
            'Authorization': 'Bearer ' + localStorage.getItem('auth_token') || ''
          }
        });
        setStatus(res.ok ? 'ok' : 'error');
      } catch (err) {
        setStatus('error');
        console.error('\ud83d� Diagnostic: API check failed', err);
      }
    };
    checkAPI();
  }, []);

  if (!show && status !== 'error') return null;

  return (
    <div className={`fixed bottom-4 right-4 p-3 rounded-sm text-xs ${status === 'ok' ? 'bg-[#10B981]/20 border border-[#10B981] text-[#10B981]' : 'bg-[#EF4444]/20 border border-[#EF4444] text-[#EF4444]'} flex items-center gap-2 cursor-pointer z-50`}
      onClick={() => setShow(!show)}
    >
      {status === 'ok' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
      <span>
        {status === 'ok' ? '✓ API Connected' : '✗ API Error'} - API: {API}
      </span>
    </div>
  );
}
