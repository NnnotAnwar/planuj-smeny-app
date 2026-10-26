import { Link } from 'react-router-dom';
import { MegaphoneIcon } from '@phosphor-icons/react';
import { useAuthContext } from '@/features/auth/AuthContext';
import { useAnnouncements } from './useAnnouncements';
import { useAnnouncementReads } from './reads/useAnnouncementReads';

export function AnnouncementBanner() {
    const { user } = useAuthContext();
    const { list } = useAnnouncements(user);
    const { readIds, markRead } = useAnnouncementReads(user);

    // Последнее НЕпрочитанное (список уже отсортирован: pinned/свежие сверху).
    const latest = list.data?.find((a) => !readIds.has(a.id));
    if (!latest) return null; // всё прочитано — баннера нет

    return (
        <Link
            to="/announcements"
            onClick={() => markRead.mutate(latest.id)}
            className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/30 dark:bg-amber-900/10"
        >
            <MegaphoneIcon weight="fill" className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div className="min-w-0">
                <p className="text-body-strong truncate text-gray-900 dark:text-white">
                    {latest.title}
                </p>
                <p className="text-small truncate text-gray-500 dark:text-gray-400">
                    {latest.body}
                </p>
            </div>
        </Link>
    );
}