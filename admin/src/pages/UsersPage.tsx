import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../api/endpoints';
import { Search, CheckCircle, XCircle, Trash2, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [eligibleFilter, setEligibleFilter] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search, eligibleFilter],
    queryFn: () =>
      usersApi
        .getAll({
          page,
          limit: 20,
          search: search || undefined,
          eligible: eligibleFilter === '' ? undefined : eligibleFilter === 'true',
        })
        .then((r) => r.data),
  });

  const resetMutation = useMutation({
    mutationFn: (userId: number) => api.post(`/admin/users/${userId}/reset-vouchers`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      toast.success('Ваучеры пользователя обнулены');
    },
    onError: () => toast.error('Ошибка при обнулении ваучеров'),
  });

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  const handleExportCsv = () => {
    const token = localStorage.getItem('token');
    const baseUrl = import.meta.env.VITE_API_URL || '';
    const url = `${baseUrl}/api/admin/users/export-csv`;
    const link = document.createElement('a');
    link.href = url;

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        link.href = objectUrl;
        link.download = 'users.csv';
        link.click();
        URL.revokeObjectURL(objectUrl);
      });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Пользователи</h2>
        <button
          onClick={handleExportCsv}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition"
        >
          <Download size={16} /> Скачать CSV
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск по имени или телефону..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
          </div>
          <select
            value={eligibleFilter}
            onChange={(e) => { setEligibleFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="">Все</option>
            <option value="true">Участвуют</option>
            <option value="false">Не участвуют</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">ID</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Имя</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Телефон</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Chat ID</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Кодов</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Брендов</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Участвует</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">Загрузка...</td>
                </tr>
              ) : data?.data?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">Пользователи не найдены</td>
                </tr>
              ) : (
                data?.data?.map((user: any) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">{user.id}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{user.name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{user.phone || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">{user.chatId || '—'}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{user.totalVouchers}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{user.brandCount}</td>
                    <td className="px-4 py-3">
                      {user.eligible ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <CheckCircle size={12} /> Да
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          <XCircle size={12} /> Нет
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {user.totalVouchers > 0 && (
                        <button
                          onClick={() => {
                            if (confirm(`Обнулить все ваучеры пользователя "${user.name || user.phone || user.id}"? Это действие нельзя отменить.`)) {
                              resetMutation.mutate(user.id);
                            }
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Обнулить ваучеры"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-gray-200 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Страница {page} из {totalPages} (всего {data?.total ?? 0})
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
            >
              Назад
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
            >
              Вперёд
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
