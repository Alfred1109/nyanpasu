import { FC, memo, ReactNode } from 'react'

const Header: FC<{ title?: ReactNode; header?: ReactNode }> = memo(
  function Header({
    title,
    header,
  }: {
    title?: ReactNode
    header?: ReactNode
  }) {
    return (
      <header
        className="page-header gap-2 pl-2 select-none"
        data-tauri-drag-region
      >
        <h1
          className="page-title mb-1 shrink-0 text-4xl/1! font-medium"
          data-tauri-drag-region
        >
          {title}
        </h1>

        {header}
      </header>
    )
  },
)

export default Header
