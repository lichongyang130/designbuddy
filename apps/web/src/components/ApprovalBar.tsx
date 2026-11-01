import type { ApprovalRequest } from '../types'

interface Props {
  requests: ApprovalRequest[]
  onDecide: (id: string, allow: boolean) => void
}

/**
 * The human-in-the-loop gate, rendered where the decision belongs: above the
 * composer, next to what the user just asked for. The model is blocked inside
 * the tool executor while this is on screen.
 */
export function ApprovalBar({ requests, onDecide }: Props) {
  if (!requests.length) return null
  return (
    <div className="approval-bar">
      {requests.map((request) => (
        <div className="approval" key={request.id}>
          <div className="approval-head">
            <span className={`scope-dot ${request.scope}`} />
            <span className="approval-title">
              <b>{request.tool}</b> 想要修改你的东西
            </span>
            <span className="approval-agent">{request.agent}</span>
          </div>
          <pre className="approval-args">{formatArgs(request.args)}</pre>
          <div className="approval-actions">
            <button className="btn btn-small btn-primary" onClick={() => onDecide(request.id, true)}>
              允许这次
            </button>
            <button className="btn btn-small" onClick={() => onDecide(request.id, false)}>
              拒绝
            </button>
            <span className="approval-hint">超时会自动拒绝</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function formatArgs(args: Record<string, unknown>): string {
  return Object.entries(args)
    .map(([key, value]) => {
      const text = typeof value === 'string' ? value : JSON.stringify(value)
      return `${key}: ${text.length > 220 ? `${text.slice(0, 220)}…` : text}`
    })
    .join('\n')
}
