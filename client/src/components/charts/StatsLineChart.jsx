import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function StatsLineChart({ data, title, userRole }) {
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
                    <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z" />
                </svg>
                {title}
            </h3>

            {data && data.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                            dataKey="Title"
                            tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                            stroke="var(--border-color)"
                            angle={-15}
                            textAnchor="end"
                            height={60}
                        />
                        <YAxis
                            domain={[0, 100]}
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
                        <Legend wrapperStyle={{ fontSize: '0.875rem' }} />

                        {userRole === 'student' ? (
                            <>
                                <Line
                                    type="monotone"
                                    dataKey="StudentScore"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    name="My Score (%)"
                                    dot={{ r: 4 }}
                                    activeDot={{ r: 6 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="AverageScore"
                                    stroke="#10b981"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    name="Class Avg (%)"
                                    dot={{ r: 4 }}
                                    activeDot={{ r: 6 }}
                                />
                            </>
                        ) : (
                            <Line
                                type="monotone"
                                dataKey="AverageScore"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                name="Average Score (%)"
                                dot={{ r: 4 }}
                                activeDot={{ r: 6 }}
                            />
                        )}
                    </LineChart>
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
                    No exam data available
                </div>
            )}
        </div>
    )
}
