interface NeedClarifierProps {
  options: string[]
  onSelect: (value: string) => void
  disabled?: boolean
}

export default function NeedClarifier({ options, onSelect, disabled }: NeedClarifierProps) {
  if (options.length === 0) return null

  return (
    <div className="clarifier" aria-label="补充需求">
      {options.map((option) => (
        <button key={option} type="button" disabled={disabled} onClick={() => onSelect(option)}>{option}</button>
      ))}
    </div>
  )
}
