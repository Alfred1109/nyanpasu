import React, { useCallback, useMemo, useRef, useState } from 'react'

interface VirtualizedListProps<T> {
  items: T[]
  itemHeight: number
  containerHeight: number
  renderItem: (item: T, index: number) => React.ReactNode
  overscan?: number
  className?: string
}

/**
 * High-performance virtualized list component for large datasets
 * Only renders visible items to optimize memory usage and rendering performance
 */
export function VirtualizedList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  className,
}: VirtualizedListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const visibleRange = useMemo(() => {
    const visibleStart = Math.floor(scrollTop / itemHeight)
    const visibleEnd = Math.min(
      visibleStart + Math.ceil(containerHeight / itemHeight),
      items.length - 1,
    )

    return {
      start: Math.max(0, visibleStart - overscan),
      end: Math.min(items.length - 1, visibleEnd + overscan),
    }
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan])

  const visibleItems = useMemo(() => {
    const result = []
    for (let i = visibleRange.start; i <= visibleRange.end; i++) {
      result.push({
        index: i,
        item: items[i],
        style: {
          position: 'absolute' as const,
          top: i * itemHeight,
          height: itemHeight,
          width: '100%',
        },
      })
    }
    return result
  }, [items, visibleRange, itemHeight])

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = event.currentTarget.scrollTop
    setScrollTop(newScrollTop)
  }, [])

  const totalHeight = items.length * itemHeight

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        height: containerHeight,
        overflow: 'auto',
      }}
      onScroll={handleScroll}
    >
      <div
        style={{
          height: totalHeight,
          position: 'relative',
        }}
      >
        {visibleItems.map(({ index, item, style }) => (
          <div key={index} style={style}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Hook for managing large datasets with pagination and filtering
 * Optimizes memory usage by limiting loaded data
 */
export function useVirtualizedData<T>(
  allData: T[],
  pageSize = 1000,
  filterFn?: (item: T) => boolean,
) {
  const [currentPage, setCurrentPage] = useState(0)

  const filteredData = useMemo(() => {
    return filterFn ? allData.filter(filterFn) : allData
  }, [allData, filterFn])

  const paginatedData = useMemo(() => {
    const start = currentPage * pageSize
    const end = start + pageSize
    return filteredData.slice(start, end)
  }, [filteredData, currentPage, pageSize])

  const hasNextPage = useMemo(() => {
    return (currentPage + 1) * pageSize < filteredData.length
  }, [currentPage, pageSize, filteredData.length])

  const loadNextPage = useCallback(() => {
    if (hasNextPage) {
      setCurrentPage((prev) => prev + 1)
    }
  }, [hasNextPage])

  const resetPagination = useCallback(() => {
    setCurrentPage(0)
  }, [])

  return {
    data: paginatedData,
    currentPage,
    hasNextPage,
    totalItems: filteredData.length,
    loadNextPage,
    resetPagination,
    setCurrentPage,
  }
}
