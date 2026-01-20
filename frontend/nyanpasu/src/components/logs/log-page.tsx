import { RefObject } from 'react'
import ClearLogButton from './clear-log-button'
import { LogList } from './log-list'

const LogPage = ({
  scrollRef,
}: {
  scrollRef: RefObject<HTMLElement>
}) => {
  return (
    <>
      <LogList scrollRef={scrollRef} />

      <ClearLogButton />
    </>
  )
}

export default LogPage
