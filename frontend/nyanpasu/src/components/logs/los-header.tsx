import { LogFilter } from './log-filter'
import { LogLevel } from './log-level'
import LogToggle from './log-toggle'

const LogHeader = () => {
  return (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5">
      <LogToggle />

      <LogLevel />

      <LogFilter />
    </div>
  )
}

export default LogHeader
