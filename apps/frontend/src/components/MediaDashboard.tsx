import { useEffect, useMemo, useState } from 'react'
import { mediaGovernanceService } from '@/services/mediaGovernanceService'
import type { MediaDeletePreflight, MediaFile } from '@/types/media'

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / Math.pow(1024, idx)).toFixed(2)} ${units[idx]}`
}

export function MediaDashboard() {
  const [loading, setLoading] = useState(true)
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [storageBytes, setStorageBytes] = useState(0)
  const [distribution, setDistribution] = useState<Record<string, number>>({})
  const [libraryMedia, setLibraryMedia] = useState<MediaFile[]>([])
  const [topUsed, setTopUsed] = useState<MediaFile[]>([])
  const [unusedCandidates, setUnusedCandidates] = useState<MediaFile[]>([])
  const [deletePreflight, setDeletePreflight] = useState<MediaDeletePreflight | null>(null)

  const loadDashboard = async () => {
    setLoading(true)
    setError(null)
    try {
      const [summary, unused, library] = await Promise.all([
        mediaGovernanceService.fetchDashboardSummary(),
        mediaGovernanceService.fetchUnusedMediaCandidates(),
        mediaGovernanceService.fetchLibraryMedia(),
      ])
      setStorageBytes(summary.storageBytes)
      setDistribution(summary.distribution)
      setLibraryMedia(library)
      setTopUsed(summary.topUsed)
      setUnusedCandidates(unused)
    } catch (err) {
      setError(err instanceof Error ? err.message : '無法載入媒體儀表板')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDashboard()
  }, [])

  const distributionRows = useMemo(
    () => Object.entries(distribution).sort((a, b) => b[1] - a[1]),
    [distribution]
  )

  const handleDeleteAsset = async (mediaId: string) => {
    try {
      setDeletingMediaId(mediaId)
      setError(null)
      setDeletePreflight(null)

      const supabase = (await import('@/lib/supabase')).getSupabaseClient()
      const userId = (await supabase.auth.getUser()).data.user?.id
      if (!userId) throw new Error('使用者尚未登入')

      const preflight = await mediaGovernanceService.getDeletePreflight(mediaId)
      if (!preflight.canDelete) {
        setDeletePreflight(preflight)
        return
      }

      await mediaGovernanceService.safeDeleteUnusedMedia(mediaId, userId, 'dashboard_unused_cleanup')
      await loadDashboard()
    } catch (err) {
      setError(err instanceof Error ? err.message : '無法刪除未使用的媒體')
    } finally {
      setDeletingMediaId(null)
    }
  }

  if (loading) {
    return <div className="p-4 text-sm text-gray-600">正在載入媒體儀表板...</div>
  }

  return (
    <section className="space-y-4">
      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="border rounded-lg p-4 bg-white">
          <div className="text-xs text-gray-500">儲存空間使用量</div>
          <div className="text-xl font-semibold">{formatBytes(storageBytes)}</div>
        </div>
        <div className="border rounded-lg p-4 bg-white md:col-span-2">
          <div className="text-xs text-gray-500 mb-2">媒體類型分布</div>
          <div className="flex flex-wrap gap-2 text-sm">
            {distributionRows.map(([type, count]) => (
              <span key={type} className="px-2 py-1 bg-gray-100 rounded">
                {type}: {count}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4 bg-white">
        <h3 className="text-sm font-semibold mb-2">最常使用的媒體</h3>
        <ul className="space-y-1 text-sm">
          {topUsed.map((item) => (
            <li key={item.id} className="flex items-center justify-between">
              <span className="truncate">{item.fileName}</span>
              <span className="text-xs text-gray-500">{item.usageCount || 0} 處引用</span>
            </li>
          ))}
          {topUsed.length === 0 ? <li className="text-gray-500">尚無使用資料。</li> : null}
        </ul>
      </div>

      <div className="border rounded-lg p-4 bg-white">
        <h3 className="text-sm font-semibold mb-2">未使用的媒體候選項目</h3>
        <ul className="space-y-2">
          {unusedCandidates.map((item) => (
            <li key={item.id} className="flex items-center justify-between text-sm">
              <span className="truncate">{item.fileName}</span>
              <button
                type="button"
                onClick={() => void handleDeleteAsset(item.id)}
                disabled={deletingMediaId === item.id}
                className="px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100"
              >
                {deletingMediaId === item.id ? '刪除中...' : '刪除'}
              </button>
            </li>
          ))}
          {unusedCandidates.length === 0 ? (
            <li className="text-sm text-gray-500">沒有可刪除的未使用媒體。</li>
          ) : null}
        </ul>
      </div>

      <div className="border rounded-lg p-4 bg-white">
        <h3 className="text-sm font-semibold mb-2">所有媒體檔案</h3>
        <ul className="space-y-3">
          {libraryMedia.map((item) => (
            <li key={item.id} className="border rounded-md p-3">
              <div className="flex items-start justify-between gap-4 text-sm">
                <div className="min-w-0">
                  <div className="font-medium truncate">{item.fileName}</div>
                  <div className="text-xs text-gray-500">
                    {item.mediaType} · {formatBytes(item.fileSize)} · {item.usageCount || 0} 處引用
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDeleteAsset(item.id)}
                  disabled={deletingMediaId === item.id}
                  className="shrink-0 px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
                >
                  {deletingMediaId === item.id ? '檢查中...' : '刪除'}
                </button>
              </div>

              {deletePreflight?.mediaId === item.id && !deletePreflight.canDelete ? (
                <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                  <div className="font-medium">
                    無法刪除： {deletePreflight.activeUsageCount} 仍有使用中的引用。
                  </div>
                  <ul className="mt-2 space-y-1 text-xs">
                    {deletePreflight.impacts.map((impact) => (
                      <li key={impact.usageId}>
                        {impact.targetType} `{impact.targetId}` 透過 `{impact.contextKey}`
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
          {libraryMedia.length === 0 ? (
            <li className="text-sm text-gray-500">找不到媒體檔案。</li>
          ) : null}
        </ul>
      </div>
    </section>
  )
}

export default MediaDashboard
