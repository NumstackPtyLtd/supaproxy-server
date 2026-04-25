import { Zap, Send, Loader2 } from 'lucide-react';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { Modal } from '../shared/Modal';
import { useTestQuery } from '../../hooks/useTestQuery';

interface TestPlaygroundProps {
  workspaceId: string;
  workspaceName: string;
  onClose: () => void;
}

export default function TestPlayground({ workspaceId, workspaceName, onClose }: TestPlaygroundProps) {
  const {
    conversation,
    queryInput,
    setQueryInput,
    clearConversation,
    sendQuery,
    queryState,
    chatEndRef,
  } = useTestQuery(workspaceId);

  const isSubmitting = queryState.status === 'submitting';

  return (
    <Modal onClose={onClose} title="Test playground" maxWidth="max-w-2xl">
      <ErrorBoundary>
      <div className="h-[460px] flex flex-col overflow-hidden">
        {/* Subheader with workspace name and clear */}
        <div className="flex items-center justify-between px-5 py-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-heading" />
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{workspaceName}</span>
          </div>
          {conversation.length > 0 && (
            <button onClick={clearConversation} className="text-[11px] transition-colors" style={{ color: 'var(--text-muted)' }}>Clear</button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {conversation.length === 0 && !isSubmitting && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Zap size={20} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Test your workspace. Ask it anything.</p>
              </div>
            </div>
          )}
          {conversation.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[85%]">
                <div className={`px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-black text-white rounded-lg rounded-br-none'
                    : 'rounded-lg rounded-bl-none text-heading'
                }`}
                  style={m.role === 'assistant' ? { background: 'var(--bg-surface)', border: '1px solid var(--border-color)' } : undefined}>
                  {m.role === 'assistant' ? <div className="whitespace-pre-wrap">{m.content}</div> : m.content}
                </div>
                {m.meta && (
                  <div className="flex gap-3 mt-1.5 px-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {m.meta.tools && m.meta.tools.length > 0 && <span className="text-heading">{m.meta.tools.length} tools called</span>}
                    {m.meta.tokens && <span>{m.meta.tokens.input + m.meta.tokens.output} tokens</span>}
                    {m.meta.cost != null && <span>${m.meta.cost.toFixed(4)}</span>}
                    {m.meta.duration && <span>{(m.meta.duration / 1000).toFixed(1)}s</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isSubmitting && (
            <div className="flex justify-start">
              <div className="rounded-lg rounded-bl-none px-3.5 py-2.5 inline-flex items-center gap-1.5"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="px-5 py-3" style={{ borderTop: '1px solid var(--border-color)' }}>
          <div className="flex gap-2 items-center rounded-sm px-3 focus-within:ring-2 focus-within:ring-primary/20 transition-colors"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
            <input type="text" value={queryInput} onChange={(e) => setQueryInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') sendQuery(); }}
              placeholder="Ask a question..." disabled={isSubmitting} autoFocus
              className="flex-1 py-2.5 text-[13px] text-heading placeholder-muted focus:outline-none bg-transparent disabled:opacity-50" />
            <button onClick={sendQuery} disabled={isSubmitting || !queryInput.trim()}
              className="disabled:opacity-30 transition-colors p-1" style={{ color: 'var(--text-muted)' }}>
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      </div>
      </ErrorBoundary>
    </Modal>
  );
}
