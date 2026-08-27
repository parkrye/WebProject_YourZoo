import { BitmapLabel } from './BitmapLabel'

export interface TabItem<T extends string> {
  id: T
  label: string
}

interface TabsProps<T extends string> {
  items: readonly TabItem<T>[]
  active: T
  onChange: (id: T) => void
}

export function Tabs<T extends string>({ items, active, onChange }: TabsProps<T>) {
  return (
    <div className="tabs">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={item.id === active ? 'tab is-active' : 'tab'}
          onClick={() => onChange(item.id)}
        >
          <BitmapLabel text={item.label} size={24} />
        </button>
      ))}
    </div>
  )
}
