import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { receiptsApi } from '../api/endpoints';
import api from '../api/client';
import { Search, Receipt, Phone, User } from 'lucide-react';

export default function ReceiptsPage() {
  const [phone, setPhone] = useState('');
  const [searchPhone, setSearchPhone] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['receipts', searchPhone],
    queryFn: () =>
      receiptsApi.getAll({ phone: searchPhone || undefined, limit: 50 }).then((r) => r.data),
  });

  const receipts = data?.data || [];
  const total = data?.total ?? 0;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <Receipt className="w-6 h-6" /> Чеки
      </h2>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Поиск по телефону</label>
            <div className="relative">
              <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="998901234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setSearchPhone(phone)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
          <button
            onClick={() => setSearchPhone(phone)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
          >
            <Search size={16} /> Найти
          </button>
        </div>
      </div>

      <div className="text-sm text-gray-500 mb-4">
        Найдено: {total} чеков
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Загрузка...</div>
      ) : receipts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {searchPhone ? 'Чеки по запросу не найдены' : 'Чеков пока нет'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {receipts.map((r: any) => (
            <ReceiptCard key={r.id} receipt={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReceiptCard({ receipt }: { receipt: any }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  const { data: blob, isError, refetch, isFetching } = useQuery({
    queryKey: ['receipt-image', receipt.id],
    queryFn: async () => {
      const res = await api.get(`admin/receipts/${receipt.id}/image`, { responseType: 'blob' });
      return URL.createObjectURL(res.data);
    },
    enabled: !!receipt.id,
    retry: 2,
  });

  useEffect(() => {
    if (blob) setImgUrl(blob);
    return () => {
      if (blob) URL.revokeObjectURL(blob);
    };
  }, [blob]);

  const user = receipt.user || {};
  const date = new Date(receipt.createdAt).toLocaleString('ru-RU');

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="aspect-square bg-gray-100 flex flex-col items-center justify-center min-h-[200px] gap-2">
        {imgUrl ? (
          <img src={imgUrl} alt="Чек" className="w-full h-full object-contain" />
        ) : isError ? (
          <>
            <span className="text-gray-400 text-sm">Не удалось загрузить</span>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="text-indigo-600 text-xs hover:underline disabled:opacity-50"
            >
              {isFetching ? 'Загрузка...' : 'Повторить'}
            </button>
          </>
        ) : (
          <span className="text-gray-400 text-sm">Загрузка...</span>
        )}
      </div>
      <div className="p-3 border-t border-gray-100">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
          <User size={14} /> {user.name || '—'}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
          <Phone size={14} /> {user.phone || '—'}
        </div>
        <div className="text-xs text-gray-400 mt-1">{date}</div>
      </div>
    </div>
  );
}
