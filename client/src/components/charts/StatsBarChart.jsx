import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function StatsBarChart({ data, title }) {
    const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6']

    return (
        <div style={{
            background: 'var(--bg-main)',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-sm)',
            height: '100%'
        }}>
            <h3 style={{
                fontSize: '1rem',
                fontWeight: '600',
                color: 'var(--text-primary)',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
            }}>
                <svg style={{ width: '20px', height: '20px', fill: 'var(--primary)' }} viewBox="0 0 24 24">
                    <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" />
                </svg>
                {title}
            </h3>

            {data && data.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                            dataKey="Name"
                            tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                            stroke="var(--border-color)"
                        />
                        <YAxis
                            tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                            stroke="var(--border-color)"
                        />
                        <Tooltip
                            contentStyle={{
                                background: 'var(--bg-surface)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                fontSize: '0.875rem'
                            }}
                        />
                        <Bar dataKey="Value" radius={[8, 8, 0, 0]}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            ) : (
                <div style={{
                    height: '250px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-light)',
                    fontSize: '0.875rem'
                }}>
                    No data available
                </div>
            )}
        </div>
    )
}
