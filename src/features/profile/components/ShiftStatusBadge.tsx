import { LiveClockIcon } from '@shared/components/LiveClockIcon';
import { formatTime } from '@shared/utils/date';
import { useUserStatus } from '../hooks/useUserStatus';

/**
 * Live "currently working" pill for a profile. Green + animated when the user
 * has an open shift (showing where and since when), muted grey when off shift.
 */
export function ShiftStatusBadge({ userId }: { userId: string }) {
    const { data: status, isLoading } = useUserStatus(userId);

    if (isLoading) return null;

    if (!status) {
        return (
            <div className="flex items-center gap-2 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 px-4 py-3">
                <LiveClockIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" isActive={false} />
                <span className="text-body-strong text-gray-500 dark:text-gray-400">Not on shift</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-100 dark:border-emerald-900/30 px-4 py-3">
            <LiveClockIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" isActive={true} />
            <span className="min-w-0 text-body-strong text-emerald-700 dark:text-emerald-400 truncate">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 align-middle" />
                On shift{status.location_name ? ` · ${status.location_name}` : ''}
            </span>
            <span className="ml-auto shrink-0 text-caption text-emerald-600/80 dark:text-emerald-400/70">
                since {formatTime(status.started_at)}
            </span>
        </div>
    );
}
