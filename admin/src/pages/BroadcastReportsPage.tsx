import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { broadcastApi } from '../api/endpoints';
import { ClipboardList, Users, ChevronRight, Search } from 'lucide-react';

interface Broadcast {
  id: number;
  message: string;
  botId: number | null;
  botUsername: string | null;
  total: number;
  sent: number;
  failed: number;
  createdAt: string;
}

interface Recipient {
  id: number;
  userId: number | null;
  chatId: string;
  name: string | null;
  phone: string | null;
  success: boolean;
  createdAt: string;
}

const RECIPIENTS_PER_PAGE = 50;

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function BroadcastReportsPage() {
  const [selected, setSelected] = useState<Broadcast | null>(null);
  const [phone, setPhone] = useState('');
  const [successFilter, setSuccessFilter] = useState('');
  const [recipPage, setRecipPage] = useState(1);

  const { data: history } = useQuery<{ data: Broadcast[]; total: number }>({
    queryKey: ['broadcast-history'],
    queryFn: async () => (await broadcastApi.history({ page: 1, limit: 100 })).data,
  });

  const { data: recipients, isFetching: recipLoading } = useQuery<{
    data: Recipient[];
    total: number;
  }>({
    queryKey: ['broadcast-recipients', selected?.id, recipPage, phone, successFilter],
    queryFn: async () =>
      (
        await broadcastApi.recipients(selected!.id, {
          page: recipPage,
          limit: RECIPIENTS_PER_PAGE,
          phone: phone || undefined,
          success: successFilter || undefined,
        })
      ).data,
    enabled: !!selected,
  });

  const broadcasts = history?.data ?? [];
  const totalRecipPages = recipients ? Math.ceil(recipients.total / RECIPIENTS_PER_PAGE) : 1;

  const selectBroadcast = (b: Broadcast) => {
    setSelected(b);
    setPhone('');
    setSuccessFilter('');
    setRecipPage(1);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <ClipboardList className="w-6 h-6" /> Отчёты рассылок
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* History list */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">История рассылок ({history?.total ?? 0})</h3>
          </div>
          <div className="divide-y divide-gray-200 max-h-[70vh] overflow-y-auto">
            {broadcasts.length === 0 && (
              <p className="p-6 text-sm text-gray-400 text-center">Рассылок пока не было</p>
            )}
            {broadcasts.map((b) => (
              <button
                key={b.id}
                onClick={() => selectBroadcast(b)}
                className={`w-full text-left p-4 hover:bg-gray-50 transition flex items-start gap-3 ${
                  selected?.id === b.id ? 'bg-indigo-50' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-500">{formatDate(b.createdAt)}</span>
                    {b.botUsername && (
                      <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                        @{b.botUsername}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-800 truncate">{b.message}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs">
                    <span className="text-gray-500">Всего: {b.total}</span>
                    <span className="text-green-600 font-medium">Доставлено: {b.sent}</span>
                    {b.failed > 0 && <span className="text-red-600 font-medium">Ошибок: {b.failed}</span>}
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-400 mt-1 shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Recipients */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Users size={16} /> Получатели
              {selected && <span className="text-sm text-gray-500">({recipients?.total ?? 0})</span>}
            </h3>
          </div>

          {!selected ? (
            <p className="p-6 text-sm text-gray-400 text-center">
              Выберите рассылку слева, чтобы увидеть, кто её получил
            </p>
          ) : (
            <div>
              <div className="p-4 flex flex-wrap gap-2 border-b border-gray-100">
                <div className="relative flex-1 min-w-[160px]">
                  <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Поиск по телефону..."
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setRecipPage(1);
                    }}
                    className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <select
                  value={successFilter}
                  onChange={(e) => {
                    setSuccessFilter(e.target.value);
                    setRecipPage(1);
                  }}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">Все</option>
                  <option value="true">Доставлено</option>
                  <option value="false">Ошибка</option>
                </select>
              </div>

              <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr className="text-left">
                      <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Имя</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Телефон</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Статус</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {recipLoading && (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-400">
                          Загрузка...
                        </td>
                      </tr>
                    )}
                    {!recipLoading && recipients?.data.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-400">
                          Ничего не найдено
                        </td>
                      </tr>
                    )}
                    {!recipLoading &&
                      recipients?.data.map((r) => (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">{r.name || '—'}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{r.phone || '—'}</td>
                          <td className="px-4 py-2">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                r.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {r.success ? 'Доставлено' : 'Ошибка'}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {totalRecipPages > 1 && (
                <div className="p-3 flex items-center justify-between border-t border-gray-200">
                  <button
                    onClick={() => setRecipPage((p) => Math.max(1, p - 1))}
                    disabled={recipPage <= 1}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                  >
                    Назад
                  </button>
                  <span className="text-sm text-gray-500">
                    Стр. {recipPage} из {totalRecipPages}
                  </span>
                  <button
                    onClick={() => setRecipPage((p) => Math.min(totalRecipPages, p + 1))}
                    disabled={recipPage >= totalRecipPages}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                  >
                    Вперёд
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
