import { LogFilter } from './log-filter'
import { LogLevel } from './log-level'
import LogToggle from './log-toggle'

const LogHeader = () => {
  return (
    <div className="flex gap-2">
      <LogToggle />

      <LogLevel />

      <LogFilter />
    </div>
  )
}

export default LogHeader
