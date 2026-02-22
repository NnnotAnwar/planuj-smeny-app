import { type User } from '../types/types';

/** Props for the app header: current user or null. */
interface DashboardProps {
  user: Pick<User, 'username' | 'role'> | null;
}

/** Builds initials from full name (e.g. "Ahmed Taha" → "AT"). */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

/**
 * Sticky app header: logo, title, and current user avatar + role.
 * No nav actions (login/admin) while auth is disabled.
 */
export default function Dashboard({ user }: DashboardProps) {
  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-linear-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-200 group-hover:shadow-emerald-300 transition-all duration-300 transform group-hover:-translate-y-0.5">
              <span className="text-white font-black text-xl tracking-wider">PS</span>
            </div>
            <span className="font-extrabold text-gray-800 tracking-tight hidden md:inline text-2xl">
              Planuj Směny
            </span>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            {user && (
              <div className="flex items-center gap-3">
                <div className="hidden md:block text-right">
                  <p className="text-sm font-bold text-gray-900 leading-tight">{user.username}</p>
                  <p className="text-xs font-medium text-emerald-600">{user.role}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-100 border-2 border-emerald-200 flex items-center justify-center text-emerald-700 font-bold shadow-sm">
                  {getInitials(user.username)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
