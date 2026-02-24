import { useQuery } from '@tanstack/react-query';
import { statsApi } from '../api/endpoints';
import { Users, Ticket, Megaphone, Tag, CheckCircle } from 'lucide-react';

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => statsApi.get().then((r) => r.data),
  });

  const cards = [
    { label: 'Пользователи', value: data?.totalUsers ?? '—', icon: Users, color: 'bg-blue-500' },
    { label: 'Всего ваучеров', value: data?.totalVouchers ?? '—', icon: Ticket, color: 'bg-purple-500' },
    { label: 'Активировано', value: data?.activatedVouchers ?? '—', icon: CheckCircle, color: 'bg-green-500' },
    { label: 'Активные кампании', value: data?.activeCampaigns ?? '—', icon: Megaphone, color: 'bg-orange-500' },
    { label: 'Бренды', value: data?.totalBrands ?? '—', icon: Tag, color: 'bg-pink-500' },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Главная</h2>

      {isLoading ? (
        <div className="text-gray-500">Загрузка...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{card.label}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">
                      {card.value}
                    </p>
                  </div>
                  <div className={`${card.color} p-3 rounded-lg`}>
                    <Icon size={22} className="text-white" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
