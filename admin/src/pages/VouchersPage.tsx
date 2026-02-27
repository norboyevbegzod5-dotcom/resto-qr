import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vouchersApi, brandsApi, campaignsApi } from '../api/endpoints';
import { Plus, Download, X, QrCode, FileDown, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function VouchersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ campaignId: '', brandId: '', status: '', code: '' });
  const [showGenerate, setShowGenerate] = useState(false);
  const [genForm, setGenForm] = useState({ campaignId: '', brandId: '', count: 100 });

  const { data: brands = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: () => brandsApi.getAll().then((r) => r.data),
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => campaignsApi.getAll().then((r) => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['vouchers', page, filters],
    queryFn: () =>
      vouchersApi
        .getAll({
          page,
          limit: 20,
          campaignId: filters.campaignId || undefined,
          brandId: filters.brandId || undefined,
          status: filters.status || undefined,
          code: filters.code || undefined,
        })
        .then((r) => r.data),
  });

  const generateMutation = useMutation({
    mutationFn: (data: { campaignId: number; brandId: number; count: number }) =>
      vouchersApi.generate(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['vouchers'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      setShowGenerate(false);
      toast.success(`Сгенерировано ${res.data.length} ваучеров`);
    },
    onError: () => toast.error('Ошибка генерации'),
  });

  const handleExportQrPdf = async () => {
    if (!filters.campaignId) {
      toast.error('Выберите кампанию для экспорта QR');
      return;
    }
    try {
      const res = await vouchersApi.exportQrPdf({
        campaignId: +filters.campaignId,
        brandId: filters.brandId ? +filters.brandId : undefined,
        status: filters.status || undefined,
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vouchers-qr.pdf';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('QR PDF экспортирован');
    } catch {
      toast.error('Ошибка экспорта QR PDF');
    }
  };

  const handleViewQr = async (code: string) => {
    try {
      const res = await import('../api/client').then(m =>
        m.default.get(`/admin/vouchers/qr/${code}`, { responseType: 'blob' })
      );
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'image/png' }));
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(`<html><head><title>QR: ${code}</title></head><body style="display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f3f4f6"><img src="${url}" style="max-width:400px" /></body></html>`);
      }
    } catch {
      toast.error('Ошибка загрузки QR');
    }
  };

  const handleExport = async () => {
    try {
      const res = await vouchersApi.exportCsv({
        campaignId: filters.campaignId || undefined,
        brandId: filters.brandId || undefined,
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vouchers.csv';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('CSV экспортирован');
    } catch {
      toast.error('Ошибка экспорта');
    }
  };

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!genForm.campaignId || !genForm.brandId) {
      toast.error('Выберите кампанию и бренд');
      return;
    }
    generateMutation.mutate({
      campaignId: +genForm.campaignId,
      brandId: +genForm.brandId,
      count: genForm.count,
    });
  };

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  const statusLabel = (status: string) => {
    switch (status) {
      case 'FREE': return 'Свободен';
      case 'ACTIVATED': return 'Активирован';
      case 'USED': return 'Использован';
      case 'DELETED': return 'Удалён';
      default: return status;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'FREE': return 'bg-gray-100 text-gray-600';
      case 'ACTIVATED': return 'bg-blue-100 text-blue-700';
      case 'USED': return 'bg-purple-100 text-purple-700';
      case 'DELETED': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Ваучеры</h2>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              if (confirm('Удалить ВСЕ ваучеры? Это действие нельзя отменить!')) {
                try {
                  const res = await vouchersApi.deleteAll();
                  queryClient.invalidateQueries({ queryKey: ['vouchers'] });
                  queryClient.invalidateQueries({ queryKey: ['stats'] });
                  toast.success(`Удалено ${res.data.deleted} ваучеров`);
                } catch { toast.error('Ошибка удаления'); }
              }
            }}
            className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition"
          >
            <Trash2 size={16} /> Удалить все
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
          >
            <Download size={16} /> CSV
          </button>
          <button
            onClick={handleExportQrPdf}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
          >
            <FileDown size={16} /> QR PDF
          </button>
          <button
            onClick={() => setShowGenerate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
          >
            <Plus size={16} /> Генерировать
          </button>
        </div>
      </div>

      {showGenerate && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Генерация ваучеров</h3>
            <button onClick={() => setShowGenerate(false)} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleGenerate} className="flex flex-wrap gap-4">
            <select
              value={genForm.campaignId}
              onChange={(e) => setGenForm((p) => ({ ...p, campaignId: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              required
            >
              <option value="">Выберите кампанию</option>
              {campaigns.map((c: any) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
            <select
              value={genForm.brandId}
              onChange={(e) => setGenForm((p) => ({ ...p, brandId: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              required
            >
              <option value="">Выберите бренд</option>
              {brands.map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Кол-во"
              value={genForm.count}
              onChange={(e) => setGenForm((p) => ({ ...p, count: +e.target.value }))}
              className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              min={1}
              max={10000}
              required
            />
            <button
              type="submit"
              disabled={generateMutation.isPending}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {generateMutation.isPending ? 'Генерация...' : 'Создать'}
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Поиск по коду..."
            value={filters.code}
            onChange={(e) => { setFilters((f) => ({ ...f, code: e.target.value })); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[150px]"
          />
          <select
            value={filters.campaignId}
            onChange={(e) => { setFilters((f) => ({ ...f, campaignId: e.target.value })); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="">Все кампании</option>
            {campaigns.map((c: any) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
          <select
            value={filters.brandId}
            onChange={(e) => { setFilters((f) => ({ ...f, brandId: e.target.value })); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="">Все бренды</option>
            {brands.map((b: any) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="">Все статусы</option>
            <option value="FREE">Свободен</option>
            <option value="ACTIVATED">Активирован</option>
            <option value="USED">Использован</option>
            <option value="DELETED">Удалён</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Код</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Бренд</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Кампания</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Пользователь</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Статус</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Активирован</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">QR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Загрузка...</td></tr>
              ) : data?.data?.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Ваучеры не найдены</td></tr>
              ) : (
                data?.data?.map((v: any) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">{v.code}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{v.brand?.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{v.campaign?.title}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {v.user ? `${v.user.name || '—'} (${v.user.phone || '—'})` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusColor(v.status)}`}>
                        {statusLabel(v.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {v.activatedAt ? new Date(v.activatedAt).toLocaleString('ru-RU') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleViewQr(v.code)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                        title="Показать QR"
                      >
                        <QrCode size={16} />
                      </button>
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
