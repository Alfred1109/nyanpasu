import { useControllableValue } from 'ahooks'
import { memo, ReactNode } from 'react'
// mergeSxProps removed in extreme cleanup
import { CircularProgress } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
// alpha removed in extreme cleanup
import { PaperButton, PaperButtonProps } from './nyanpasu-path'

export interface PaperSwitchButtonProps extends PaperButtonProps {
  label?: string
  checked: boolean
  loading?: boolean
  disableLoading?: boolean
  children?: ReactNode
  onClick?: () => Promise<void> | void
  sxPaper?: SxProps<Theme>
}

export const PaperSwitchButton = memo(function PaperSwitchButton({
  label,
  checked,
  loading,
  disableLoading,
  children,
  onClick,
  sxPaper,
  ...props
}: PaperSwitchButtonProps) {
  const [pending, setPending] = useControllableValue<boolean>(
    { loading },
    {
      defaultValue: false,
    },
  )

  const handleClick = async () => {
    if (onClick) {
      if (disableLoading) {
        return onClick()
      }

      setPending(true)
      await onClick()
      setPending(false)
    }
  }

  return (
    <PaperButton
      label={label}
      sxPaper={{
        backgroundColor: checked 
          ? 'action.selected' 
          : 'background.paper',
      }}
      sxButton={{
        flexDirection: 'column',
        alignItems: 'start',
        gap: 0.5,
      }}
      onClick={handleClick}
      {...props}
    >
      {pending === true && (
        <CircularProgress
          sx={{
            position: 'absolute',
            bottom: 'calc(50% - 12px)',
            right: 12,
          }}
          color="inherit"
          size={24}
        />
      )}

      {children}
    </PaperButton>
  )
})
