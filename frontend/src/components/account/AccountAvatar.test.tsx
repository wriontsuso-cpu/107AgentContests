import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { LocalAccount } from '@/profile/types'
import AccountAvatar from './AccountAvatar'

const account: LocalAccount = {
  id: 'account',
  username: '科大用户',
  normalizedUsername: '科大用户',
  passwordHash: 'hash',
  passwordSalt: 'salt',
  createdAt: '2026-08-28T00:00:00.000Z',
  lastUsedAt: '2026-08-28T00:00:00.000Z',
}

describe('AccountAvatar', () => {
  it('renders the uploaded account avatar', () => {
    render(<AccountAvatar account={{ ...account, avatarDataUrl: 'data:image/webp;base64,avatar' }} />)
    expect(screen.getByRole('img', { name: '科大用户的头像' })).toHaveAttribute('src', 'data:image/webp;base64,avatar')
  })

  it('falls back to the first username character', () => {
    render(<AccountAvatar account={account} />)
    expect(screen.getByRole('img', { name: '科大用户的默认头像' })).toHaveTextContent('科')
  })
})
