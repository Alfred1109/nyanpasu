/**
 * 响应式和可见性检测Hook库
 * 整合断点检测、可见性检测等相似Hook实现，减少重复逻辑
 */

import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * 断点配置类型
 */
export interface BreakpointConfig {
  [key: string]: number
}

/**
 * 默认断点配置 - 基于Material Design断点
 */
export const DEFAULT_BREAKPOINTS: BreakpointConfig = {
  xs: 0,
  sm: 600,
  md: 960,
  lg: 1280,
  xl: 1920,
}

/**
 * 统一的断点检测Hook
 * 整合 use-breakpoint.ts 和 use-element-breakpoints.ts 的逻辑
 */
export const useBreakpoint = (
  breakpoints: BreakpointConfig = DEFAULT_BREAKPOINTS
) => {
  const [currentBreakpoint, setCurrentBreakpoint] = useState<string>('md')
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })

  const updateBreakpoint = useCallback(() => {
    const width = window.innerWidth
    const height = window.innerHeight
    
    setWindowSize({ width, height })
    
    // 找到匹配的断点
    const sortedBreakpoints = Object.entries(breakpoints)
      .sort(([, a], [, b]) => b - a) // 从大到小排序
    
    for (const [name, minWidth] of sortedBreakpoints) {
      if (width >= minWidth) {
        setCurrentBreakpoint(name)
        break
      }
    }
  }, [breakpoints])

  useEffect(() => {
    // 初始化
    updateBreakpoint()
    
    // 监听窗口大小变化
    window.addEventListener('resize', updateBreakpoint)
    
    return () => {
      window.removeEventListener('resize', updateBreakpoint)
    }
  }, [updateBreakpoint])

  // 检查是否匹配特定断点
  const isBreakpoint = useCallback((breakpointName: string) => {
    return currentBreakpoint === breakpointName
  }, [currentBreakpoint])

  // 检查是否大于等于特定断点
  const isAboveBreakpoint = useCallback((breakpointName: string) => {
    const currentValue = breakpoints[currentBreakpoint] || 0
    const targetValue = breakpoints[breakpointName] || 0
    return currentValue >= targetValue
  }, [currentBreakpoint, breakpoints])

  // 检查是否小于特定断点
  const isBelowBreakpoint = useCallback((breakpointName: string) => {
    const currentValue = breakpoints[currentBreakpoint] || 0
    const targetValue = breakpoints[breakpointName] || 0
    return currentValue < targetValue
  }, [currentBreakpoint, breakpoints])

  return {
    currentBreakpoint,
    windowSize,
    isBreakpoint,
    isAboveBreakpoint,
    isBelowBreakpoint,
    // 常用的快捷检查
    isMobile: isBelowBreakpoint('md'),
    isTablet: isBreakpoint('md'),
    isDesktop: isAboveBreakpoint('lg'),
  }
}

/**
 * 元素级别的断点检测Hook
 * 基于元素大小而非窗口大小进行断点检测
 */
export const useElementBreakpoint = <T extends HTMLElement = HTMLElement>(
  breakpoints: BreakpointConfig = DEFAULT_BREAKPOINTS,
  defaultBreakpoint = 'md'
) => {
  const [breakpoint, setBreakpoint] = useState<string>(defaultBreakpoint)
  const [elementSize, setElementSize] = useState({ width: 0, height: 0 })
  const elementRef = useRef<T>(null)

  useEffect(() => {
    let observer: ResizeObserver | null = null
    
    if (elementRef.current) {
      observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect
          setElementSize({ width, height })
          
          // 计算断点
          const sortedBreakpoints = Object.entries(breakpoints)
            .sort(([, a], [, b]) => b - a)
          
          for (const [name, minWidth] of sortedBreakpoints) {
            if (width >= minWidth) {
              setBreakpoint(name)
              break
            }
          }
        }
      })
      
      observer.observe(elementRef.current)
    }

    return () => {
      if (observer) {
        observer.disconnect()
      }
    }
  }, [breakpoints])

  return {
    elementRef,
    breakpoint,
    elementSize,
  }
}

/**
 * 统一的可见性检测Hook
 * 整合页面可见性和元素可见性检测
 */
export const useVisibility = () => {
  const [isVisible, setIsVisible] = useState<boolean>(!document.hidden)

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden)
    }

    // 监听页面可见性变化
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // 监听窗口焦点变化（备用检测）
    window.addEventListener('focus', () => setIsVisible(true))
    window.addEventListener('blur', () => setIsVisible(false))

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', () => setIsVisible(true))
      window.removeEventListener('blur', () => setIsVisible(false))
    }
  }, [])

  return isVisible
}

/**
 * 元素交集观察Hook
 * 检测元素是否在视口中可见
 */
export const useIntersectionObserver = <T extends HTMLElement = HTMLElement>(
  options?: IntersectionObserverInit
) => {
  const [isIntersecting, setIsIntersecting] = useState(false)
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null)
  const elementRef = useRef<T>(null)

  useEffect(() => {
    let observer: IntersectionObserver | null = null
    
    if (elementRef.current) {
      observer = new IntersectionObserver(
        (entries) => {
          const [entry] = entries
          setEntry(entry)
          setIsIntersecting(entry.isIntersecting)
        },
        {
          threshold: 0.1,
          ...options,
        }
      )
      
      observer.observe(elementRef.current)
    }

    return () => {
      if (observer) {
        observer.disconnect()
      }
    }
  }, [options])

  return {
    elementRef,
    isIntersecting,
    entry,
  }
}

/**
 * 媒体查询Hook
 * 基于CSS媒体查询的响应式检测
 */
export const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia(query)
    
    const handleChange = () => setMatches(mediaQuery.matches)
    
    // 现代浏览器使用addEventListener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    } else {
      // 兼容旧浏览器
      mediaQuery.addListener(handleChange)
      return () => mediaQuery.removeListener(handleChange)
    }
  }, [query])

  return matches
}

/**
 * 常用媒体查询Hook集合
 */
export const useCommonMediaQueries = () => {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)')
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const isLandscape = useMediaQuery('(orientation: landscape)')
  const isPortrait = useMediaQuery('(orientation: portrait)')
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)')
  const isHighDPI = useMediaQuery('(min-resolution: 2dppx)')

  return {
    isMobile,
    isTablet,
    isDesktop,
    isLandscape,
    isPortrait,
    prefersReducedMotion,
    prefersDarkMode,
    isHighDPI,
  }
}

/**
 * 滚动位置Hook
 * 监听窗口或元素的滚动位置
 */
export const useScrollPosition = <T extends HTMLElement = HTMLElement>(
  element?: React.RefObject<T>
) => {
  const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const targetElement = element?.current || window

    const handleScroll = () => {
      if (targetElement === window) {
        setScrollPosition({
          x: window.scrollX,
          y: window.scrollY,
        })
      } else if (targetElement instanceof HTMLElement) {
        setScrollPosition({
          x: targetElement.scrollLeft,
          y: targetElement.scrollTop,
        })
      }
    }

    handleScroll() // 获取初始位置

    targetElement.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      targetElement.removeEventListener('scroll', handleScroll)
    }
  }, [element])

  return scrollPosition
}

/**
 * 窗口大小Hook
 * 监听窗口大小变化
 */
export const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  })

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    window.addEventListener('resize', handleResize, { passive: true })

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return windowSize
}
