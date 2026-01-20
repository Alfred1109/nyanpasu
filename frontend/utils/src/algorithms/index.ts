/**
 * 统一算法工具库 - 第四轮冗余修复
 * 解决项目中重复的数据处理算法和对象操作模式
 */

/**
 * 对象操作工具 - 解决大量重复的Object.entries/keys/values模式
 */
export const ObjectUtils = {
  /**
   * 安全的Object.entries，自动过滤undefined/null值
   */
  safeEntries<T extends Record<string, any>>(obj: T | null | undefined): Array<[string, NonNullable<T[keyof T]>]> {
    if (!obj) return []
    return Object.entries(obj).filter(([, value]) => value != null) as Array<[string, NonNullable<T[keyof T]>]>
  },

  /**
   * 带过滤的Object.entries映射
   */
  entriesMap<T, R>(
    obj: Record<string, T> | null | undefined,
    mapper: (key: string, value: T, index: number) => R,
    filter?: (key: string, value: T) => boolean
  ): R[] {
    if (!obj) return []
    const entries = Object.entries(obj)
    const filteredEntries = filter ? entries.filter(([k, v]) => filter(k, v)) : entries
    return filteredEntries.map(([key, value], index) => mapper(key, value, index))
  },

  /**
   * 对象键值转换 - 解决多处相同的对象转换逻辑
   */
  mapKeys<T>(obj: Record<string, T>, mapper: (key: string) => string): Record<string, T> {
    const result: Record<string, T> = {}
    Object.entries(obj).forEach(([key, value]) => {
      result[mapper(key)] = value
    })
    return result
  },

  /**
   * 对象值转换
   */
  mapValues<T, R>(obj: Record<string, T>, mapper: (value: T, key: string) => R): Record<string, R> {
    const result: Record<string, R> = {}
    Object.entries(obj).forEach(([key, value]) => {
      result[key] = mapper(value, key)
    })
    return result
  },

  /**
   * 深度合并对象 - 解决配置合并的重复逻辑
   */
  deepMerge<T extends Record<string, any>>(target: T, ...sources: Partial<T>[]): T {
    if (!sources.length) return target
    const source = sources.shift()

    if (this.isObject(target) && this.isObject(source)) {
      for (const key in source) {
        if (this.isObject(source[key])) {
          if (!target[key]) Object.assign(target, { [key]: {} })
          this.deepMerge(target[key] as any, source[key] as any)
        } else {
          Object.assign(target, { [key]: source[key] })
        }
      }
    }

    return this.deepMerge(target, ...sources)
  },

  /**
   * 对象是否为普通对象判断
   */
  isObject(item: any): item is Record<string, any> {
    return item && typeof item === 'object' && !Array.isArray(item)
  },

  /**
   * 安全获取嵌套属性值
   */
  get<T = any>(obj: any, path: string, defaultValue?: T): T {
    const keys = path.split('.')
    let result = obj
    
    for (const key of keys) {
      result = result?.[key]
      if (result === undefined) return defaultValue as T
    }
    
    return result as T
  }
}

/**
 * 数组操作工具 - 解决重复的数组处理模式
 */
export const ArrayUtils = {
  /**
   * 分组操作 - 解决重复的数组分组逻辑
   */
  groupBy<T, K extends string | number>(
    array: T[],
    keySelector: (item: T) => K
  ): Record<K, T[]> {
    return array.reduce((groups, item) => {
      const key = keySelector(item)
      if (!groups[key]) groups[key] = []
      groups[key].push(item)
      return groups
    }, {} as Record<K, T[]>)
  },

  /**
   * 去重操作 - 基于键的去重
   */
  uniqueBy<T, K>(array: T[], keySelector: (item: T) => K): T[] {
    const seen = new Set<K>()
    return array.filter(item => {
      const key = keySelector(item)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  },

  /**
   * 安全的数组操作链 - 避免对undefined数组的操作
   */
  chain<T>(array: T[] | null | undefined) {
    const safeArray = array || []
    return {
      filter: (predicate: (item: T) => boolean) => ArrayUtils.chain(safeArray.filter(predicate)),
      map: <R>(mapper: (item: T) => R) => ArrayUtils.chain(safeArray.map(mapper)),
      sort: (compareFn?: (a: T, b: T) => number) => ArrayUtils.chain([...safeArray].sort(compareFn)),
      slice: (start?: number, end?: number) => ArrayUtils.chain(safeArray.slice(start, end)),
      value: () => safeArray
    }
  },

  /**
   * 分页操作
   */
  paginate<T>(array: T[], page: number, pageSize: number): {
    items: T[]
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  } {
    const totalPages = Math.ceil(array.length / pageSize)
    const start = (page - 1) * pageSize
    const end = start + pageSize
    
    return {
      items: array.slice(start, end),
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  },

  /**
   * 数组差集操作
   */
  difference<T>(array1: T[], array2: T[], keySelector?: (item: T) => any): T[] {
    if (!keySelector) {
      return array1.filter(item => !array2.includes(item))
    }
    
    const keys2 = new Set(array2.map(keySelector))
    return array1.filter(item => !keys2.has(keySelector(item)))
  }
}

/**
 * 数据格式化工具 - 解决重复的格式化逻辑
 */
export const FormatUtils = {
  /**
   * 流量格式化 - 统一parseTraffic逻辑
   */
  formatBytes(bytes?: string | number, precision = 2): [string, string] {
    const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    
    if (typeof bytes !== 'number') {
      const tmp = Number(bytes)
      if (isNaN(tmp)) return ['NaN', '']
      bytes = tmp
    }

    if (bytes <= 0) return ['0', 'B']

    const exp = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      UNITS.length - 1,
    )
    const value = bytes / Math.pow(1024, exp)
    
    let formatted: string
    if (value < 1) {
      formatted = value.toPrecision(2)
    } else if (value < 10) {
      formatted = value.toPrecision(3)
    } else {
      formatted = value >= 1000 ? value.toFixed(0) : value.toPrecision(3)
    }

    return [formatted, UNITS[exp]]
  },

  /**
   * 时间格式化
   */
  formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  },

  /**
   * 数字格式化
   */
  formatNumber(num: number, options?: {
    precision?: number
    separator?: string
    suffix?: string
  }): string {
    const { precision = 0, separator = ',', suffix = '' } = options || {}
    
    const formatted = num.toFixed(precision)
    const parts = formatted.split('.')
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, separator)
    
    return parts.join('.') + suffix
  },

  /**
   * 键名格式化 - 解决重复的键名转换
   */
  formatKey(key: string): string {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }
}

/**
 * 搜索和过滤工具 - 解决重复的搜索逻辑
 */
export const SearchUtils = {
  /**
   * 深度搜索 - 统一containsSearchTerm逻辑
   */
  deepSearch(obj: unknown, term: string, caseSensitive = false): boolean {
    if (!obj || !term) return false
    
    const searchTerm = caseSensitive ? term : term.toLowerCase()
    
    if (typeof obj === 'string') {
      const text = caseSensitive ? obj : obj.toLowerCase()
      return text.includes(searchTerm)
    }
    
    if (typeof obj === 'number') {
      return obj.toString().includes(searchTerm)
    }
    
    if (Array.isArray(obj)) {
      return obj.some(item => this.deepSearch(item, term, caseSensitive))
    }
    
    if (typeof obj === 'object') {
      return Object.values(obj).some(value => this.deepSearch(value, term, caseSensitive))
    }
    
    return false
  },

  /**
   * 高亮搜索结果
   */
  highlightMatch(text: string, term: string, className = 'highlight'): string {
    if (!term) return text
    
    const regex = new RegExp(`(${term})`, 'gi')
    return text.replace(regex, `<span class="${className}">$1</span>`)
  },

  /**
   * 模糊搜索
   */
  fuzzySearch(items: string[], query: string, threshold = 0.6): string[] {
    if (!query) return items
    
    return items.filter(item => {
      const similarity = this.calculateSimilarity(item.toLowerCase(), query.toLowerCase())
      return similarity >= threshold
    })
  },

  /**
   * 计算字符串相似度
   */
  calculateSimilarity(str1: string, str2: string): number {
    const len1 = str1.length
    const len2 = str2.length
    
    if (len1 === 0) return len2 === 0 ? 1 : 0
    if (len2 === 0) return 0
    
    const matrix: number[][] = []
    
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i]
    }
    
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j
    }
    
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,    // deletion
            matrix[i][j - 1] + 1,    // insertion
            matrix[i - 1][j - 1] + 1 // substitution
          )
        }
      }
    }
    
    const distance = matrix[len1][len2]
    return 1 - distance / Math.max(len1, len2)
  }
}

/**
 * 验证工具 - 解决重复的验证逻辑
 */
export const ValidationUtils = {
  /**
   * URL验证
   */
  isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  },

  /**
   * 深度链接URL验证
   */
  isValidDeepLinkUrl(url: string): boolean {
    return url.includes('://') && !url.trim() === false
  },

  /**
   * 配置对象验证
   */
  validateConfig<T extends Record<string, any>>(
    config: T,
    schema: Record<keyof T, (value: any) => boolean>
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = []
    
    for (const [key, validator] of Object.entries(schema)) {
      if (!validator(config[key])) {
        errors.push(`Invalid value for ${key}`)
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }
}

/**
 * 性能优化工具 - 解决重复的性能优化模式
 */
export const PerformanceUtils = {
  /**
   * 防抖函数工厂
   */
  createDebounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null
    
    return (...args: Parameters<T>) => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => func(...args), wait)
    }
  },

  /**
   * 节流函数工厂
   */
  createThrottle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle = false
    
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args)
        inThrottle = true
        setTimeout(() => inThrottle = false, limit)
      }
    }
  },

  /**
   * 记忆化函数
   */
  memoize<T extends (...args: any[]) => any>(
    func: T,
    keyGenerator?: (...args: Parameters<T>) => string
  ): T {
    const cache = new Map<string, ReturnType<T>>()
    
    return ((...args: Parameters<T>) => {
      const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args)
      
      if (cache.has(key)) {
        return cache.get(key)
      }
      
      const result = func(...args)
      cache.set(key, result)
      return result
    }) as T
  }
}

/**
 * 统一导出所有工具
 */
export const AlgorithmUtils = {
  Object: ObjectUtils,
  Array: ArrayUtils,
  Format: FormatUtils,
  Search: SearchUtils,
  Validation: ValidationUtils,
  Performance: PerformanceUtils
}

export default AlgorithmUtils
