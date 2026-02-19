import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
    const user = {
        username: 'Ahmed Taha',
        role: 'Admin',
    };

    const navigate = useNavigate();

    const handleAdminClick = () => {
        navigate('/admin');
    };

    const handleLoginClick = () => {
        navigate('/login');
    };

    const handleLogout = () => {
        navigate('/login', { replace: true });
    };


    return (
        <header className="md:flex items-center sticky top-0 z-50 justify-between px-6 py-4 bg-white shadow-sm border-b border-gray-100">
            <a href='/' className="flex items-center space-x-4 mb-4 md:mb-0">

                <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center shadow-sm">
                    <span className="text-white font-bold text-xl">PS</span>
                </div>
                <span className="text-xl font-bold text-gray-800 tracking-tight">Planuj Směny</span>

            </a>

            <div className="flex items-center space-x-4">
                {user && (
                    <div className="hidden md:block text-right text-sm">
                        <p className="font-semibold text-gray-800">{user.username}</p>
                        <p className="text-xs text-gray-500">{user.role}</p>
                    </div>
                )}

                {user?.role === 'Admin' && (
                    <button
                        type="button"
                        onClick={handleAdminClick}
                        className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                    >
                        Admin Panel
                    </button>
                )}

                {user ? (
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors shadow-sm active:scale-95"
                    >
                        Logout
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={handleLoginClick}
                        className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors shadow-sm active:scale-95"
                    >
                        Login
                    </button>
                )}
            </div>
        </header>
    );
}