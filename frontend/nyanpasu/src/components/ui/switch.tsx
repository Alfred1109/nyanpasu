import React from 'react'
import { cn } from '@nyanpasu/ui'
import { Switch as MuiSwitch, SwitchProps as MuiSwitchProps } from '@mui/material'
import { CircularProgress } from './progress'

export interface SwitchProps extends Omit<MuiSwitchProps, 'className'> {
  className?: string
  loading?: boolean
}

export const Switch = ({
  className,
  loading,
  ...props
}: SwitchProps) => {
  return (
    <MuiSwitch
      className={cn(className)}
      disabled={loading || props.disabled}
      {...props}
      icon={
        loading ? (
          <CircularProgress
            className="size-4! text-current"
            indeterminate
          />
        ) : undefined
      }
      checkedIcon={
        loading ? (
          <CircularProgress
            className="size-4! text-current"
            indeterminate
          />
        ) : undefined
      }
    />
  )
}
