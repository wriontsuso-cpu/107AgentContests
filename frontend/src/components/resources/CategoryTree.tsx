import { ChevronRight } from 'lucide-react'
import { resourceCounts } from '@/data/resources'
import { RESOURCE_CATEGORIES, type ResourceCategoryId } from '@/domain/categories'

interface CategoryTreeProps {
  selected?: ResourceCategoryId
  onSelect: (category?: ResourceCategoryId) => void
}

export default function CategoryTree({ selected, onSelect }: CategoryTreeProps) {
  return (
    <div className="category-tree">
      <button
        className={!selected ? 'category-tree__item category-tree__item--active' : 'category-tree__item'}
        type="button"
        aria-pressed={!selected}
        onClick={() => onSelect(undefined)}
      >
        <span>全部资源</span>
        <strong>{Object.values(resourceCounts).reduce((sum, count) => sum + count, 0)}</strong>
      </button>
      {RESOURCE_CATEGORIES.map((category) => (
        <button
          key={category.id}
          className={selected === category.id ? 'category-tree__item category-tree__item--active' : 'category-tree__item'}
          type="button"
          aria-pressed={selected === category.id}
          onClick={() => onSelect(category.id)}
        >
          <span>
            <i style={{ background: category.accent }} />
            {category.label}
          </span>
          <strong>{resourceCounts[category.id]}</strong>
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}
