import { UserIcon, BellIcon, ShieldCheckIcon, PaletteIcon, CaretRightIcon } from "@phosphor-icons/react";
import { useAuthContext } from "@features/auth/AuthContext";
import { useTheme } from "@app/providers/ThemeContext";

/**
 * --- SETTINGS PAGE ---
 * Unified style with the rest of the app.
 */

export default function SettingsPage() {
  const { user } = useAuthContext();
  const { resolvedTheme, setTheme } = useTheme();

  const sections = [
    {
      title: 'Personal',
      items: [
        { name: 'Profile Information', icon: UserIcon, detail: user?.username },
        { name: 'Notifications', icon: BellIcon, detail: 'Push, Email' },
      ]
    },
    {
      title: 'Appearance',
      items: [
        { 
          name: 'Dark Mode', 
          icon: PaletteIcon, 
          detail: resolvedTheme === 'dark' ? 'Enabled' : 'Disabled',
          action: () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
        },
      ]
    },
    {
      title: 'Security',
      items: [
        { name: 'Change Password', icon: ShieldCheckIcon, detail: 'Last changed 3mo ago' },
      ]
    }
  ];

  return (
    <div className="space-y-6 px-1 max-w-2xl">
      <header className="space-y-0.5">
        <p className="text-emerald-500 font-bold text-[10px] uppercase tracking-widest">Preferences</p>
        <h1 className="text-gray-900 dark:text-white font-black text-2xl tracking-tight">Settings</h1>
      </header>

      {/* USER PREVIEW */}
      <div className="p-4 bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-3xl shadow-sm flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 border-2 border-white dark:border-white/10 flex items-center justify-center text-emerald-700 dark:text-emerald-400 text-lg font-black shrink-0">
          {user?.first_name?.[0] || user?.username?.[0]}
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
            {user?.first_name} {user?.last_name}
          </h2>
          <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
            {user?.role.name} • {user?.organization_id}
          </p>
        </div>
      </div>

      <div className="space-y-6 mt-8">
        {sections.map((section) => (
          <div key={section.title} className="space-y-2">
            <h3 className="px-1 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{section.title}</h3>
            <div className="bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-3xl shadow-sm overflow-hidden">
              {section.items.map((item, idx) => (
                <button
                  key={item.name}
                  onClick={() => item.action && item.action()}
                  className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left ${
                    idx !== section.items.length - 1 ? 'border-b border-gray-50 dark:border-white/5' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-gray-50 dark:bg-gray-900/50 flex items-center justify-center text-gray-500 dark:text-gray-400 shrink-0">
                      <item.icon weight="bold" className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{item.name}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">{item.detail}</p>
                    </div>
                  </div>
                  <CaretRightIcon weight="bold" className="w-4 h-4 text-gray-300 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="pt-6 text-center">
        <p className="text-[10px] font-bold text-gray-300 dark:text-gray-600 uppercase tracking-widest">
          Version 1.0.4 • 2026
        </p>
      </div>
    </div>
  );
}
