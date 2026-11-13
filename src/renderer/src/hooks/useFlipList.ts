import { useCallback, useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { useReducedMotion } from './useReducedMotion'

export function useFlipList(ids: string[]): (id: string) => (element: HTMLElement | null) => void {
  const positions = useRef(new Map<string, number>())
  const elements = useRef(new Map<string, HTMLElement>())
  const reduced = useReducedMotion()
  const idSet = new Set(ids)

  useLayoutEffect(() => {
    const next = new Map<string, number>()
    for (const [id, element] of elements.current) {
      if (!idSet.has(id)) continue
      next.set(id, element.getBoundingClientRect().top)
    }

    if (!reduced) {
      for (const [id, element] of elements.current) {
        if (!idSet.has(id)) continue
        const previous = positions.current.get(id)
        const current = next.get(id)
        if (previous === undefined || current === undefined) continue
        const delta = previous - current
        if (Math.abs(delta) < 1) continue
        gsap.fromTo(element, { y: delta }, { y: 0, duration: 0.38, ease: 'power2.out', overwrite: 'auto' })
      }
    }

    positions.current = next
  })

  return useCallback(
    (id: string) => (element: HTMLElement | null) => {
      if (element) elements.current.set(id, element)
      else elements.current.delete(id)
    },
    []
  )
}
