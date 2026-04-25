import type { ReactNode } from 'react';
import { MessageCircle, Plug, Snowflake, CheckCircle, AlertTriangle, HelpCircle, Zap, User } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { logWarn } from '../../lib/logger';
import type { TimelineEvent, Conversation, ConversationMessage, ConversationStats } from '../../types/conversations';
import { getConsumer } from '../../lib/registries/consumers';
import { ChannelIcon, fmtTime, fmtDateTime, safeParseJSON } from '../shared/ConversationUI';

/* ── Layout wrapper for every timeline node ── */

export function TimelineNode({ icon, iconClass, iconStyle, children }: { icon: ReactNode; iconClass: string; iconStyle?: React.CSSProperties; children: ReactNode }) {
  return (
    <div className="flex gap-3.5 pb-5 relative">
      <div className={`w-[19px] h-[19px] rounded-full flex-shrink-0 mt-0.5 z-10 flex items-center justify-center ${iconClass}`} style={iconStyle}>
        {icon}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">{children}</div>
    </div>
  );
}

/* ── Safe markdown renderer ── */

function Markdown({ content }: { content: string }) {
  let html: string;
  try {
    html = DOMPurify.sanitize(marked.parse(content, { breaks: true }) as string);
  } catch (err) {
    logWarn('Markdown parse failed:', err);
    html = DOMPurify.sanitize(content);
  }
  return (
    <div
      className="text-[12px] leading-relaxed prose-msg"
      style={{ color: 'var(--body)' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/* ── Individual event renderers ── */

function OpenedEvent({ data, time }: { data: Conversation; time: string }) {
  return (
    <TimelineNode icon={<Zap size={9} style={{ color: 'var(--color-info)' }} />} iconClass="border-2" iconStyle={{ background: 'color-mix(in srgb, var(--color-info) 20%, transparent)', borderColor: 'color-mix(in srgb, var(--color-info) 40%, transparent)' }}>
      <div className="flex items-center gap-2 text-[12px]">
        <span className="font-medium text-heading">Conversation opened</span>
        <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
          via <ChannelIcon type={data.consumer_type} size={11} /> {getConsumer(data.consumer_type).label}
        </span>
      </div>
      <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
        {fmtDateTime(time)}
        {data.user_name && <> · initiated by <span className="text-heading">{data.user_name}</span></>}
      </div>
    </TimelineNode>
  );
}

function MessageNode({ data, userName }: { data: ConversationMessage; userName: string }) {
  const tools = safeParseJSON<string>(data.tools_called);
  const connections = safeParseJSON<string>(data.connections_hit);
  const isUser = data.role === 'user';

  return (
    <div className="flex gap-3.5 pb-5 relative">
      <div
        className="w-[19px] h-[19px] rounded-full flex-shrink-0 mt-0.5 z-10 flex items-center justify-center"
        style={{
          background: isUser ? 'var(--bg-surface)' : 'var(--bg-hover)',
          border: '2px solid var(--border-color)',
        }}
      >
        {isUser
          ? <User size={9} style={{ color: 'var(--text-heading)' }} />
          : <MessageCircle size={9} style={{ color: 'var(--text-muted)' }} />}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[12px] font-medium text-heading">{isUser ? (userName || 'User') : 'Assistant'}</span>
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{fmtTime(data.created_at)}</span>
          {!isUser && data.duration_ms > 0 && (
            <span className="text-[10px] font-mono px-1 py-0.5 rounded" style={{ color: 'var(--text-muted)', background: 'var(--bg-surface)' }}>
              {data.duration_ms < 1000 ? `${data.duration_ms}ms` : `${(data.duration_ms / 1000).toFixed(1)}s`}
            </span>
          )}
          {!isUser && data.cost_usd && parseFloat(data.cost_usd) > 0 && (
            <span className="text-[10px] font-mono px-1 py-0.5 rounded" style={{ color: 'var(--text-muted)', background: 'var(--bg-surface)' }}>
              ${parseFloat(data.cost_usd).toFixed(4)}
            </span>
          )}
        </div>

        <Markdown content={data.content || ''} />

        {!isUser && tools.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {tools.map((t, ti) => (
              <span key={ti} className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-sm text-heading" style={{ background: 'var(--bg-hover)' }}>
                <Zap size={8} />{t}
              </span>
            ))}
          </div>
        )}
        {!isUser && connections.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {connections.map((cn, ci) => (
              <span key={ci} className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-sm" style={{ background: 'color-mix(in srgb, var(--color-info) 10%, transparent)', color: 'var(--color-info)' }}>
                <Plug size={8} />{cn}
              </span>
            ))}
          </div>
        )}
        {!isUser && data.tokens_input > 0 && (
          <div className="mt-1.5 text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
            {data.tokens_input.toLocaleString()} in · {data.tokens_output?.toLocaleString() || 0} out
          </div>
        )}
        {!isUser && data.query_error && (
          <div className="mt-1.5 text-[10px] text-error font-medium">{data.query_error}</div>
        )}
      </div>
    </div>
  );
}

function ColdEvent({ time }: { time: string }) {
  return (
    <TimelineNode icon={<Snowflake size={9} style={{ color: 'var(--color-warning)' }} />} iconClass="border-2" iconStyle={{ background: 'color-mix(in srgb, var(--color-warning) 20%, transparent)', borderColor: 'color-mix(in srgb, var(--color-warning) 40%, transparent)' }}>
      <div className="text-[12px] font-medium" style={{ color: 'var(--color-warning)' }}>Went cold</div>
      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{fmtDateTime(time)} · Inactivity timeout</div>
    </TimelineNode>
  );
}

function ViolationEvent({ data }: { data: { rule: string; description: string } }) {
  return (
    <TimelineNode icon={<AlertTriangle size={9} style={{ color: 'var(--color-danger)' }} />} iconClass="border-2" iconStyle={{ background: 'color-mix(in srgb, var(--color-danger) 20%, transparent)', borderColor: 'color-mix(in srgb, var(--color-danger) 40%, transparent)' }}>
      <div className="text-[12px] font-medium" style={{ color: 'var(--color-danger)' }}>Violation: {data.rule}</div>
      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{data.description}</div>
    </TimelineNode>
  );
}

function GapEvent({ data }: { data: { topic: string; description: string } }) {
  return (
    <TimelineNode icon={<HelpCircle size={9} style={{ color: 'var(--color-warning)' }} />} iconClass="border-2" iconStyle={{ background: 'color-mix(in srgb, var(--color-warning) 20%, transparent)', borderColor: 'color-mix(in srgb, var(--color-warning) 40%, transparent)' }}>
      <div className="text-[12px] font-medium" style={{ color: 'var(--color-warning)' }}>Knowledge gap: {data.topic}</div>
      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{data.description}</div>
    </TimelineNode>
  );
}

function ClosedEvent({ data, time }: { data: { conversation: Conversation; stats: ConversationStats | null }; time: string }) {
  return (
    <div className="flex gap-3.5 pb-5 relative">
      <div
        className="w-[19px] h-[19px] rounded-full flex-shrink-0 mt-0.5 z-10 flex items-center justify-center"
        style={{ background: 'var(--bg-hover)', border: '2px solid var(--border-color)' }}
      >
        <CheckCircle size={9} style={{ color: 'var(--text-muted)' }} />
      </div>
      <div className="pt-0.5">
        <div className="text-[12px] text-heading font-medium">Conversation closed</div>
        <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {fmtDateTime(time)}
          {data.stats?.resolution_status && <> · {data.stats.resolution_status}</>}
        </div>
      </div>
    </div>
  );
}

/* ── Lookup registry: event type -> renderer ── */

type EventRenderer = (ev: TimelineEvent, index: number, userName: string) => ReactNode;

const EVENT_RENDERERS: Record<TimelineEvent['type'], EventRenderer> = {
  opened: (ev, i) => <OpenedEvent key={`opened-${i}`} data={ev.data as Conversation} time={ev.time} />,
  message: (ev, _i, userName) => {
    const msg = ev.data as ConversationMessage;
    return <MessageNode key={msg.id} data={msg} userName={userName} />;
  },
  cold: (ev, i) => <ColdEvent key={`cold-${i}`} time={ev.time} />,
  violation: (ev, i) => <ViolationEvent key={`v-${i}`} data={ev.data as { rule: string; description: string }} />,
  gap: (ev, i) => <GapEvent key={`g-${i}`} data={ev.data as { topic: string; description: string }} />,
  closed: (ev, i) => <ClosedEvent key={`closed-${i}`} data={ev.data as { conversation: Conversation; stats: ConversationStats | null }} time={ev.time} />,
};

export function renderTimelineEvent(ev: TimelineEvent, index: number, userName: string): ReactNode {
  const renderer = EVENT_RENDERERS[ev.type];
  return renderer ? renderer(ev, index, userName) : null;
}
