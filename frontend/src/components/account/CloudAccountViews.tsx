import type { ChangeEvent, FormEvent } from 'react'
import { ImagePlus, LogOut, ShieldCheck, Trash2, UserRoundPlus, X } from 'lucide-react'
import AccountAvatar from './AccountAvatar'
import type { LocalAccount } from '@/profile/types'

export type CloudAuthMode = 'login' | 'register'

interface CloudAccountTabsProps {
  mode: CloudAuthMode
  onChange: (mode: CloudAuthMode) => void
}

export function CloudAccountTabs({ mode, onChange }: CloudAccountTabsProps) {
  return (
    <div className="profile-auth-tabs" role="tablist" aria-label="云端账户">
      <button type="button" role="tab" aria-selected={mode === 'login'} aria-label="切换到登录" onClick={() => onChange('login')}>登录</button>
      <button type="button" role="tab" aria-selected={mode === 'register'} aria-label="切换到注册" onClick={() => onChange('register')}>注册</button>
    </div>
  )
}

interface LoginViewProps {
  username: string
  password: string
  submitting: boolean
  forgottenAccountId?: string
  onUsernameChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onForgotPassword: () => void
  onCancelForgottenAccount: () => void
  onRemoveForgottenAccount: () => void
}

export function CloudLoginView({
  username,
  password,
  submitting,
  forgottenAccountId,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
  onForgotPassword,
  onCancelForgottenAccount,
  onRemoveForgottenAccount,
}: LoginViewProps) {
  return (
    <form className="profile-form" onSubmit={onSubmit}>
      <div className="profile-form__heading"><ShieldCheck aria-hidden="true" /><div><h2>欢迎回来</h2><p>登录后可在不同设备继续使用。</p></div></div>
      <label>用户名<input autoComplete="username" value={username} onChange={(event) => onUsernameChange(event.target.value)} required /></label>
      <label>密码<input type="password" autoComplete="current-password" minLength={8} maxLength={128} value={password} onChange={(event) => onPasswordChange(event.target.value)} required /></label>
      <button className="button button--primary" type="submit" disabled={submitting}>{submitting ? '正在登录…' : '登录'}</button>
      <button className="profile-forgot-button" type="button" onClick={onForgotPassword}>忘记密码</button>
      {forgottenAccountId && <div className="profile-delete-confirmation" role="alert">
        <button className="profile-confirmation-close" type="button" aria-label="取消删除" onClick={onCancelForgottenAccount}><X size={16} /></button>
        <p>暂时无法找回密码，可以删除当前账号后重新注册；其中的会话也会一并删除。</p>
        <button className="button profile-delete-button" type="button" onClick={onRemoveForgottenAccount}>删除账号并重新注册</button>
      </div>}
    </form>
  )
}

interface RegisterViewProps {
  username: string
  password: string
  confirmPassword: string
  avatarDataUrl?: string
  submitting: boolean
  processingAvatar: boolean
  onUsernameChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  onAvatarChange: (event: ChangeEvent<HTMLInputElement>) => void
  onRemoveAvatar: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function CloudRegisterView({
  username,
  password,
  confirmPassword,
  avatarDataUrl,
  submitting,
  processingAvatar,
  onUsernameChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onAvatarChange,
  onRemoveAvatar,
  onSubmit,
}: RegisterViewProps) {
  return (
    <form className="profile-form" onSubmit={onSubmit}>
      <div className="profile-form__heading"><UserRoundPlus aria-hidden="true" /><div><h2>创建账户</h2><p>保留头像，让跨设备使用更容易辨认。</p></div></div>
      <div className="profile-avatar-picker">
        {avatarDataUrl ? <img src={avatarDataUrl} alt="头像预览" /> : <span aria-hidden="true"><ImagePlus /></span>}
        <label>上传头像（可选）<input type="file" accept="image/jpeg,image/png,image/webp,image/*" onChange={onAvatarChange} /></label>
        {avatarDataUrl && <button type="button" onClick={onRemoveAvatar}>移除</button>}
        {processingAvatar && <small role="status">正在处理头像…</small>}
      </div>
      <label>用户名<input autoComplete="username" minLength={2} maxLength={24} value={username} onChange={(event) => onUsernameChange(event.target.value)} required /></label>
      <label>设置密码<input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password} onChange={(event) => onPasswordChange(event.target.value)} required /></label>
      <label>确认密码<input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={confirmPassword} onChange={(event) => onConfirmPasswordChange(event.target.value)} required /></label>
      <button className="button button--primary" type="submit" disabled={submitting || processingAvatar}>{submitting ? '正在注册…' : '注册并登录'}</button>
    </form>
  )
}

interface SignedInViewProps {
  account: LocalAccount
  conversationCount: number
  confirmingDelete: boolean
  onLogout: () => void
  onStartDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
}

export function CloudSignedInView({
  account,
  conversationCount,
  confirmingDelete,
  onLogout,
  onStartDelete,
  onConfirmDelete,
  onCancelDelete,
}: SignedInViewProps) {
  return (
    <div className="profile-dashboard">
      <div className="profile-account-summary">
        <AccountAvatar account={account} />
        <div><strong>{account.username}</strong><p>云端账户已连接</p></div>
      </div>
      <div className="profile-status-card">
        <ShieldCheck aria-hidden="true" />
        <div><strong>会话同步已开启</strong><p>最近同步 {conversationCount} / 5 次会话</p></div>
      </div>
      <div className="profile-account-actions">
        <button className="button button--secondary" type="button" onClick={onLogout}><LogOut size={18} aria-hidden="true" />退出登录</button>
        <button className="button profile-delete-button" type="button" onClick={onStartDelete}><Trash2 size={17} />删除账号</button>
      </div>
      {confirmingDelete && <div className="profile-delete-confirmation" role="alert">
        <p>这个账号和其中的会话将永久删除，且无法恢复。</p>
        <div>
          <button className="button profile-delete-button" type="button" onClick={onConfirmDelete}>确认永久删除</button>
          <button className="button button--secondary" type="button" onClick={onCancelDelete}>取消</button>
        </div>
      </div>}
    </div>
  )
}
