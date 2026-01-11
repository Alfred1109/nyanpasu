// UI related utilities consolidated from various sources
import { includes, isArray, isObject, isString, some } from 'lodash-es'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * classNames filter out falsy values and join the rest with a space
 * Consolidated from frontend/nyanpasu/src/utils/index.ts
 */
export function classNames(...classes: unknown[]) {
  return classes.filter(Boolean).join(' ')
}

/**
 * Utility for combining Tailwind CSS classes with clsx and twMerge
 * From frontend/ui/src/utils/cn.ts
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Color mixing utility for CSS
 * From frontend/ui/src/utils/color-mix.ts
 */
export function colorMix(color1: string, color2: string, percentage = 50): string {
  return `color-mix(in srgb, ${color1} ${percentage}%, ${color2})`
}

/**
 * Event utility functions
 * From frontend/ui/src/utils/event.ts
 */
export function preventDefault(event: Event) {
  event.preventDefault()
}

export function stopPropagation(event: Event) {
  event.stopPropagation()
}
