import { useAuthContext } from '@/features/auth/AuthContext';
import { Skeleton } from '@shared/components/Skeleton';
import { useAnnouncements } from './useAnnouncements';
import { formatDateShort } from '@shared/utils/date';
import { useAnnouncementReads } from './reads/useAnnouncementReads';
import { AnimatePresence, motion } from 'framer-motion';

export function AnnouncementsPage() {
    const { user } = useAuthContext();
    const { list } = useAnnouncements(user);
    const { readIds, markRead } = useAnnouncementReads(user);

    return (
        <div className="space-y-4 px-1 pb-10">
            <header className="pt-2">
                <p className="text-label text-emerald-500">Team</p>
                <h1 className="text-display text-gray-900 dark:text-white">Announcements</h1>
            </header>

            {/* 1) Пока грузится — скелетоны */}
            {list.isLoading && (
                <div className="space-y-3">
                    <Skeleton className="h-24 rounded-2xl" />
                    <Skeleton className="h-24 rounded-2xl" />
                </div>
            )}

            {/* Запрос упал — это НЕ то же самое, что пустой список */}
      {list.isError && (
        <p className="text-body text-red-500 py-10 text-center">
          Couldn't load announcements. Please try again.
        </p>
      )}

            {/* 2) Загрузилось, но пусто */}
                  {!list.isLoading && !list.isError && (list.data?.length ?? 0) === 0 && (
        <p className="text-body text-gray-400 py-10 text-center">No announcements yet.</p>
      )}

            {/* 3) Список: по карточке на каждое объявление */}
            <div className="space-y-3">
                {list.data?.map((a) => {
                    const isNew = !readIds.has(a.id);
                    return (
                        <article
                        key={a.id}
                        onClick={() => markRead.mutate(a.id)}
                        className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 cursor-pointer"
                        >
                        <div className="flex items-start justify-between gap-2">
                            <h2 className="text-body-strong text-gray-900 dark:text-white">{a.title}</h2>
                            <AnimatePresence>
                                {isNew && (
                                    <motion.span
                                        initial={{ opacity: 0, scale: 0.6 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.6 }}
                                        transition={{ duration: 0.2 }}
                                        className="shrink-0 text-micro font-semibold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full px-2 py-0.5"
                                    >
                                        New
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </div>
                        <p className="text-body text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap">{a.body}</p>
                        <p className="text-micro text-gray-400 mt-2">
                            {a.author?.username ? `Posted by ${a.author.username}` : 'Announcement'} · {formatDateShort(a.created_at)}
                        </p>
                        </article>
                    );
                })}
            </div>
        </div>
    );
};