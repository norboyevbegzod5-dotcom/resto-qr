import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { broadcastApi, botsApi } from '../api/endpoints';
import { Send, Users, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

interface PreviewUser {
  id: number;
  name: string | null;
  phone: string | null;
  totalVouchers: number;
  brandVouchers?: number;
  remainingVouchers: number;
  eligible: boolean;
}

interface TelegramBot {
  id: number;
  name: string;
  username: string;
  isActive: boolean;
  brand?: { id: number; name: string } | null;
}

export default function BroadcastPage() {
  const [message, setMessage] = useState('');
  const [botId, setBotId] = useState<string>('');
  const [minVouchers, setMinVouchers] = useState<string>('0');
  const [maxRemaining, setMaxRemaining] = useState<string>('');
  const [eligibleFilter, setEligibleFilter] = useState<string>('');
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number; total: number } | null>(null);

  const { data: bots = [] } = useQuery<TelegramBot[]>({
    queryKey: ['bots'],
    queryFn: async () => (await botsApi.getAll()).data,
  });

  const activeBots = bots.filter((b) => b.isActive);
  const selectedBot = activeBots.find((b) => String(b.id) === botId);

  const filters = {
    botId: botId ? parseInt(botId, 10) : undefined,
    minVouchers: minVouchers !== '' ? parseInt(minVouchers, 10) : undefined,
    maxRemaining: maxRemaining !== '' ? parseInt(maxRemaining, 10) : undefined,
    eligible: eligibleFilter === '' ? undefined : eligibleFilter === 'true',
  };

  // Auto-count recipients: refetches whenever the bot or filters change.
  const {
    data: preview,
    isFetching: previewLoading,
    refetch: refetchPreview,
  } = useQuery<{ count: number; users: PreviewUser[] }>({
    queryKey: ['broadcast-preview', filters.botId, filters.minVouchers, filters.maxRemaining, filters.eligible],
    queryFn: async () => (await broadcastApi.preview(filters)).data,
    enabled: !!botId,
  });

  const sendMut = useMutation({
    mutationFn: () =>
      broadcastApi.send({ message, ...filters }),
    onSuccess: (res) => {
      setSendResult(res.data);
      toast.success(`Отправлено: ${res.data.sent} из ${res.data.total}`);
      refetchPreview();
    },
    onError: () => toast.error('Ошибка при отправке рассылки'),
  });

  const handleSend = () => {
    if (!message.trim()) {
      toast.error('Введите текст сообщения');
      return;
    }
    if (!botId) {
      toast.error('Выберите бота для рассылки');
      return;
    }
    if (!preview || preview.count === 0) {
      toast.error('Сначала проверьте получателей');
      return;
    }
    const botLabel = selectedBot ? `@${selectedBot.username}` : 'выбранного бота';
    if (confirm(`Отправить сообщение ${preview.count} пользователям через ${botLabel}?`)) {
      sendMut.mutate();
    }
  };

  const templates = [
    {
      label: 'Осталось немного',
      text: '🔔 Напоминание!\n\nВам осталось совсем немного до участия в розыгрыше! Продолжайте собирать купоны — каждая покупка приближает вас к главному призу! 🎁',
    },
    {
      label: 'Поздравление',
      text: '🎉 Поздравляем!\n\nВы выполнили все условия акции и участвуете в розыгрыше главного приза! Желаем удачи! 🏆',
    },
    {
      label: 'Напоминание об акции',
      text: '🎁 Акция продолжается!\n\nНе забывайте собирать купоны за покупки! Чем больше купонов — тем ближе вы к розыгрышу! 🔥',
    },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <Send className="w-6 h-6" /> Рассылка
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Filters */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Filter size={16} /> Фильтры получателей
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Бот
                </label>
                <select
                  value={botId}
                  onChange={(e) => {
                    setBotId(e.target.value);
                    setSendResult(null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">Выберите бота</option>
                  {activeBots.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} (@{b.username}){b.brand ? ` — ${b.brand.name}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Получатели: пользователи с купонами бренда бота и зарегистрированные без купонов. Сообщение уйдёт от этого бота.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Мин. купонов у пользователя
                </label>
                <input
                  type="number"
                  value={minVouchers}
                  onChange={(e) => setMinVouchers(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  min={0}
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Макс. осталось до участия
                </label>
                <input
                  type="number"
                  value={maxRemaining}
                  onChange={(e) => setMaxRemaining(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  min={0}
                  placeholder="Все"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Статус участия
                </label>
                <select
                  value={eligibleFilter}
                  onChange={(e) => setEligibleFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">Все</option>
                  <option value="false">Ещё не участвуют</option>
                  <option value="true">Уже участвуют</option>
                </select>
              </div>

              <div className="bg-indigo-50 rounded-lg p-3 text-center">
                {!botId ? (
                  <p className="text-sm text-indigo-500 py-2">Выберите бота, чтобы увидеть кол-во получателей</p>
                ) : previewLoading ? (
                  <p className="text-sm text-indigo-500 py-2">Подсчёт получателей...</p>
                ) : (
                  <>
                    <span className="text-3xl font-bold text-indigo-700">{preview?.count ?? 0}</span>
                    <p className="text-sm text-indigo-600">получателей</p>
                    {selectedBot && (
                      <p className="text-xs text-indigo-500 mt-1">через @{selectedBot.username}</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Message */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Send size={16} /> Текст сообщения
            </h3>

            <div className="flex flex-wrap gap-2 mb-3">
              {templates.map((t, i) => (
                <button
                  key={i}
                  onClick={() => setMessage(t.text)}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition"
                >
                  {t.label}
                </button>
              ))}
            </div>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              rows={6}
              placeholder="Введите текст сообщения для рассылки..."
            />

            <p className="text-xs text-gray-400 mt-1">
              Поддерживается HTML: &lt;b&gt;жирный&lt;/b&gt;, &lt;i&gt;курсив&lt;/i&gt;, &lt;a href=&quot;...&quot;&gt;ссылка&lt;/a&gt;
            </p>

            <div className="mt-4 flex items-center gap-4">
              <button
                onClick={handleSend}
                disabled={sendMut.isPending || !message.trim() || !botId || !preview || preview.count === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
              >
                <Send size={16} />
                {sendMut.isPending ? 'Отправка...' : 'Отправить рассылку'}
              </button>

              {sendResult && (
                <div className="text-sm">
                  <span className="text-green-600 font-medium">Отправлено: {sendResult.sent}</span>
                  {sendResult.failed > 0 && (
                    <span className="text-red-600 font-medium ml-3">Ошибок: {sendResult.failed}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Preview table */}
          {preview && preview.users.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 mt-6">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Users size={16} /> Получатели (первые {preview.users.length} из {preview.count})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">ID</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Имя</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Телефон</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Купонов</th>
                      {selectedBot?.brand && (
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                          {selectedBot.brand.name}
                        </th>
                      )}
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Осталось</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Участвует</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {preview.users.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-600">{u.id}</td>
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">{u.name || '—'}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{u.phone || '—'}</td>
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">{u.totalVouchers}</td>
                        {selectedBot?.brand && (
                          <td className="px-4 py-2 text-sm text-gray-600">{u.brandVouchers ?? '—'}</td>
                        )}
                        <td className="px-4 py-2 text-sm text-gray-600">{u.remainingVouchers}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            u.eligible ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {u.eligible ? 'Да' : 'Нет'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
