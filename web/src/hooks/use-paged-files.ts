import { useCallback, useEffect, useRef, useState } from "react"
import { FileInfo } from "@/api/file"

const PAGE_SIZE = 40

type ListFiles = (workspaceId: string, query?: string, ext?: string, pageSize?: number, pageNumber?: number) => Promise<{ files: FileInfo[] }>

interface UsePagedFilesOptions {
  open: boolean
  workspaceId: string
  listFiles: ListFiles
  query: string
  ext?: string
  /** Drops files from each page client-side; paging still follows the raw page size. */
  include?: (file: FileInfo) => boolean
}

/**
 * Infinite-scrolling file list for picker dialogs. Loads page 1 whenever the
 * dialog opens or the query/ext changes, and the next page whenever
 * sentinelRef scrolls into view inside scrollRef. Call refresh() to pick up
 * newly added files without resetting the list.
 */
const usePagedFiles = ({ open, workspaceId, listFiles, query, ext, include }: UsePagedFilesOptions) => {
  const [files, setFiles] = useState<FileInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef(1)
  const loadingMoreRef = useRef(false)
  // Bumped on every reload so responses for an older query are dropped.
  const requestIdRef = useRef(0)
  const includeRef = useRef(include)
  includeRef.current = include

  const fetchPage = useCallback(async (page: number) => {
    const result = await listFiles(workspaceId, query, ext, PAGE_SIZE, page)
    const raw = result.files || []
    const keep = includeRef.current
    return {
      files: keep ? raw.filter(keep) : raw,
      hasMore: raw.length >= PAGE_SIZE,
    }
  }, [workspaceId, query, ext, listFiles])

  const reload = useCallback(async () => {
    if (!workspaceId) return
    const requestId = ++requestIdRef.current
    pageRef.current = 1
    loadingMoreRef.current = false
    setIsLoadingMore(false)
    setIsLoading(true)
    try {
      const page = await fetchPage(1)
      if (requestId !== requestIdRef.current) return
      setFiles(page.files)
      setHasMore(page.hasMore)
    } catch (error) {
      if (requestId !== requestIdRef.current) return
      console.error('Failed to load files:', error)
      setFiles([])
      setHasMore(false)
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false)
    }
  }, [workspaceId, fetchPage])

  // Background refresh (e.g. after an upload): the list is newest-first, so
  // new files are on page 1. Prepends them without clearing the list, so the
  // loaded pages and scroll position stay put.
  const refresh = useCallback(async () => {
    if (!workspaceId) return
    const requestId = requestIdRef.current
    try {
      const page = await fetchPage(1)
      if (requestId !== requestIdRef.current) return
      setFiles(prev => {
        const seen = new Set(prev.map(f => f.id))
        const added = page.files.filter(f => !seen.has(f.id))
        return added.length ? [...added, ...prev] : prev
      })
    } catch (error) {
      console.error('Failed to refresh files:', error)
    }
  }, [workspaceId, fetchPage])

  const loadMore = useCallback(async () => {
    if (!workspaceId || !hasMore || loadingMoreRef.current) return
    const requestId = requestIdRef.current
    const nextPage = pageRef.current + 1
    loadingMoreRef.current = true
    setIsLoadingMore(true)
    try {
      const page = await fetchPage(nextPage)
      if (requestId !== requestIdRef.current) return
      pageRef.current = nextPage
      setFiles(prev => {
        const seen = new Set(prev.map(f => f.id))
        return [...prev, ...page.files.filter(f => !seen.has(f.id))]
      })
      setHasMore(page.hasMore)
    } catch (error) {
      if (requestId !== requestIdRef.current) return
      console.error('Failed to load more files:', error)
      setHasMore(false)
    } finally {
      if (requestId === requestIdRef.current) {
        loadingMoreRef.current = false
        setIsLoadingMore(false)
      }
    }
  }, [workspaceId, hasMore, fetchPage])

  useEffect(() => {
    if (open) reload()
  }, [open, reload])

  // Re-created after every page so a sentinel that is still visible once the
  // new page renders (short pages, tall screens) triggers the next load.
  useEffect(() => {
    const root = scrollRef.current
    const sentinel = sentinelRef.current
    if (!open || isLoading || !hasMore || !root || !sentinel) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore()
    }, { root, rootMargin: '200px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [open, isLoading, hasMore, loadMore, files.length])

  return { files, isLoading, isLoadingMore, refresh, scrollRef, sentinelRef }
}

export default usePagedFiles
