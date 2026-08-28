import type { LocalAccount } from '@/profile/types'

export default function AccountAvatar({ account, className = '' }: { account: LocalAccount; className?: string }) {
  if (account.avatarDataUrl) {
    return <img className={`account-avatar ${className}`.trim()} src={account.avatarDataUrl} alt={`${account.username}的头像`} />
  }

  return <span className={`account-avatar account-avatar--fallback ${className}`.trim()} role="img" aria-label={`${account.username}的默认头像`}>{[...account.username][0]}</span>
}
