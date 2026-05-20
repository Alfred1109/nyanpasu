import { useAtom } from 'jotai'
import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { proxyGroupSortAtom } from '@/store'
import { getThemePaletteTokens, tokenAlpha } from '@/utils/theme'
import { Button, Menu, MenuItem } from '@mui/material'

const SortSelector = memo(function SortSelector() {
  const { t } = useTranslation()

  const [proxyGroupSort, setProxyGroupSort] = useAtom(proxyGroupSortAtom)

  type SortType = typeof proxyGroupSort

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const handleClick = (sort: SortType) => {
    setAnchorEl(null)
    setProxyGroupSort(sort)
  }

  const tmaps: { [key: string]: string } = {
    default: 'Sort by default',
    delay: 'Sort by latency',
    name: 'Sort by name',
  }

  return (
    <>
      <Button
        size="small"
        className="px-2!"
        sx={(theme) => {
          const tokens = getThemePaletteTokens(theme)

          return {
            textTransform: 'none',
            color: tokens.text.primary,
            backgroundColor: tokenAlpha(tokens.primary.main, 0.08),
            border: '1px solid',
            borderColor: tokenAlpha(tokens.primary.main, 0.14),
            '&:hover': {
              backgroundColor: tokenAlpha(tokens.primary.main, 0.12),
              borderColor: tokenAlpha(tokens.primary.main, 0.2),
            },
          }
        }}
        onClick={(e) => setAnchorEl(e.currentTarget)}
      >
        {t(tmaps[proxyGroupSort])}
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        {Object.entries(tmaps).map(([key, value], index) => {
          return (
            <MenuItem key={index} onClick={() => handleClick(key as SortType)}>
              {t(value)}
            </MenuItem>
          )
        })}
      </Menu>
    </>
  )
})

export default SortSelector
