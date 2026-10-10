import { useLockFn } from 'ahooks'
import { useAtomValue } from 'jotai'
import { CSSProperties, memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  normalizeProxyTestTimeout,
  proxyTestTimeoutAtom,
} from '@/store/proxies'
import { getThemePaletteTokens, tokenAlpha } from '@/utils/theme'
import PushPinIcon from '@mui/icons-material/PushPin'
import Box from '@mui/material/Box'
import type { SxProps, Theme } from '@mui/material/styles'
import { ClashProxiesQueryProxyItem } from '@nyanpasu/interface'
import { cn } from '@nyanpasu/ui'
import { PaperSwitchButton } from '../setting/modules/system-proxy'
import DelayChip from './delay-chip'
import FeatureChip from './feature-chip'
import styles from './node-card.module.scss'
import { filterDelay } from './utils'

const NodeCard = memo(function NodeCard({
  node,
  now,
  disabled,
  pinned,
  style,
}: {
  node: ClashProxiesQueryProxyItem
  now?: string | null
  disabled?: boolean
  pinned?: boolean
  style?: CSSProperties
}) {
  const { t } = useTranslation()
  const delay = useMemo(() => filterDelay(node.history), [node.history])

  const checked = node.name === now
  const testTimeout = useAtomValue(proxyTestTimeoutAtom)

  const handleDelayClick = useLockFn(async () => {
    await node.mutateDelay({ timeout: normalizeProxyTestTimeout(testTimeout) })
  })

  const handleClick = useLockFn(async () => {
    await node.mutateSelect()
  })

  return (
    <PaperSwitchButton
      label={node.name}
      checked={checked}
      disableLoading
      onClick={handleClick}
      disabled={disabled}
      style={style}
      className={cn(styles.Card, delay === -1 && styles.NoDelay)}
      sxPaper={
        ((theme) => {
          const tokens = getThemePaletteTokens(theme)

          return {
            backgroundColor: checked
              ? tokenAlpha(tokens.primary.main, 0.18)
              : tokenAlpha(tokens.background.paper, 0.96),
            borderColor: checked
              ? tokenAlpha(tokens.primary.main, 0.32)
              : tokenAlpha(tokens.text.primary, 0.14),
            '&:hover': {
              backgroundColor: checked
                ? tokenAlpha(tokens.primary.main, 0.24)
                : tokenAlpha(tokens.primary.main, 0.1),
            },
          }
        }) as SxProps<Theme>
      }
      sxLabel={(theme) => {
        const tokens = getThemePaletteTokens(theme)

        return {
          color: checked ? tokens.primary.main : tokens.text.primary,
        }
      }}
    >
      <Box width="100%" display="flex" gap={0.5}>
        <FeatureChip label={node.type} />

        {pinned && (
          <FeatureChip
            icon={<PushPinIcon sx={{ fontSize: '12px !important' }} />}
            label={t('Pinned')}
            color="primary"
          />
        )}

        {node.udp && <FeatureChip label="UDP" />}

        <DelayChip
          className={styles.DelayChip}
          delay={delay}
          onClick={handleDelayClick}
        />
      </Box>
    </PaperSwitchButton>
  )
})

export default NodeCard
