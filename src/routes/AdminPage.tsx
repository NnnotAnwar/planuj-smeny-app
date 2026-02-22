import Dashboard from '../components/Dashboard';

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Dashboard user={null} />
      <main className="max-w-5xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <p className="text-gray-600 text-sm">
          This is a placeholder admin area available only for users with the Admin role.
        </p>
      </main>
    </div>
  );
}

