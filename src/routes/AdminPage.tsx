import Dashboard from '../components/Dashboard';

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      <Dashboard onLocationSelect={() => {}} />
      <main className="max-w-5xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin Panel</h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          This is a placeholder admin area available only for users with the Admin role.
        </p>
      </main>
    </div>
  );
}

