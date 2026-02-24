import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { brandsApi } from '../api/endpoints';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BrandsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  const { data: brands = [], isLoading } = useQuery({
    queryKey: ['brands'],
    queryFn: () => brandsApi.getAll().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; slug: string }) => brandsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      resetForm();
      toast.success('Бренд создан');
    },
    onError: () => toast.error('Ошибка при создании бренда'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name: string; slug: string } }) =>
      brandsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      resetForm();
      toast.success('Бренд обновлён');
    },
    onError: () => toast.error('Ошибка при обновлении'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => brandsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      toast.success('Бренд удалён');
    },
    onError: () => toast.error('Ошибка при удалении'),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    setName('');
    setSlug('');
  };

  const handleEdit = (brand: any) => {
    setEditId(brand.id);
    setName(brand.name);
    setSlug(brand.slug);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editId) {
      updateMutation.mutate({ id: editId, data: { name, slug } });
    } else {
      createMutation.mutate({ name, slug });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Бренды</h2>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
        >
          <Plus size={16} /> Добавить
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">{editId ? 'Редактировать бренд' : 'Новый бренд'}</h3>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="flex gap-4">
            <input
              type="text"
              placeholder="Название бренда"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              required
            />
            <input
              type="text"
              placeholder="slug (напр. brand-name)"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              required
            />
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
            >
              {editId ? 'Сохранить' : 'Создать'}
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">ID</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Название</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Slug</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Создан</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Загрузка...</td></tr>
              ) : brands.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Нет брендов</td></tr>
              ) : (
                brands.map((brand: any) => (
                  <tr key={brand.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">{brand.id}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{brand.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">{brand.slug}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(brand.createdAt).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(brand)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Удалить этот бренд?')) deleteMutation.mutate(brand.id);
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 size={14} />
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
