import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import PageTransition from '../components/PageTransition'
import { CloudAccountTabs, CloudLoginView, CloudRegisterView, CloudSignedInView, type CloudAuthMode } from '../components/account/CloudAccountViews'
import CanvasPage from '../components/visual/CanvasPage'
import { pageVisuals } from '../data/pagePhotography'
import { useAccount } from '../profile/AccountContext'
import { processAvatar } from '../profile/avatarProcessor'
import { normalizeUsername } from '../profile/profileStore'

export default function ProfilePage() {
  const { accounts, activeAccount, conversations, loading, storageAvailable, migrationNotice, register, login, logout, deleteAccount } = useAccount()
  const [mode, setMode] = useState<CloudAuthMode>('register')
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

  const switchMode = (next: CloudAuthMode) => {
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

  if (loading) return <div className="page-status">正在读取账户…</div>

  const heading = activeAccount ? `你好，${activeAccount.username}` : mode === 'login' ? '登录云端账户' : '创建云端账户'

  return (
    <PageTransition>
      <CanvasPage {...pageVisuals.profile} className="profile-canvas">
        <div className="profile-open-layout shell-width">
          <div className="profile-open-spacer" aria-hidden="true" />
          <section className="profile-open-account" aria-label="云端账户">
            <header className="profile-open-copy">
              <span className="eyebrow">CLOUD ACCOUNT</span>
              <h1>{heading}</h1>
              <p>从任意设备继续你的会话与收藏。</p>
            </header>

            {!storageAvailable && <div className="profile-alert" role="alert">账户存储暂时不可用，已回退为访客模式，本次对话不会保存。</div>}
            {migrationNotice && <div className="profile-alert" role="status">账户功能已更新，请重新注册。</div>}
            {error && <div className="profile-alert profile-alert--error" role="alert">{error}</div>}

            {activeAccount ? (
              <CloudSignedInView
                account={activeAccount}
                conversationCount={conversations.length}
                confirmingDelete={confirmingDelete}
                onLogout={logout}
                onStartDelete={() => setConfirmingDelete(true)}
                onConfirmDelete={() => void deleteAccount(activeAccount.id)}
                onCancelDelete={() => setConfirmingDelete(false)}
              />
            ) : (
              <div className="profile-auth-stack">
                <CloudAccountTabs mode={mode} onChange={switchMode} />

                {mode === 'login' ? (
                  <CloudLoginView
                    username={username}
                    password={password}
                    submitting={submitting}
                    forgottenAccountId={forgottenAccountId}
                    onUsernameChange={setUsername}
                    onPasswordChange={setPassword}
                    onSubmit={handleLogin}
                    onForgotPassword={handleForgotPassword}
                    onCancelForgottenAccount={() => setForgottenAccountId(undefined)}
                    onRemoveForgottenAccount={() => void removeForgottenAccount()}
                  />
                ) : (
                  <CloudRegisterView
                    username={username}
                    password={password}
                    confirmPassword={confirmPassword}
                    avatarDataUrl={avatarDataUrl}
                    submitting={submitting}
                    processingAvatar={processingAvatar}
                    onUsernameChange={setUsername}
                    onPasswordChange={setPassword}
                    onConfirmPasswordChange={setConfirmPassword}
                    onAvatarChange={(event) => void handleAvatar(event)}
                    onRemoveAvatar={() => setAvatarDataUrl(undefined)}
                    onSubmit={handleRegister}
                  />
                )}
              </div>
            )}
          </section>
        </div>
      </CanvasPage>
    </PageTransition>
  )
}
