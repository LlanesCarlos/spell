import { useEffect, useRef } from 'react'

export function useKeyboard() {
  const keys = useRef({})

  useEffect(() => {
    const isTyping = () => {
      const tag = document.activeElement?.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA'
    }
    const down = (e) => { if (!isTyping()) keys.current[e.code] = true }
    const up = (e) => { keys.current[e.code] = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  return keys
}
