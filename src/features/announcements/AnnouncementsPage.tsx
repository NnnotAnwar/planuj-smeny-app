import { useAuthContext } from '@/features/auth/AuthContext';
import { Skeleton } from '@shared/components/Skeleton';
import { useAnnouncements } from './useAnnouncements';
import { formatDateShort } from '@shared/utils/date';
import { useAnnouncementReads } from './reads/useAnnouncementReads';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import {
  PushPinIcon,
  PencilSimpleIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { useTranslation } from '@shared/preferences/PreferencesContext';

export function AnnouncementsPage() {
  const { user } = useAuthContext();
  const { list, create, update, remove } = useAnnouncements(user);
  const { readIds, markRead } = useAnnouncementReads(user);
  const t = useTranslation();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const isManager = (user?.role.rank ?? 0) >= 20;

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setBody('');
  };

  const startEdit = (a: { id: string; title: string; body: string }) => {
    setEditingId(a.id);
    setTitle(a.title);
    setBody(a.body);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = () => {
    if (editingId) {
      update.mutate(
        { id: editingId, patch: { title, body } },
        { onSuccess: resetForm },
      );
    } else {
      create.mutate({ title, body }, { onSuccess: resetForm });
    }
  };

  return (
    <div className="space-y-4 px-1 pb-10">
      <header className="pt-2">
        <p className="text-label text-emerald-500">
          {t('announcements.section')}
        </p>
        <h1 className="text-display text-gray-900 dark:text-white">
          {t('announcements.heading')}
        </h1>
      </header>

      {isManager && (
        <div className="space-y-2 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('announcements.titlePlaceholder')}
            className="text-body w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500/40 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('announcements.bodyPlaceholder')}
            className="text-body min-h-20 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500/40 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <div className="flex justify-end gap-2">
            {editingId && (
              <button
                onClick={resetForm}
                className="text-body-strong rounded-xl bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                {t('common.cancel')}
              </button>
            )}
            <button
              onClick={submit}
              disabled={
                !title.trim() ||
                !body.trim() ||
                create.isPending ||
                update.isPending
              }
              className="text-body-strong rounded-xl bg-emerald-600 px-4 py-2 text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {editingId
                ? update.isPending
                  ? t('common.saving')
                  : t('common.save')
                : create.isPending
                  ? t('announcements.posting')
                  : t('announcements.post')}
            </button>
          </div>
        </div>
      )}

      {/* 1) Пока грузится — скелетоны */}
      {list.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      )}

      {/* Запрос упал — это НЕ то же самое, что пустой список */}
      {list.isError && (
        <p className="text-body py-10 text-center text-red-500">
          {t('announcements.error')}
        </p>
      )}

      {/* 2) Загрузилось, но пусто */}
      {!list.isLoading && !list.isError && (list.data?.length ?? 0) === 0 && (
        <p className="text-body py-10 text-center text-gray-400">
          {t('announcements.empty')}
        </p>
      )}

      {/* 3) Список: по карточке на каждое объявление */}
      <div className="flex flex-col gap-3">
        <AnimatePresence>
          {list.data?.map((a) => {
            const isNew = !readIds.has(a.id);
            return (
              <motion.article
                key={a.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                onClick={() => markRead.mutate(a.id)}
                className="cursor-pointer rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {a.pinned && (
                      <span className="text-micro mb-0.5 inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                        <PushPinIcon weight="fill" className="h-3.5 w-3.5" />
                        {t('announcements.pinned')}
                      </span>
                    )}
                    <h2 className="text-body-strong text-gray-900 dark:text-white">
                      {a.title}
                    </h2>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <AnimatePresence>
                      {isNew && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.6 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.6 }}
                          transition={{ duration: 0.2 }}
                          className="text-micro shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                        >
                          {t('announcements.new')}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                <p className="text-body mt-1 whitespace-pre-wrap text-gray-600 dark:text-gray-300">
                  {a.body}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-micro text-gray-400">
                    {a.author?.username
                      ? t('announcements.postedBy', { name: a.author.username })
                      : t('announcements.fallbackAuthor')}{' '}
                    · {formatDateShort(a.created_at)}
                  </p>
                  {isManager &&
                    (confirmDeleteId === a.id ? (
                      <div className="text-micro flex shrink-0 items-center gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            remove.mutate(a.id);
                            setConfirmDeleteId(null);
                          }}
                          className="font-semibold text-red-500"
                        >
                          {t('common.delete')}?
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(null);
                          }}
                          className="text-gray-400"
                        >
                          {t('common.cancel')}
                        </button>
                      </div>
                    ) : (
                      <div className="flex shrink-0 items-center gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEdit(a);
                          }}
                          title={t('common.edit')}
                          className="text-gray-400 transition-colors hover:text-emerald-500"
                        >
                          <PencilSimpleIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(a.id);
                          }}
                          title={t('common.delete')}
                          className="text-gray-400 transition-colors hover:text-red-500"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            update.mutate({
                              id: a.id,
                              patch: { pinned: !a.pinned },
                            });
                          }}
                          title={
                            a.pinned
                              ? t('announcements.unpin')
                              : t('announcements.pin')
                          }
                          className={`transition-colors ${a.pinned ? 'text-amber-500' : 'text-gray-400 hover:text-amber-500'}`}
                        >
                          <PushPinIcon
                            weight={a.pinned ? 'fill' : 'regular'}
                            className="h-5 w-5"
                          />
                        </button>
                      </div>
                    ))}
                </div>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
