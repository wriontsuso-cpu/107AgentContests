import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { ImagePlus, LogOut, ShieldCheck, Trash2, UserRoundPlus, X } from 'lucide-react'
import PageTransition from '../components/PageTransition'
import AccountAvatar from '../components/account/AccountAvatar'
import CanvasPage from '../components/visual/CanvasPage'
import DecorativeArtwork from '../components/visual/DecorativeArtwork'
import GlassPanel from '../components/visual/GlassPanel'
import { pageVisuals } from '../data/pagePhotography'
import { useAccount } from '../profile/AccountContext'
import { processAvatar } from '../profile/avatarProcessor'
import { normalizeUsername } from '../profile/profileStore'

type AuthMode = 'login' | 'register'

export default function ProfilePage() {
  const { accounts, activeAccount, conversations, loading, storageAvailable, migrationNotice, register, login, logout, deleteAccount } = useAccount()
  const [mode, setMode] = useState<AuthMode>('register')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [avatarDataUrl, setAvatarDataUrl] = useState<string>()
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [processingAvatar, setProcessingAvatar] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [forgottenAccountId, setForgottenAccountId] = useState<string>()

  useEffect(() => {
    if (!loading && !activeAccount) setMode(accounts.length > 0 ? 'login' : 'register')
  }, [loading, activeAccount, accounts.length])

  const switchMode = (next: AuthMode) => {
    setMode(next)
    setError('')
    setForgottenAccountId(undefined)
  }

  const handleAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    setProcessingAvatar(true)
    try {
      setAvatarDataUrl(await processAvatar(file))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '头像处理失败，请重新选择')
      event.target.value = ''
    } finally {
      setProcessingAvatar(false)
    }
  }

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (password !== confirmPassword) return setError('两次输入的密码不一致')
    setSubmitting(true)
    try {
      await register(username, password, avatarDataUrl)
      setUsername('')
      setPassword('')
      setConfirmPassword('')
      setAvatarDataUrl(undefined)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '注册失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    const authenticated = await login(username, password)
    if (!authenticated) setError('用户名或密码不正确')
    else {
      setUsername('')
      setPassword('')
    }
    setSubmitting(false)
  }

  const handleForgotPassword = () => {
    setError('')
    const account = accounts.find((item) => item.normalizedUsername === normalizeUsername(username))
    if (!account) return setError('请输入需要删除的本机账号用户名')
    setForgottenAccountId(account.id)
  }

  const removeForgottenAccount = async () => {
    if (!forgottenAccountId) return
    await deleteAccount(forgottenAccountId)
    setForgottenAccountId(undefined)
    setUsername('')
    setPassword('')
  }

  if (loading) return <div className="page-status">正在读取本机账号…</div>

  const heading = activeAccount ? `你好，${activeAccount.username}` : mode === 'login' ? '登录本机账号' : '注册本机账号'

  return (
    <PageTransition>
      <CanvasPage {...pageVisuals.profile} className="profile-canvas">
        <div className="profile-page shell-width">
          <GlassPanel tone="navy" as="section" className="profile-hero">
            <span className="eyebrow">LOCAL ACCOUNT</span>
            <h1>{heading}</h1>
            <p>账号与对话仅保存到当前浏览器。</p>
          </GlassPanel>

          <GlassPanel tone="warm" as="section" className="profile-panel">
            {!storageAvailable && <div className="profile-alert" role="alert">本机存储当前不可用，已回退为访客模式，本次对话不会保存。</div>}
            {migrationNotice && <div className="profile-alert" role="status">本机账号功能已升级，请重新注册。</div>}
            {error && <div className="profile-alert profile-alert--error" role="alert">{error}</div>}

            {activeAccount ? (
              <div className="profile-dashboard">
                <div className="profile-account-summary">
                  <AccountAvatar account={activeAccount} />
                  <div><strong>{activeAccount.username}</strong><p>本机账号已登录</p></div>
                </div>
                <div className="profile-status-card">
                  <ShieldCheck aria-hidden="true" />
                  <div><strong>会话保存已开启</strong><p>最近保存 {conversations.length} / 5 次会话</p></div>
                </div>
                <button className="button button--secondary" type="button" onClick={logout}>
                  <LogOut size={18} aria-hidden="true" />退出登录
                </button>
                <button className="button profile-delete-button" type="button" onClick={() => setConfirmingDelete(true)}><Trash2 size={17} />删除账号</button>
                {confirmingDelete && <div className="profile-delete-confirmation" role="alert">
                  <p>这个本机账号和其中的会话将永久删除，且无法恢复。</p>
                  <div>
                    <button className="button profile-delete-button" type="button" onClick={() => void deleteAccount(activeAccount.id)}>确认永久删除</button>
                    <button className="button button--secondary" type="button" onClick={() => setConfirmingDelete(false)}>取消</button>
                  </div>
                </div>}
              </div>
            ) : (
              <div className="profile-auth-card">
                <div className="profile-auth-tabs" role="tablist" aria-label="本机账号">
                  <button type="button" role="tab" aria-selected={mode === 'login'} aria-label="切换到登录" onClick={() => switchMode('login')}>登录</button>
                  <button type="button" role="tab" aria-selected={mode === 'register'} aria-label="切换到注册" onClick={() => switchMode('register')}>注册</button>
                </div>

                {mode === 'login' ? (
                  <form className="profile-form" onSubmit={handleLogin}>
                    <div className="profile-form__heading"><ShieldCheck aria-hidden="true" /><div><h2>欢迎回来</h2><p>使用保存在本机的用户名和密码登录。</p></div></div>
                    <label>用户名<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
                    <label>密码<input type="password" autoComplete="current-password" minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
                    <button className="button button--primary" type="submit" disabled={submitting}>{submitting ? '正在登录…' : '登录'}</button>
                    <button className="profile-forgot-button" type="button" onClick={handleForgotPassword}>忘记密码</button>
                    {forgottenAccountId && <div className="profile-delete-confirmation" role="alert">
                      <button className="profile-confirmation-close" type="button" aria-label="取消删除" onClick={() => setForgottenAccountId(undefined)}><X size={16} /></button>
                      <p>密码无法找回，只能删除这个本机账号后重新注册；其中的会话也会一并删除。</p>
                      <button className="button profile-delete-button" type="button" onClick={() => void removeForgottenAccount()}>删除账号并重新注册</button>
                    </div>}
                  </form>
                ) : (
                  <form className="profile-form" onSubmit={handleRegister}>
                    <div className="profile-form__heading"><UserRoundPlus aria-hidden="true" /><div><h2>创建本机账号</h2><p>用户名用于登录，密码只在当前浏览器验证。</p></div></div>
                    <div className="profile-avatar-picker">
                      {avatarDataUrl
                        ? <img src={avatarDataUrl} alt="头像预览" />
                        : <span aria-hidden="true"><ImagePlus /></span>}
                      <label>上传头像（可选）<input type="file" accept="image/jpeg,image/png,image/webp,image/*" onChange={(event) => void handleAvatar(event)} /></label>
                      {avatarDataUrl && <button type="button" onClick={() => setAvatarDataUrl(undefined)}>移除</button>}
                      {processingAvatar && <small role="status">正在处理头像…</small>}
                    </div>
                    <label>用户名<input autoComplete="username" minLength={2} maxLength={24} value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
                    <label>设置密码<input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
                    <label>确认密码<input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>
                    <button className="button button--primary" type="submit" disabled={submitting || processingAvatar}>{submitting ? '正在注册…' : '注册并登录'}</button>
                  </form>
                )}
              </div>
            )}
          </GlassPanel>
        </div>
        <DecorativeArtwork src="/brand/decorative-cat.svg" className="profile-cat-art" />
      </CanvasPage>
    </PageTransition>
  )
}
