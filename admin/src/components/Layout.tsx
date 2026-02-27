import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Tag,
  Megaphone,
  Ticket,
  Trophy,
  Bot,
  Send,
  LogOut,
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'Главная', icon: LayoutDashboard },
  { path: '/users', label: 'Пользователи', icon: Users },
  { path: '/brands', label: 'Бренды', icon: Tag },
  { path: '/campaigns', label: 'Кампании', icon: Megaphone },
  { path: '/vouchers', label: 'Ваучеры', icon: Ticket },
  { path: '/lottery', label: 'Розыгрыш', icon: Trophy },
  { path: '/bots', label: 'Telegram-боты', icon: Bot },
  { path: '/broadcast', label: 'Рассылка', icon: Send },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">Resto QR</h1>
          <p className="text-sm text-gray-500 mt-1">Панель управления</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path);
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 w-full transition-colors"
          >
            <LogOut size={18} />
            Выйти
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
