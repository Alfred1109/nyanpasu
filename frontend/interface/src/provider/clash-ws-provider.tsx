import { useUpdateEffect } from 'ahooks'
import dayjs from 'dayjs'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  CLASH_CONNECTIONS_QUERY_KEY,
  CLASH_LOGS_QUERY_KEY,
  CLASH_MEMORY_QUERY_KEY,
  CLASH_TRAAFFIC_QUERY_KEY,
  MAX_CONNECTIONS_HISTORY,
  MAX_LOGS_HISTORY,
  MAX_MEMORY_HISTORY,
  MAX_TRAFFIC_HISTORY,
} from '../ipc/consts'
import type { ClashConnection } from '../ipc/use-clash-connections'
import type { ClashLog } from '../ipc/use-clash-logs'
import type { ClashMemory } from '../ipc/use-clash-memory'
import type { ClashTraffic } from '../ipc/use-clash-traffic'
import { useClashWebSocket } from '../ipc/use-clash-web-socket'
import { CircularBuffer } from '../utils/circular-buffer'

// Utility functions for localStorage persistence
const createPersistedState = (key: string, defaultValue: boolean) => {
  const getStoredValue = (): boolean => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : defaultValue
    } catch {
      return defaultValue
    }
  }

  const setStoredValue = (value: boolean) => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Ignore storage errors
    }
  }

  return { getStoredValue, setStoredValue }
}

const ClashWSContext = createContext<{
  recordLogs: boolean
  setRecordLogs: (value: boolean) => void
  recordTraffic: boolean
  setRecordTraffic: (value: boolean) => void
  recordMemory: boolean
  setRecordMemory: (value: boolean) => void
  recordConnections: boolean
  setRecordConnections: (value: boolean) => void
} | null>(null)

export const useClashWSContext = () => {
  const context = useContext(ClashWSContext)

  if (!context) {
    throw new Error('useClashWSContext must be used in a ClashWSProvider')
  }

  return context
}

export const ClashWSProvider = ({ children }: PropsWithChildren) => {
  // High-performance circular buffers for WebSocket data
  const connectionsBuffer = useRef(new CircularBuffer<ClashConnection>(MAX_CONNECTIONS_HISTORY))
  const memoryBuffer = useRef(new CircularBuffer<ClashMemory>(MAX_MEMORY_HISTORY))
  const trafficBuffer = useRef(new CircularBuffer<ClashTraffic>(MAX_TRAFFIC_HISTORY))
  const logsBuffer = useRef(new CircularBuffer<ClashLog>(MAX_LOGS_HISTORY))

  // Create persisted state handlers
  const logsStorage = useMemo(
    () => createPersistedState('clash-ws-record-logs', true),
    [],
  )
  const trafficStorage = useMemo(
    () => createPersistedState('clash-ws-record-traffic', true),
    [],
  )
  const memoryStorage = useMemo(
    () => createPersistedState('clash-ws-record-memory', true),
    [],
  )
  const connectionsStorage = useMemo(
    () => createPersistedState('clash-ws-record-connections', true),
    [],
  )

  // Initialize states with persisted values
  const [recordLogs, setRecordLogsState] = useState(logsStorage.getStoredValue)
  const [recordTraffic, setRecordTrafficState] = useState(
    trafficStorage.getStoredValue,
  )
  const [recordMemory, setRecordMemoryState] = useState(
    memoryStorage.getStoredValue,
  )
  const [recordConnections, setRecordConnectionsState] = useState(
    connectionsStorage.getStoredValue,
  )

  // Wrapped setters that also persist to localStorage
  const setRecordLogs = useCallback(
    (value: boolean) => {
      setRecordLogsState(value)
      logsStorage.setStoredValue(value)
    },
    [logsStorage],
  )

  const setRecordTraffic = useCallback(
    (value: boolean) => {
      setRecordTrafficState(value)
      trafficStorage.setStoredValue(value)
    },
    [trafficStorage],
  )

  const setRecordMemory = useCallback(
    (value: boolean) => {
      setRecordMemoryState(value)
      memoryStorage.setStoredValue(value)
    },
    [memoryStorage],
  )

  const setRecordConnections = useCallback(
    (value: boolean) => {
      setRecordConnectionsState(value)
      connectionsStorage.setStoredValue(value)
    },
    [connectionsStorage],
  )

  const { connectionsWS, memoryWS, trafficWS, logsWS } = useClashWebSocket()

  const queryClient = useQueryClient()

  // clash connections - optimized with circular buffer
  useUpdateEffect(() => {
    if (!recordConnections) {
      return
    }

    const data = JSON.parse(
      connectionsWS.latestMessage?.data,
    ) as ClashConnection

    // Use high-performance circular buffer instead of inefficient array operations
    connectionsBuffer.current.push(data)
    
    // Update React Query cache with buffer data
    queryClient.setQueryData([CLASH_CONNECTIONS_QUERY_KEY], connectionsBuffer.current.toArray())
  }, [connectionsWS.latestMessage, recordConnections])

  // clash memory - optimized with circular buffer
  useUpdateEffect(() => {
    if (!recordMemory) {
      return
    }

    const data = JSON.parse(memoryWS.latestMessage?.data) as ClashMemory

    // Use high-performance circular buffer instead of inefficient array operations
    memoryBuffer.current.push(data)
    
    // Update React Query cache with buffer data
    queryClient.setQueryData([CLASH_MEMORY_QUERY_KEY], memoryBuffer.current.toArray())
  }, [memoryWS.latestMessage, recordMemory])

  // clash traffic - optimized with circular buffer
  useUpdateEffect(() => {
    if (!recordTraffic) {
      return
    }

    const data = JSON.parse(trafficWS.latestMessage?.data) as ClashTraffic

    // Use high-performance circular buffer instead of inefficient array operations
    trafficBuffer.current.push(data)
    
    // Update React Query cache with buffer data
    queryClient.setQueryData([CLASH_TRAAFFIC_QUERY_KEY], trafficBuffer.current.toArray())
  }, [trafficWS.latestMessage, recordTraffic])

  // clash logs - optimized with circular buffer
  useUpdateEffect(() => {
    if (!recordLogs) {
      return
    }

    const data = {
      ...JSON.parse(logsWS.latestMessage?.data),
      time: dayjs(new Date()).format('HH:mm:ss'),
    } as ClashLog

    // Use high-performance circular buffer instead of inefficient array operations
    logsBuffer.current.push(data)
    
    // Update React Query cache with buffer data
    queryClient.setQueryData([CLASH_LOGS_QUERY_KEY], logsBuffer.current.toArray())
  }, [logsWS.latestMessage, recordLogs])

  const contextValue = useMemo(
    () => ({
      recordLogs,
      setRecordLogs,
      recordTraffic,
      setRecordTraffic,
      recordMemory,
      setRecordMemory,
      recordConnections,
      setRecordConnections,
    }),
    [
      recordConnections,
      recordLogs,
      recordMemory,
      recordTraffic,
      setRecordConnections,
      setRecordLogs,
      setRecordMemory,
      setRecordTraffic,
    ],
  )

  return (
    <ClashWSContext.Provider value={contextValue}>
      {children}
    </ClashWSContext.Provider>
  )
}
