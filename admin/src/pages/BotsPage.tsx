import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { botsApi, brandsApi } from '../api/endpoints';
import { Plus, RotateCcw, Square, Trash2, Pencil, Bot } from 'lucide-react';
import toast from 'react-hot-toast';

interface TelegramBot {
  id: number;
  name: string;
  username: string;
  brandId: number | null;
  miniAppUrl: string | null;
  isActive: boolean;
  running: boolean;
  shouldBeRunning?: boolean;
  brand?: { id: number; name: string } | null;
  createdAt: string;
}

interface Brand {
  id: number;
  name: string;
  slug: string;
}

export default function BotsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '',
    token: '',
    username: '',
    brandId: '',
    miniAppUrl: '',
  });

  const { data: bots = [], isLoading, error } = useQuery<TelegramBot[]>({
    queryKey: ['bots'],
    queryFn: async () => (await botsApi.getAll()).data,
    retry: 1,
    refetchInterval: 10000,
  });

  const { data: brands = [] } = useQuery<Brand[]>({
    queryKey: ['brands'],
    queryFn: async () => (await brandsApi.getAll()).data,
  });

  const createMut = useMutation({
    mutationFn: (data: any) => botsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bots'] });
      toast.success('Бот добавлен и запущен');
      resetForm();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Ошибка при добавлении бота';
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => botsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bots'] });
      toast.success('Бот обновлён и перезапущен');
      resetForm();
    },
    onError: () => toast.error('Ошибка при обновлении бота'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => botsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bots'] });
      toast.success('Бот удалён');
    },
  });

  const restartMut = useMutation({
    mutationFn: (id: number) => botsApi.restart(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bots'] });
      toast.success('Бот перезапущен');
    },
  });

  const stopMut = useMutation({
    mutationFn: (id: number) => botsApi.stop(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bots'] });
      toast.success('Бот остановлен');
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm({ name: '', token: '', username: '', brandId: '', miniAppUrl: '' });
  };

  const startEdit = (bot: TelegramBot) => {
    setEditId(bot.id);
    setForm({
      name: bot.name,
      token: '',
      username: bot.username,
      brandId: bot.brandId?.toString() || '',
      miniAppUrl: bot.miniAppUrl || '',
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      name: form.name,
      username: form.username,
      brandId: form.brandId ? parseInt(form.brandId) : null,
      miniAppUrl: form.miniAppUrl || null,
    };

    if (editId) {
      if (form.token) payload.token = form.token;
      updateMut.mutate({ id: editId, data: payload });
    } else {
      payload.token = form.token;
      createMut.mutate(payload);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="w-7 h-7" /> Telegram-боты
        </h1>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Добавить бота
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow mb-6 space-y-4">
          <h2 className="text-lg font-semibold">{editId ? 'Редактировать бота' : 'Новый бот'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Мой ресторан"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username бота</label>
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="my_restaurant_bot"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Токен {editId && <span className="text-gray-400">(оставьте пустым, чтобы не менять)</span>}
              </label>
              <input
                value={form.token}
                onChange={(e) => setForm({ ...form, token: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 font-mono text-sm"
                placeholder="123456789:ABCdefGHI..."
                required={!editId}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Бренд (опционально)</label>
              <select
                value={form.brandId}
                onChange={(e) => setForm({ ...form, brandId: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">— Без привязки —</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Mini App URL (опционально)</label>
              <input
                value={form.miniAppUrl}
                onChange={(e) => setForm({ ...form, miniAppUrl: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="https://myapp.example.com"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
              {editId ? 'Сохранить' : 'Создать и запустить'}
            </button>
            <button type="button" onClick={resetForm} className="bg-gray-200 px-6 py-2 rounded-lg hover:bg-gray-300">
              Отмена
            </button>
          </div>
        </form>
      )}

      {error ? (
        <div className="text-center py-12 text-red-500">Ошибка загрузки: {(error as any)?.message}</div>
      ) : isLoading ? (
        <div className="text-center py-12 text-gray-400">Загрузка...</div>
      ) : bots.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          Нет ботов. Нажмите «Добавить бота» для начала.
        </div>
      ) : (
        <div className="grid gap-4">
          {bots.map((bot) => (
            <div key={bot.id} className="bg-white rounded-xl shadow p-5 flex items-center gap-6">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-lg font-semibold truncate">{bot.name}</h3>
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full ${
                    bot.running
                      ? 'bg-green-100 text-green-700'
                      : bot.shouldBeRunning
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${
                      bot.running ? 'bg-green-500' : bot.shouldBeRunning ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                    {bot.running ? 'Работает' : bot.shouldBeRunning ? 'Запускается...' : 'Остановлен'}
                  </span>
                </div>
                <div className="text-sm text-gray-500 space-y-0.5">
                  <p>@{bot.username}</p>
                  {bot.brand && <p>Бренд: <span className="font-medium text-gray-700">{bot.brand.name}</span></p>}
                  {bot.miniAppUrl && <p>Mini App: <span className="font-mono text-xs">{bot.miniAppUrl}</span></p>}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {bot.running ? (
                  <>
                    <button
                      onClick={() => restartMut.mutate(bot.id)}
                      className="p-2 rounded-lg bg-yellow-50 text-yellow-600 hover:bg-yellow-100"
                      title="Перезапустить"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => stopMut.mutate(bot.id)}
                      className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                      title="Остановить"
                    >
                      <Square className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => restartMut.mutate(bot.id)}
                    className="p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100"
                    title="Запустить"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => startEdit(bot)}
                  className="p-2 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100"
                  title="Редактировать"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm('Удалить бота? Он будет остановлен и удалён.')) {
                      deleteMut.mutate(bot.id);
                    }
                  }}
                  className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                  title="Удалить"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
