import { ChevronRight } from 'lucide-react'
import { resourceCounts, totalResourceCount } from '@/data/catalogMetadata'
import { RESOURCE_CATEGORIES, type ResourceCategoryId } from '@/domain/categories'

interface CategoryTreeProps {
  selected?: ResourceCategoryId
  selectedGroup?: string
  onSelect: (category?: ResourceCategoryId) => void
  onSelectGroup: (group?: string) => void
}

export default function CategoryTree({ selected, selectedGroup, onSelect, onSelectGroup }: CategoryTreeProps) {
  return (
    <div className="category-tree">
      <button
        className={!selected ? 'category-tree__item category-tree__item--active' : 'category-tree__item'}
        type="button"
        aria-pressed={!selected}
        onClick={() => onSelect(undefined)}
      >
        <span>全部资源</span>
        <strong>{totalResourceCount}</strong>
      </button>
      {RESOURCE_CATEGORIES.map((category) => (
        <div key={category.id}>
          <button
            className={selected === category.id ? 'category-tree__item category-tree__item--active' : 'category-tree__item'}
            type="button"
            aria-pressed={selected === category.id}
            onClick={() => onSelect(category.id)}
          >
            <span><i style={{ background: category.accent }} />{category.label}</span>
            <strong>{resourceCounts[category.id]}</strong>
            <ChevronRight size={15} aria-hidden="true" />
          </button>
          {selected === category.id && (
            <div className="category-tree__children" aria-label={`${category.label}二级分类`}>
              {category.legacyCategories.map((group) => (
                <button key={group} type="button" aria-pressed={selectedGroup === group}
                  className={selectedGroup === group ? 'category-tree__child category-tree__child--active' : 'category-tree__child'}
                  onClick={() => onSelectGroup(selectedGroup === group ? undefined : group)}>{group}</button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
