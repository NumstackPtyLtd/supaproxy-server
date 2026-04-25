import type { OrgUser } from '../../hooks/useOrgSettings';

interface Props {
  users: OrgUser[];
}

export default function UsersSection({ users }: Props) {
  return (
    <div className="max-w-[640px]">
      <h2 className="text-[15px] font-semibold mb-1" style={{ color: 'var(--text-heading)' }}>Users</h2>
      <p className="text-[12px] mb-5" style={{ color: 'var(--text-muted)' }}>Manage who has access to this organisation.</p>
      <div className="rounded-lg" style={{ border: '1px solid var(--border-color)' }}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{users.length} member{users.length !== 1 ? 's' : ''}</span>
          <button className="flex items-center gap-1 text-[12px] font-medium" style={{ color: 'var(--text-heading)' }}>+ Invite user</button>
        </div>
        {users.length > 0 ? (
          <table className="w-full text-[12px]">
            <thead><tr className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              <th className="text-left py-2 px-5 font-medium" style={{ borderBottom: '1px solid var(--border-color)' }}>Member</th>
              <th className="text-left py-2 px-5 font-medium w-24" style={{ borderBottom: '1px solid var(--border-color)' }}>Role</th>
              <th className="text-left py-2 px-5 font-medium w-24" style={{ borderBottom: '1px solid var(--border-color)' }}>Joined</th>
            </tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="last:border-0" style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td className="py-2.5 px-5">
                    <div className="font-medium" style={{ color: 'var(--text-heading)' }}>{u.name}</div>
                    <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{u.email}</div>
                  </td>
                  <td className="py-2.5 px-5">
                    <span className="text-[10px] font-medium uppercase" style={{ color: u.org_role === 'admin' ? 'var(--text-heading)' : 'var(--text-muted)' }}>{u.org_role}</span>
                  </td>
                  <td className="py-2.5 px-5" style={{ color: 'var(--text-muted)' }}>{new Date(u.created_at).toLocaleDateString('en-GB')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-[12px] px-5 py-4" style={{ color: 'var(--text-muted)' }}>No users found.</p>
        )}
      </div>
    </div>
  );
}
