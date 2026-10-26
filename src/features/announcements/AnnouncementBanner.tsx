import { Link } from 'react-router-dom';
import { MegaphoneIcon } from '@phosphor-icons/react';
import { useAuthContext } from '@/features/auth/AuthContext';
import { useAnnouncements } from './useAnnouncements';

export function AnnouncementBanner() {
    const { user } = useAuthContext();
    const { list } = useAnnouncements(user);

    // Последнее ЗАКРЕПЛЁННОЕ объявление (список уже отсортирован: pinned сверху).
    const latest = list.data?.find((a) => a.pinned);
    if (!latest) return null; // нечего показывать — не рисуем ничего

    return (
        <Link
            to="/announcements"
            className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/30 dark:bg-amber-900/10"
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