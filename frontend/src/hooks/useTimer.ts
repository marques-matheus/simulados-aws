/**
 * useTimer — hook de cronômetro para simulados.
 * Migrado do `app.js` original.
 */
import { useState, useRef, useCallback, useEffect } from 'react'

export interface TimerState {
  /** Segundos decorridos */
  elapsed: number
  /** Se está pausado */
  isPaused: boolean
  /** Texto formatado MM:SS */
  formatted: string
}

export function useTimer() {
  const [elapsed, setElapsed] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function formatTime(s: number): string {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0')
  }

  const start = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setIsPaused(false)
    intervalRef.current = setInterval(() => {
      setElapsed(prev => prev + 1)
    }, 1000)
  }, [])

  const pause = useCallback(() => {
    setIsPaused(true)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const resume = useCallback(() => {
    setIsPaused(false)
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      setElapsed(prev => prev + 1)
    }, 1000)
  }, [])

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setIsPaused(false)
  }, [])

  const reset = useCallback(() => {
    stop()
    setElapsed(0)
  }, [stop])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return {
    elapsed,
    isPaused,
    formatted: formatTime(elapsed),
    start,
    pause,
    resume,
    stop,
    reset,
    formatTime,
  }
}
