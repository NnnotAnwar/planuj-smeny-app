import { useNavigate, Link } from 'react-router-dom';

// Описываем тип данных пользователя, которые принимает шапка
interface DashboardProps {
    user: {
        username: string;
        role: string;
    } | null;
}

export default function Dashboard({ user }: DashboardProps) {
    const navigate = useNavigate();

    // ===== ОБРАБОТЧИКИ КЛИКОВ =====
    const handleAdminClick = () => navigate('/admin');
    const handleLoginClick = () => navigate('/login');
    const handleLogout = () => navigate('/login', { replace: true });

    // Вспомогательная функция для получения инициалов (Ahmed Taha -> AT)
    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();
    };

    return (
        // ===== ГЛАВНЫЙ КОНТЕЙНЕР ШАПКИ =====
        // sticky top-0 z-50: прилипает к верху поверх остальных элементов
        // bg-white/80 backdrop-blur-md: эффект полупрозрачного матового стекла
        <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm transition-all duration-300">

            {/* Ограничиваем ширину контента, чтобы она совпадала с основным блоком */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">

                    {/* ===== ЛЕВАЯ ЧАСТЬ: ЛОГОТИП ===== */}
                    {/* Используем Link вместо <a> для плавной навигации без перезагрузки */}
                    <Link to='/' className="flex items-center gap-3 group">
                        {/* Иконка логотипа с красивым градиентом */}
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-200 group-hover:shadow-emerald-300 transition-all duration-300 transform group-hover:-translate-y-0.5">
                            <span className="text-white font-black text-xl tracking-wider">PS</span>
                        </div>
                        {/* Название приложения */}
                        <span className="text-xl font-extrabold text-gray-800 tracking-tight hidden sm:block">
                            Planuj Směny
                        </span>
                    </Link>

                    {/* ===== ПРАВАЯ ЧАСТЬ: ПОЛЬЗОВАТЕЛЬ И КНОПКИ ===== */}
                    <div className="flex items-center gap-4 sm:gap-6">

                        {/* Инфо о пользователе (Аватар + Текст) */}
                        {user && (
                            <div className="flex items-center gap-3">
                                {/* Текстовая информация (скрыта на мобилках) */}
                                <div className="hidden md:block text-right">
                                    <p className="text-sm font-bold text-gray-900 leading-tight">{user.username}</p>
                                    <p className="text-xs font-medium text-emerald-600">{user.role}</p>
                                </div>
                                {/* Круглая аватарка с инициалами */}
                                <div className="w-10 h-10 rounded-full bg-emerald-100 border-2 border-emerald-200 flex items-center justify-center text-emerald-700 font-bold shadow-sm">
                                    {getInitials(user.username)}
                                </div>
                            </div>
                        )}

                        {/* Разделительная линия, если есть пользователь и он админ */}
                        {user?.role === 'Admin' && (
                            <div className="hidden sm:block h-8 w-px bg-gray-200"></div>
                        )}

                        {/* Кнопки управления */}
                        <div className="flex items-center gap-2">
                            {/* Кнопка Админ панели (только для Admin) */}
                            {user?.role === 'Admin' && (
                                <button
                                    type="button"
                                    onClick={handleAdminClick}
                                    className="hidden sm:flex px-4 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-all shadow-sm active:scale-95"
                                >
                                    Admin Panel
                                </button>
                            )}

                            {/* Кнопка Logout / Login */}
                            {user ? (
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="px-4 py-2 text-sm font-semibold text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-all shadow-sm hover:shadow-md active:scale-95"
                                >
                                    Logout
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleLoginClick}
                                    className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 transition-all shadow-sm hover:shadow-md hover:shadow-emerald-200 active:scale-95"
                                >
                                    Login
                                </button>
                            )}
                        </div>

                    </div>
                </div>
            </div>
        </header>
    );
}