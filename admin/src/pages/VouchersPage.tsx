import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vouchersApi, brandsApi, campaignsApi } from '../api/endpoints';
import { Plus, Download, X, QrCode, FileDown, Trash2, Archive, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const PER_PAGE_OPTIONS = [25, 50, 100] as const;

export default function VouchersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<number>(25);
  const [filters, setFilters] = useState({ campaignId: '', brandId: '', status: '', code: '', exported: '' });
  const [showGenerate, setShowGenerate] = useState(false);
  const [genForm, setGenForm] = useState({ campaignId: '', brandId: '', count: 100 });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const { data: brands = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: () => brandsApi.getAll().then((r) => r.data),
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => campaignsApi.getAll().then((r) => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['vouchers', page, perPage, filters],
    queryFn: () =>
      vouchersApi
        .getAll({
          page,
          limit: perPage,
          campaignId: filters.campaignId || undefined,
          brandId: filters.brandId || undefined,
          status: filters.status || undefined,
          code: filters.code || undefined,
          exported: filters.exported || undefined,
        })
        .then((r) => r.data),
  });

  const vouchers: any[] = data?.data || [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const pageIds = useMemo(() => new Set(vouchers.map((v: any) => v.id)), [vouchers]);
  const allPageSelected = vouchers.length > 0 && vouchers.every((v: any) => selectedIds.has(v.id));
  const someSelected = selectedIds.size > 0;

  const toggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectedBrandName = useMemo(() => {
    if (!filters.brandId) return '';
    const b = brands.find((br: any) => String(br.id) === filters.brandId);
    return b?.name || '';
  }, [filters.brandId, brands]);

  const makeFileName = (ext: string) => {
    const parts: string[] = [];
    if (selectedBrandName) parts.push(selectedBrandName);
    else parts.push('vouchers');
    parts.push(new Date().toISOString().slice(0, 10));
    return `${parts.join('_')}.${ext}`;
  };

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

  const downloadBlob = (blobData: any, type: string, filename: string) => {
    const url = window.URL.createObjectURL(new Blob([blobData], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportQr = async (format: 'pdf' | 'zip', mode: 'selected' | 'filter') => {
    const ids = mode === 'selected' ? Array.from(selectedIds) : undefined;

    if (mode === 'filter' && !filters.campaignId) {
      toast.error('Выберите кампанию для экспорта QR');
      return;
    }
    if (mode === 'selected' && (!ids || ids.length === 0)) {
      toast.error('Выберите ваучеры для скачивания');
      return;
    }

    try {
      const params = {
        campaignId: filters.campaignId ? +filters.campaignId : undefined,
        brandId: filters.brandId ? +filters.brandId : undefined,
        status: filters.status || undefined,
        exported: filters.exported || undefined,
        ids,
      };

      const res = format === 'pdf'
        ? await vouchersApi.exportQrPdf(params)
        : await vouchersApi.exportQrZip(params);

      const mimeType = format === 'pdf' ? 'application/pdf' : 'application/zip';
      downloadBlob(res.data, mimeType, makeFileName(format));
      queryClient.invalidateQueries({ queryKey: ['vouchers'] });
      toast.success(`QR ${format.toUpperCase()} экспортирован (${mode === 'selected' ? ids!.length : 'все по фильтру'})`);
    } catch {
      toast.error(`Ошибка экспорта QR ${format.toUpperCase()}`);
    }
  };

  const handleExportCsv = async () => {
    try {
      const res = await vouchersApi.exportCsv({
        campaignId: filters.campaignId || undefined,
        brandId: filters.brandId || undefined,
      });
      downloadBlob(res.data, 'text/csv', makeFileName('csv'));
      toast.success('CSV экспортирован');
    } catch {
      toast.error('Ошибка экспорта');
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

  const setPageSafe = (p: number) => {
    setPage(Math.max(1, Math.min(totalPages, p)));
  };

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
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
          >
            <Download size={16} /> CSV
          </button>
          <button
            onClick={() => handleExportQr('pdf', 'filter')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
          >
            <FileDown size={16} /> QR PDF
          </button>
          <button
            onClick={() => handleExportQr('zip', 'filter')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
          >
            <Archive size={16} /> QR PNG
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
        {/* Filters */}
        <div className="p-4 border-b border-gray-200 flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Поиск по коду..."
            value={filters.code}
            onChange={(e) => { setFilters((f) => ({ ...f, code: e.target.value })); setPage(1); clearSelection(); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[150px]"
          />
          <select
            value={filters.campaignId}
            onChange={(e) => { setFilters((f) => ({ ...f, campaignId: e.target.value })); setPage(1); clearSelection(); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="">Все кампании</option>
            {campaigns.map((c: any) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
          <select
            value={filters.brandId}
            onChange={(e) => { setFilters((f) => ({ ...f, brandId: e.target.value })); setPage(1); clearSelection(); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="">Все бренды</option>
            {brands.map((b: any) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); clearSelection(); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="">Все статусы</option>
            <option value="FREE">Свободен</option>
            <option value="ACTIVATED">Активирован</option>
            <option value="USED">Использован</option>
            <option value="DELETED">Удалён</option>
          </select>
          <select
            value={filters.exported}
            onChange={(e) => { setFilters((f) => ({ ...f, exported: e.target.value })); setPage(1); clearSelection(); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="">Все QR</option>
            <option value="false">Не скачаны</option>
            <option value="true">Скачаны</option>
          </select>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-500">Показать:</span>
            {PER_PAGE_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => { setPerPage(n); setPage(1); clearSelection(); }}
                className={`px-2.5 py-1 text-xs rounded-md border transition ${perPage === n ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={togglePage}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Код</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Бренд</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Кампания</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Пользователь</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Статус</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Активирован</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">QR</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Скачан</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">Загрузка...</td></tr>
              ) : vouchers.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">Ваучеры не найдены</td></tr>
              ) : (
                vouchers.map((v: any) => (
                  <tr key={v.id} className={`hover:bg-gray-50 ${selectedIds.has(v.id) ? 'bg-indigo-50/50' : ''}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(v.id)}
                        onChange={() => toggleOne(v.id)}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>
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
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {v.exportedAt ? new Date(v.exportedAt).toLocaleDateString('ru-RU') : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-gray-200 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Всего: {total}
          </span>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPageSafe} />
        </div>
      </div>

      {/* Selection toolbar */}
      {someSelected && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white rounded-xl shadow-2xl px-5 py-3 flex items-center gap-4 z-50 animate-in">
          <div className="flex items-center gap-2">
            <Check size={16} className="text-indigo-400" />
            <span className="text-sm font-medium">Выбрано: {selectedIds.size}</span>
          </div>
          <div className="w-px h-6 bg-gray-700" />
          <button
            onClick={() => handleExportQr('pdf', 'selected')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition"
          >
            <FileDown size={14} /> PDF
          </button>
          <button
            onClick={() => handleExportQr('zip', 'selected')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition"
          >
            <Archive size={14} /> PNG
          </button>
          <div className="w-px h-6 bg-gray-700" />
          <button
            onClick={clearSelection}
            className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-800 rounded-lg text-sm text-gray-400 hover:text-white transition"
          >
            <X size={14} /> Сбросить
          </button>
        </div>
      )}
    </div>
  );
}

function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
  const [inputValue, setInputValue] = useState('');

  const getPageNumbers = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

    const pages: (number | '...')[] = [1];

    if (page > 3) pages.push('...');

    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);

    if (page < totalPages - 2) pages.push('...');

    if (totalPages > 1) pages.push(totalPages);

    return pages;
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="p-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
      >
        <ChevronLeft size={16} />
      </button>

      {getPageNumbers().map((p, i) =>
        p === '...' ? (
          <span key={`dots-${i}`} className="px-1 text-gray-400 text-sm">...</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`min-w-[32px] h-8 rounded-lg text-sm font-medium transition ${
              p === page
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {p}
          </button>
        ),
      )}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="p-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
      >
        <ChevronRight size={16} />
      </button>

      {totalPages > 7 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const num = parseInt(inputValue, 10);
            if (num >= 1 && num <= totalPages) {
              onPageChange(num);
              setInputValue('');
            }
          }}
          className="ml-2 flex items-center gap-1.5"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.replace(/\D/g, ''))}
            placeholder="№"
            className="w-12 px-2 py-1 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <button
            type="submit"
            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition"
          >
            Перейти
          </button>
        </form>
      )}
    </div>
  );
}
