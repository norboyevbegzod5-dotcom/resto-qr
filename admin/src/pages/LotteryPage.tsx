import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { lotteryApi } from '../api/endpoints';
import { Search, Trophy, XCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LotteryPage() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<any>(null);

  const checkMutation = useMutation({
    mutationFn: (code: string) => lotteryApi.checkCode(code),
    onSuccess: (res) => setResult(res.data),
    onError: () => toast.error('Ошибка проверки кода'),
  });

  const winnerMutation = useMutation({
    mutationFn: (code: string) => lotteryApi.markWinner(code),
    onSuccess: () => {
      toast.success('Победитель подтверждён!');
      if (result) {
        setResult({
          ...result,
          voucher: { ...result.voucher, status: 'USED' },
        });
      }
    },
    onError: () => toast.error('Ошибка при подтверждении'),
  });

  const handleCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    checkMutation.mutate(code.trim().toUpperCase());
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Проверка кода</h2>
      <p className="text-gray-500 mb-8">Введите код купона из лототрона для проверки</p>

      <form onSubmit={handleCheck} className="flex gap-3 mb-8">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Введите код ваучера..."
            className="w-full pl-11 pr-4 py-3 border-2 border-gray-300 rounded-xl text-lg font-mono tracking-wider focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            autoFocus
          />
        </div>
        <button
          type="submit"
          disabled={checkMutation.isPending}
          className="px-8 py-3 bg-indigo-600 text-white rounded-xl text-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {checkMutation.isPending ? 'Проверка...' : 'Проверить'}
        </button>
      </form>

      {result && !result.found && (
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-8 text-center">
          <XCircle size={64} className="text-red-500 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-red-700 mb-2">Код не найден</h3>
          <p className="text-red-600">Этот код не зарегистрирован в системе. Тяните следующий купон.</p>
        </div>
      )}

      {result && result.found && (
        <div className="space-y-6">
          {result.stats?.eligible && result.voucher.status === 'ACTIVATED' ? (
            <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-8 text-center">
              <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-green-700 mb-2">
                Условия выполнены — может быть победителем!
              </h3>
              <p className="text-green-600">Все условия акции соблюдены. Пользователь имеет право на приз.</p>
            </div>
          ) : result.voucher.status === 'USED' ? (
            <div className="bg-purple-50 border-2 border-purple-300 rounded-2xl p-8 text-center">
              <Trophy size={64} className="text-purple-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-purple-700 mb-2">Уже отмечен как победитель</h3>
              <p className="text-purple-600">Этот ваучер уже использован как выигрышный.</p>
            </div>
          ) : (
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-8 text-center">
              <AlertTriangle size={64} className="text-red-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-red-700 mb-2">
                {result.voucher.status === 'FREE'
                  ? 'Код не активирован'
                  : 'Условия не выполнены'}
              </h3>
              <p className="text-red-600">
                {result.voucher.status === 'FREE'
                  ? 'Этот код никогда не был активирован пользователем.'
                  : 'Пользователь не набрал минимальное количество ваучеров/брендов.'}
              </p>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <h4 className="font-semibold text-gray-900">Данные ваучера</h4>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-gray-500 uppercase">Код</span>
                <p className="text-lg font-mono font-bold text-gray-900">{result.voucher.code}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500 uppercase">Статус</span>
                <p className="text-lg font-medium text-gray-900">
                  {result.voucher.status === 'FREE' ? 'Свободен' : result.voucher.status === 'ACTIVATED' ? 'Активирован' : 'Использован'}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500 uppercase">Бренд</span>
                <p className="text-lg text-gray-900">{result.voucher.brand}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500 uppercase">Кампания</span>
                <p className="text-lg text-gray-900">{result.voucher.campaign}</p>
              </div>
              {result.voucher.activatedAt && (
                <div className="col-span-2">
                  <span className="text-xs text-gray-500 uppercase">Активирован</span>
                  <p className="text-lg text-gray-900">
                    {new Date(result.voucher.activatedAt).toLocaleString('ru-RU')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {result.user && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <h4 className="font-semibold text-gray-900">Пользователь</h4>
              </div>
              <div className="p-5 grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-gray-500 uppercase">Имя</span>
                  <p className="text-lg text-gray-900">{result.user.name || '—'}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 uppercase">Телефон</span>
                  <p className="text-lg text-gray-900">{result.user.phone || '—'}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 uppercase">Chat ID</span>
                  <p className="text-lg font-mono text-gray-900">{result.user.chatId || '—'}</p>
                </div>
              </div>
            </div>
          )}

          {result.stats && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <h4 className="font-semibold text-gray-900">Статистика пользователя</h4>
              </div>
              <div className="p-5 grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900">{result.stats.totalVouchers}</p>
                  <p className="text-sm text-gray-500">Всего кодов</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900">{result.stats.brandCount}</p>
                  <p className="text-sm text-gray-500">Брендов</p>
                </div>
                <div className="text-center">
                  <p className={`text-3xl font-bold ${result.stats.eligible ? 'text-green-600' : 'text-red-600'}`}>
                    {result.stats.eligible ? 'Да' : 'Нет'}
                  </p>
                  <p className="text-sm text-gray-500">Участвует</p>
                </div>
              </div>
            </div>
          )}

          {result.stats?.eligible && result.voucher.status === 'ACTIVATED' && (
            <div className="text-center">
              <button
                onClick={() => {
                  if (confirm('Подтвердить этот код как ПОБЕДИТЕЛЬ? Это действие нельзя отменить.')) {
                    winnerMutation.mutate(result.voucher.code);
                  }
                }}
                disabled={winnerMutation.isPending}
                className="px-8 py-4 bg-green-600 text-white rounded-xl text-xl font-bold hover:bg-green-700 disabled:opacity-50 transition shadow-lg"
              >
                <Trophy size={24} className="inline mr-2 -mt-1" />
                {winnerMutation.isPending ? 'Подтверждение...' : 'Подтвердить победителя'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
