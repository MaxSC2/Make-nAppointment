import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useOrders } from '../hooks/useOrders'
import OrderCard from '../components/OrderCard'
import { useAuth } from '../hooks/useAuth'
import { PlusIcon } from '../components/Icons'

const ChevronLeftIcon = () => (
  <svg className="w-3.5 h-3.5 inline" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
)
const ChevronRightIcon = () => (
  <svg className="w-3.5 h-3.5 inline" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
)

type SortKey = 'newest' | 'oldest' | 'priority'

export default function OrdersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [status, setStatus] = useState('')
  const [modality, setModality] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('newest')
  const [onlyMine, setOnlyMine] = useState(false)
  const [groupByStatus, setGroupByStatus] = useState(false)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)

  const sortBy = sort === 'priority' ? 'priority' : sort === 'oldest' ? 'created_at' : 'created_at'
  const sortDir = sort === 'oldest' ? 'asc' : 'desc'

  const filters = useMemo(
    () => ({
      status: status || undefined,
      modality: modality || undefined,
      search: debouncedSearch || undefined,
      sortBy,
      sortDir,
      onlyMine,
      page,
      perPage,
    }),
    [status, modality, debouncedSearch, sortBy, sortDir, onlyMine, page, perPage],
  )

  const { orders, total, hasMore, loading, error, refetch } = useOrders(filters)

  // debounce поиска (300мс)
  useMemo(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const handleSearchChange = (v: string) => {
    setSearch(v)
    setPage(1)
  }

  const handleStatusChange = (v: string) => {
    setStatus(v)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const startItem = total === 0 ? 0 : (page - 1) * perPage + 1
  const endItem = Math.min(total, page * perPage)

  const grouped = useMemo(() => {
    if (!groupByStatus) return null
    const groups: Record<string, typeof orders> = {
      scheduled: [],
      in_progress: [],
      completed: [],
      cancelled: [],
      other: [],
    }
    for (const o of orders) {
      const key = groups[o.status] ? o.status : 'other'
      groups[key].push(o)
    }
    return groups
  }, [orders, groupByStatus])

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-2xl font-semibold dark:text-slate-100">{t('orders.title')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{t('orders.subtitle')}</p>
        </div>
        <button
          onClick={() => navigate('/orders/new')}
          className="flex items-center gap-1.5 bg-teal-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-teal-700 transition"
        >
          <PlusIcon /> {t('orders.newOrder')}
        </button>
      </div>

      {/* Filters bar */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 mb-4 flex flex-wrap items-center gap-2">
        {/* Поиск */}
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder={t('orders.searchPlaceholder')}
            className="w-full pl-9 pr-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>

        {/* Status */}
        <select
          value={status}
          onChange={e => handleStatusChange(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="">{t('orders.all')}</option>
          <option value="scheduled">{t('orders.planned')}</option>
          <option value="in_progress">{t('orders.inProgress')}</option>
          <option value="completed">{t('orders.completed')}</option>
          <option value="cancelled">{t('orders.cancelled')}</option>
        </select>

        {/* Modality */}
        <select
          value={modality}
          onChange={e => { setModality(e.target.value); setPage(1) }}
          className="px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="">{t('orders.all')}</option>
          <option value="CT">КТ</option>
          <option value="MR">МРТ</option>
          <option value="DX">Рентген</option>
          <option value="US">УЗИ</option>
        </select>

        {/* Сортировка */}
        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          className="px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
          title={t('orders.sortBy')}
        >
          <option value="newest">{t('orders.sortNewest')}</option>
          <option value="oldest">{t('orders.sortOldest')}</option>
          <option value="priority">{t('orders.sortPriority')}</option>
        </select>

        {/* Только мои */}
        {user && user.role_codes.some(r => ['doctor', 'admin', 'technician'].includes(r)) && (
          <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 cursor-pointer select-none px-2">
            <input
              type="checkbox"
              checked={onlyMine}
              onChange={e => { setOnlyMine(e.target.checked); setPage(1) }}
              className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            {t('orders.onlyMine')}
          </label>
        )}

        {/* Группировка */}
        <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 cursor-pointer select-none px-2">
          <input
            type="checkbox"
            checked={groupByStatus}
            onChange={e => setGroupByStatus(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          {t('orders.groupByStatus')}
        </label>

        {/* Refresh */}
        <button
          onClick={refetch}
          className="px-3 py-1.5 text-sm rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition"
          title={t('orders.refresh')}
        >
          ↻
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Контент */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 dark:text-slate-500">
          <div className="inline-block animate-pulse">{t('orders.loading')}</div>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="text-5xl mb-3">📋</div>
          <h3 className="text-slate-700 dark:text-slate-300 font-medium">{t('orders.emptyWithCreate')}</h3>
          <button
            onClick={() => navigate('/orders/new')}
            className="mt-4 inline-flex items-center gap-1.5 bg-teal-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-teal-700 transition"
          >
            <PlusIcon /> {t('orders.emptyAction')}
          </button>
        </div>
      ) : grouped ? (
        <div className="space-y-6">
          {Object.entries(grouped).map(([key, items]) =>
            items.length > 0 ? (
              <div key={key}>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 px-1 flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">{items.length}</span>
                  {key === 'scheduled' && t('orders.planned')}
                  {key === 'in_progress' && t('orders.inProgress')}
                  {key === 'completed' && t('orders.completed')}
                  {key === 'cancelled' && t('orders.cancelled')}
                  {key === 'other' && key}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      showCreatedBy
                      onClick={o => navigate(`/protocol/${o.id}`)}
                    />
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              showCreatedBy
              onClick={o => navigate(`/protocol/${o.id}`)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && total > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="text-slate-500 dark:text-slate-400">
            {t('orders.show')} <span className="font-medium text-slate-700 dark:text-slate-200">{startItem}–{endItem}</span> {t('orders.of')} <span className="font-medium text-slate-700 dark:text-slate-200">{total}</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={perPage}
              onChange={e => { setPerPage(Number(e.target.value)); setPage(1) }}
              className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
            >
              {[10, 20, 50, 100].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <ChevronLeftIcon /> {t('orders.prev')}
            </button>
            <span className="px-2">
              {t('orders.page')} <span className="font-medium">{page}</span> / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={!hasMore}
              className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {t('orders.next')} <ChevronRightIcon />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
