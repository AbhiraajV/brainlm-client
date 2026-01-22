'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    RefreshCw,
    Trash2,
    RotateCcw,
    AlertTriangle,
    Clock,
    CheckCircle2,
    XCircle,
    Loader2,
    Skull,
    ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import {
    getQueueHealth,
    clearOldCompletedJobs,
    retryFailedJobs,
    clearDeadLetterJobs,
    unstickJobs,
    type QueueHealth,
    type RecentJob
} from '@/server/actions/queue.actions';
import { JobStatus, JobType } from '@prisma/client';

export default function QueueHealthPage() {
    const [health, setHealth] = useState<QueueHealth | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [lastAction, setLastAction] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const fetchHealth = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getQueueHealth();
            setHealth(data);
        } catch (err) {
            console.error('Failed to fetch queue health:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHealth();
        // Auto-refresh every 30s
        const interval = setInterval(fetchHealth, 30000);
        return () => clearInterval(interval);
    }, [fetchHealth]);

    const handleAction = async (
        action: () => Promise<number>,
        actionName: string,
        successMessage: (count: number) => string
    ) => {
        try {
            setActionLoading(actionName);
            const count = await action();
            setLastAction({ message: successMessage(count), type: 'success' });
            await fetchHealth();
        } catch (err) {
            setLastAction({ message: `Failed: ${err}`, type: 'error' });
        } finally {
            setActionLoading(null);
        }
    };

    const formatDuration = (start: Date, end: Date | null) => {
        if (!end) return '-';
        const ms = new Date(end).getTime() - new Date(start).getTime();
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${(ms / 60000).toFixed(1)}m`;
    };

    const formatTimeAgo = (date: Date) => {
        const ms = Date.now() - new Date(date).getTime();
        if (ms < 60000) return 'just now';
        if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
        if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
        return `${Math.floor(ms / 86400000)}d ago`;
    };

    const getStatusColor = (status: JobStatus) => {
        switch (status) {
            case 'PENDING': return 'bg-yellow-100 text-yellow-800';
            case 'PROCESSING': return 'bg-blue-100 text-blue-800';
            case 'COMPLETED': return 'bg-green-100 text-green-800';
            case 'FAILED': return 'bg-red-100 text-red-800';
            case 'DEAD_LETTER': return 'bg-gray-800 text-white';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusIcon = (status: JobStatus) => {
        switch (status) {
            case 'PENDING': return <Clock className="w-3.5 h-3.5" />;
            case 'PROCESSING': return <Loader2 className="w-3.5 h-3.5 animate-spin" />;
            case 'COMPLETED': return <CheckCircle2 className="w-3.5 h-3.5" />;
            case 'FAILED': return <XCircle className="w-3.5 h-3.5" />;
            case 'DEAD_LETTER': return <Skull className="w-3.5 h-3.5" />;
            default: return null;
        }
    };

    const formatJobType = (type: JobType) => {
        return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    };

    if (loading && !health) {
        return (
            <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--color-bg)] pb-8">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-[var(--color-surface)] border-b border-[var(--color-line)] px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/" className="p-2 -ml-2 hover:bg-[var(--color-bg)] rounded-lg transition-colors">
                            <ArrowLeft className="w-5 h-5 text-[var(--color-muted)]" />
                        </Link>
                        <h1 className="text-lg font-semibold text-[var(--color-text)]">Queue Health</h1>
                    </div>
                    <button
                        onClick={fetchHealth}
                        disabled={loading}
                        className="p-2 hover:bg-[var(--color-bg)] rounded-lg transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-5 h-5 text-[var(--color-muted)] ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </header>

            {/* Action Feedback */}
            {lastAction && (
                <div className={`mx-4 mt-4 p-3 rounded-xl text-sm ${
                    lastAction.type === 'success'
                        ? 'bg-green-50 text-green-800 border border-green-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                    {lastAction.message}
                </div>
            )}

            {health && (
                <div className="px-4 space-y-4 mt-4">
                    {/* Stats Overview */}
                    <section className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm">
                        <h2 className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-3">
                            Overview
                        </h2>
                        <div className="grid grid-cols-3 gap-3">
                            <StatCard label="Total" value={health.stats.total} />
                            <StatCard label="Pending" value={health.stats.pending} color="yellow" />
                            <StatCard label="Processing" value={health.stats.processing} color="blue" />
                            <StatCard label="Completed" value={health.stats.completed} color="green" />
                            <StatCard label="Failed" value={health.stats.failed} color="red" />
                            <StatCard label="Dead Letter" value={health.stats.deadLetter} color="gray" />
                        </div>

                        {/* Alerts */}
                        {(health.stuckJobs > 0 || health.stats.failed > 0 || health.stats.deadLetter > 0) && (
                            <div className="mt-4 space-y-2">
                                {health.stuckJobs > 0 && (
                                    <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 p-2 rounded-lg">
                                        <AlertTriangle className="w-4 h-4" />
                                        <span>{health.stuckJobs} stuck job(s)</span>
                                    </div>
                                )}
                                {health.oldestPending && (
                                    <div className="text-xs text-[var(--color-muted)]">
                                        Oldest pending: {formatTimeAgo(health.oldestPending)}
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    {/* Actions */}
                    <section className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm">
                        <h2 className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-3">
                            Actions
                        </h2>
                        <div className="space-y-2">
                            <ActionButton
                                icon={<Trash2 className="w-4 h-4" />}
                                label="Clear completed (7+ days)"
                                loading={actionLoading === 'clear'}
                                onClick={() => handleAction(
                                    () => clearOldCompletedJobs(7),
                                    'clear',
                                    (n) => `Cleared ${n} old completed jobs`
                                )}
                            />
                            <ActionButton
                                icon={<RotateCcw className="w-4 h-4" />}
                                label="Retry all failed jobs"
                                loading={actionLoading === 'retry'}
                                disabled={health.stats.failed === 0}
                                onClick={() => handleAction(
                                    () => retryFailedJobs(),
                                    'retry',
                                    (n) => `Queued ${n} jobs for retry`
                                )}
                                variant="warning"
                            />
                            <ActionButton
                                icon={<RefreshCw className="w-4 h-4" />}
                                label="Unstick stuck jobs"
                                loading={actionLoading === 'unstick'}
                                disabled={health.stuckJobs === 0}
                                onClick={() => handleAction(
                                    () => unstickJobs(5),
                                    'unstick',
                                    (n) => `Unstuck ${n} jobs`
                                )}
                            />
                            <ActionButton
                                icon={<Skull className="w-4 h-4" />}
                                label="Clear dead letter queue"
                                loading={actionLoading === 'deadletter'}
                                disabled={health.stats.deadLetter === 0}
                                onClick={() => handleAction(
                                    clearDeadLetterJobs,
                                    'deadletter',
                                    (n) => `Cleared ${n} dead letter jobs`
                                )}
                                variant="danger"
                            />
                        </div>
                    </section>

                    {/* By Type */}
                    <section className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm">
                        <h2 className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-3">
                            By Job Type
                        </h2>
                        <div className="space-y-2">
                            {health.byType.map((t) => (
                                <div key={t.type} className="flex items-center justify-between py-2 border-b border-[var(--color-line)] last:border-0">
                                    <span className="text-sm text-[var(--color-text)]">
                                        {formatJobType(t.type)}
                                    </span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-medium">{t.count}</span>
                                        {t.failureRate > 0 && (
                                            <span className="text-xs text-red-600">
                                                {t.failureRate.toFixed(1)}% fail
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Recent Jobs */}
                    <section className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm">
                        <h2 className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-3">
                            Recent Jobs
                        </h2>
                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {health.recentJobs.map((job) => (
                                <JobRow key={job.id} job={job} formatTimeAgo={formatTimeAgo} formatDuration={formatDuration} getStatusColor={getStatusColor} getStatusIcon={getStatusIcon} formatJobType={formatJobType} />
                            ))}
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
    const colorClasses = {
        yellow: 'text-yellow-600',
        blue: 'text-blue-600',
        green: 'text-green-600',
        red: 'text-red-600',
        gray: 'text-gray-600',
    };

    return (
        <div className="bg-[var(--color-bg)] rounded-xl p-3 text-center">
            <div className={`text-2xl font-semibold ${color ? colorClasses[color as keyof typeof colorClasses] : 'text-[var(--color-text)]'}`}>
                {value}
            </div>
            <div className="text-xs text-[var(--color-muted)] mt-0.5">{label}</div>
        </div>
    );
}

function ActionButton({
    icon,
    label,
    loading,
    disabled,
    onClick,
    variant = 'default'
}: {
    icon: React.ReactNode;
    label: string;
    loading: boolean;
    disabled?: boolean;
    onClick: () => void;
    variant?: 'default' | 'warning' | 'danger';
}) {
    const variants = {
        default: 'bg-[var(--color-bg)] text-[var(--color-text)] hover:bg-[var(--color-line)]',
        warning: 'bg-amber-50 text-amber-800 hover:bg-amber-100',
        danger: 'bg-red-50 text-red-800 hover:bg-red-100',
    };

    return (
        <button
            onClick={onClick}
            disabled={loading || disabled}
            className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]}`}
        >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
            {label}
        </button>
    );
}

function JobRow({
    job,
    formatTimeAgo,
    formatDuration,
    getStatusColor,
    getStatusIcon,
    formatJobType
}: {
    job: RecentJob;
    formatTimeAgo: (d: Date) => string;
    formatDuration: (s: Date, e: Date | null) => string;
    getStatusColor: (s: JobStatus) => string;
    getStatusIcon: (s: JobStatus) => React.ReactNode;
    formatJobType: (t: JobType) => string;
}) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div
            className="border border-[var(--color-line)] rounded-xl overflow-hidden"
            onClick={() => setExpanded(!expanded)}
        >
            <div className="flex items-center justify-between p-3 cursor-pointer">
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--color-text)] truncate">
                        {formatJobType(job.type)}
                    </div>
                    <div className="text-xs text-[var(--color-muted)]">
                        {formatTimeAgo(job.createdAt)}
                    </div>
                </div>
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                    {getStatusIcon(job.status)}
                    {job.status}
                </div>
            </div>

            {expanded && (
                <div className="px-3 pb-3 pt-1 border-t border-[var(--color-line)] bg-[var(--color-bg)] text-xs space-y-1">
                    <div className="flex justify-between">
                        <span className="text-[var(--color-muted)]">ID</span>
                        <span className="font-mono">{job.id.slice(0, 12)}...</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-[var(--color-muted)]">Attempts</span>
                        <span>{job.attempts}/{job.maxAttempts}</span>
                    </div>
                    {job.startedAt && (
                        <div className="flex justify-between">
                            <span className="text-[var(--color-muted)]">Duration</span>
                            <span>{formatDuration(job.startedAt, job.completedAt)}</span>
                        </div>
                    )}
                    {job.lockedBy && (
                        <div className="flex justify-between">
                            <span className="text-[var(--color-muted)]">Worker</span>
                            <span className="font-mono">{job.lockedBy.slice(0, 8)}</span>
                        </div>
                    )}
                    {job.lastError && (
                        <div className="mt-2 p-2 bg-red-50 rounded-lg text-red-700 break-words">
                            {job.lastError}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
