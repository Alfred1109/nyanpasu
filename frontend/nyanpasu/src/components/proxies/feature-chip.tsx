import { memo } from 'react'
import { getThemePaletteTokens, tokenAlpha } from '@/utils/theme'
import { Chip, ChipProps } from '@mui/material'

const FeatureChip = memo(function FeatureChip(props: ChipProps) {
  return (
    <Chip
      variant="outlined"
      size="small"
      {...props}
      sx={[
        (theme) => {
          const tokens = getThemePaletteTokens(theme)

          return {
            color: tokenAlpha(tokens.text.primary, 0.82),
            backgroundColor: tokenAlpha(tokens.text.primary, 0.06),
            borderColor: tokenAlpha(tokens.text.primary, 0.14),
            fontSize: 10,
            height: 16,
            padding: 0,
            '& .MuiChip-label': {
              padding: '0 4px',
            },
          }
        },
        ...(Array.isArray(props.sx) ? props.sx : props.sx ? [props.sx] : []),
      ]}
    />
  )
})

export default FeatureChip
