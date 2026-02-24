import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { campaignsApi } from '../api/endpoints';
import { Plus, Pencil, X, Power, PowerOff } from 'lucide-react';
import toast from 'react-hot-toast';

const defaultForm = {
  title: '',
  description: '',
  startDate: '',
  endDate: '',
  sumPerVoucher: 300000,
  minVouchers: 10,
  minBrands: 3,
  isActive: true,
};

export default function CampaignsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(defaultForm);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => campaignsApi.getAll().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => campaignsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      resetForm();
      toast.success('Кампания создана');
    },
    onError: () => toast.error('Ошибка при создании'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => campaignsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      resetForm();
      toast.success('Кампания обновлена');
    },
    onError: () => toast.error('Ошибка при обновлении'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      campaignsApi.update(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Статус обновлён');
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm(defaultForm);
  };

  const handleEdit = (c: any) => {
    setEditId(c.id);
    setForm({
      title: c.title,
      description: c.description || '',
      startDate: c.startDate?.slice(0, 10) || '',
      endDate: c.endDate?.slice(0, 10) || '',
      sumPerVoucher: c.sumPerVoucher,
      minVouchers: c.minVouchers,
      minBrands: c.minBrands,
      isActive: c.isActive,
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...form,
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate).toISOString(),
    };
    if (editId) {
      updateMutation.mutate({ id: editId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const updateField = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Кампании</h2>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
        >
          <Plus size={16} /> Новая кампания
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">
              {editId ? 'Редактировать кампанию' : 'Новая кампания'}
            </h3>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
              <textarea
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                rows={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Дата начала</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => updateField('startDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Дата окончания</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => updateField('endDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Сумма за ваучер</label>
              <input
                type="number"
                value={form.sumPerVoucher}
                onChange={(e) => updateField('sumPerVoucher', +e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                min={1}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Мин. ваучеров</label>
              <input
                type="number"
                value={form.minVouchers}
                onChange={(e) => updateField('minVouchers', +e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                min={1}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Мин. брендов</label>
              <input
                type="number"
                value={form.minBrands}
                onChange={(e) => updateField('minBrands', +e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                min={1}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => updateField('isActive', e.target.checked)}
                  className="rounded"
                />
                Активна
              </label>
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
              >
                {editId ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Название</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Даты</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Сумма/ваучер</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Мин. ваучеров</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Мин. брендов</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ваучеров</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Статус</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Загрузка...</td></tr>
              ) : campaigns.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Нет кампаний</td></tr>
              ) : (
                campaigns.map((c: any) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.title}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(c.startDate).toLocaleDateString('ru-RU')} — {new Date(c.endDate).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.sumPerVoucher?.toLocaleString('ru-RU')}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.minVouchers}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.minBrands}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c._count?.vouchers ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {c.isActive ? 'Активна' : 'Неактивна'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(c)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                          title="Редактировать"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => toggleMutation.mutate({ id: c.id, isActive: !c.isActive })}
                          className={`p-1.5 rounded ${
                            c.isActive
                              ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                              : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                          }`}
                          title={c.isActive ? 'Деактивировать' : 'Активировать'}
                        >
                          {c.isActive ? <PowerOff size={14} /> : <Power size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
