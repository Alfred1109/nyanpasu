import { useAtomValue } from 'jotai'
import { useTranslation } from 'react-i18next'
import { Virtualizer } from 'virtua'
import { CircularProgress } from '@mui/material'
import ContentDisplay from '../base/content-display'
import { atomRulePage } from './modules/store'
import RuleItem from './rule-item'

const RulePage = () => {
  const { t } = useTranslation()

  const rule = useAtomValue(atomRulePage)

  if (rule?.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <CircularProgress size={24} />
      </div>
    )
  }

  if (rule?.isError) {
    return <ContentDisplay className="absolute" message={t('Error')} />
  }

  return rule?.data?.length ? (
    <Virtualizer scrollRef={rule?.scrollRef}>
      {rule.data.map((item, index) => {
        return <RuleItem key={index} index={index} value={item} />
      })}
    </Virtualizer>
  ) : (
    <ContentDisplay className="absolute" message={t('No Rules')} />
  )
}

export default RulePage
