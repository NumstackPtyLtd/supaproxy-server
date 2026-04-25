import { useState } from 'react';
import { useOrgQueues } from '../../hooks/useOrgSettings';

export default function QueuesSection() {
  const { queues, failedJobs, actionMsg, loadFailed, retryAll, drain } = useOrgQueues();
  const [expandedQueue, setExpandedQueue] = useState<string | null>(null);

  return (
    <div>
      <h2 className="text-[15px] font-semibold mb-1" style={{ color: 'var(--text-heading)' }}>Queues</h2>
      <p className="text-[12px] mb-5" style={{ color: 'var(--text-muted)' }}>Background job queues for conversation lifecycle. Auto-refreshes every 5 seconds.</p>
      {actionMsg && <div className="mb-3 py-2 text-[12px] text-success border-l-2 border-success pl-3">{actionMsg}</div>}

      <table className="w-full text-[12px] rounded-sm mb-6" style={{ border: '1px solid var(--border-color)' }}>
        <thead><tr className="text-[10px] uppercase tracking-wide" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
          <th className="text-left py-2 px-3 font-medium" style={{ borderBottom: '1px solid var(--border-color)' }}>Queue</th>
          <th className="text-right py-2 px-3 font-medium w-16" style={{ borderBottom: '1px solid var(--border-color)' }}>Active</th>
          <th className="text-right py-2 px-3 font-medium w-16" style={{ borderBottom: '1px solid var(--border-color)' }}>Waiting</th>
          <th className="text-right py-2 px-3 font-medium w-16" style={{ borderBottom: '1px solid var(--border-color)' }}>Delayed</th>
          <th className="text-right py-2 px-3 font-medium w-16" style={{ borderBottom: '1px solid var(--border-color)' }}>Failed</th>
          <th className="text-right py-2 px-3 font-medium w-20" style={{ borderBottom: '1px solid var(--border-color)' }}>Done</th>
          <th className="text-right py-2 px-3 font-medium w-24" style={{ borderBottom: '1px solid var(--border-color)' }}>Actions</th>
        </tr></thead>
        <tbody>
          {queues.map(q => (
            <tr key={q.name} className="last:border-0" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td className="py-2.5 px-3 font-medium" style={{ color: 'var(--text-heading)' }}>{q.name}</td>
              <td className="py-2.5 px-3 text-right">{q.active > 0 ? <span className="font-medium" style={{ color: 'var(--text-heading)' }}>{q.active}</span> : <span style={{ color: 'var(--text-muted)' }}>0</span>}</td>
              <td className="py-2.5 px-3 text-right">{q.waiting > 0 ? <span className="text-warning">{q.waiting}</span> : <span style={{ color: 'var(--text-muted)' }}>0</span>}</td>
              <td className="py-2.5 px-3 text-right" style={{ color: 'var(--text-muted)' }}>{q.delayed || 0}</td>
              <td className="py-2.5 px-3 text-right">{q.failed > 0 ? <span className="text-error font-medium">{q.failed}</span> : <span style={{ color: 'var(--text-muted)' }}>0</span>}</td>
              <td className="py-2.5 px-3 text-right text-success">{q.completed || 0}</td>
              <td className="py-2.5 px-3 text-right">
                <div className="flex gap-2 justify-end">
                  {q.failed > 0 && (
                    <button onClick={() => retryAll(q.name)} className="text-[10px]" style={{ color: 'var(--text-heading)' }}>Retry</button>
                  )}
                  <button onClick={() => { setExpandedQueue(expandedQueue === q.name ? null : q.name); loadFailed(q.name); }}
                    className="text-[10px] hover:opacity-80" style={{ color: 'var(--body)' }}>
                    {expandedQueue === q.name ? 'Hide' : 'Details'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {expandedQueue && (failedJobs[expandedQueue] || []).length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Failed jobs — {expandedQueue}</span>
            <button onClick={() => drain(expandedQueue)} className="text-[10px] px-2 py-0.5 rounded-sm hover:opacity-80"
              style={{ color: 'var(--body)', border: '1px solid var(--border-color)' }}>Drain</button>
          </div>
          <table className="w-full text-[11px] rounded-sm" style={{ border: '1px solid var(--border-color)' }}>
            <thead><tr className="text-[10px] uppercase tracking-wide" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
              <th className="text-left py-1.5 px-3 font-medium w-20" style={{ borderBottom: '1px solid var(--border-color)' }}>Job ID</th>
              <th className="text-left py-1.5 px-3 font-medium" style={{ borderBottom: '1px solid var(--border-color)' }}>Error</th>
              <th className="text-left py-1.5 px-3 font-medium w-24" style={{ borderBottom: '1px solid var(--border-color)' }}>Conversation</th>
              <th className="text-right py-1.5 px-3 font-medium w-16" style={{ borderBottom: '1px solid var(--border-color)' }}>Attempts</th>
            </tr></thead>
            <tbody>
              {failedJobs[expandedQueue].map(j => (
                <tr key={j.id} className="last:border-0" style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td className="py-1.5 px-3 font-mono" style={{ color: 'var(--text-muted)' }}>{j.id?.toString().slice(0, 8)}</td>
                  <td className="py-1.5 px-3 text-error truncate max-w-[300px]">{j.failedReason}</td>
                  <td className="py-1.5 px-3 font-mono" style={{ color: 'var(--body)' }}>{j.data?.conversationId?.slice(0, 8) || '-'}</td>
                  <td className="py-1.5 px-3 text-right" style={{ color: 'var(--text-muted)' }}>{j.attemptsMade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {expandedQueue && (failedJobs[expandedQueue] || []).length === 0 && (
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>No failed jobs in {expandedQueue}.</p>
      )}
    </div>
  );
}
