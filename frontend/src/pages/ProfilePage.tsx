import { useState, type FormEvent } from 'react'
import { LockKeyhole, ShieldCheck, UserRoundPlus } from 'lucide-react'
import PageTransition from '../components/PageTransition'
import CanvasPage from '../components/visual/CanvasPage'
import DecorativeArtwork from '../components/visual/DecorativeArtwork'
import GlassPanel from '../components/visual/GlassPanel'
import { pageVisuals } from '../data/pagePhotography'
import { useProfile } from '../profile/ProfileContext'

export default function ProfilePage() {
  const { profiles, activeProfile, conversations, loading, storageAvailable, createProfile, unlockProfile, lockProfile, deleteProfile } = useProfile()
  const [nickname, setNickname] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [unlockPin, setUnlockPin] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [creating, setCreating] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (pin !== confirmPin) return setError('两次输入的 PIN 不一致')
    setSubmitting(true)
    try {
      await createProfile(nickname, pin)
      setNickname('')
      setPin('')
      setConfirmPin('')
      setCreating(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '创建档案失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUnlock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    const profileId = selectedProfileId || profiles[0]?.id
    const unlocked = profileId ? await unlockProfile(profileId, unlockPin) : false
    if (!unlocked) setError('PIN 不正确')
    else setUnlockPin('')
    setSubmitting(false)
  }

  if (loading) return <div className="page-status">正在读取本机档案…</div>

  return (
    <PageTransition>
      <CanvasPage {...pageVisuals.profile} className="profile-canvas">
        <div className="profile-page shell-width">
          <GlassPanel tone="navy" as="section" className="profile-hero">
            <span className="eyebrow">LOCAL PROFILE</span>
            <h1 aria-label={activeProfile ? `你好，${activeProfile.nickname}。` : profiles.length > 0 ? '解锁本机档案' : '本机档案，只属于这台浏览器。'}>
              {activeProfile ? `你好，${activeProfile.nickname}。` : profiles.length > 0 ? '解锁本机档案' : <>本机档案，<br aria-hidden="true" />只属于这台浏览器。</>}
            </h1>
            <p>档案和最近会话仅保存在当前浏览器，不能跨设备同步。清除网站数据后将永久删除，PIN 忘记后也无法恢复。</p>
          </GlassPanel>

        <GlassPanel tone="warm" as="section" className="profile-panel">
          {!storageAvailable && <div className="profile-alert" role="alert">本机存储当前不可用，已回退为访客模式，本次对话不会保存。</div>}
          {error && <div className="profile-alert profile-alert--error" role="alert">{error}</div>}

          {activeProfile ? (
            <div className="profile-dashboard">
              <div className="profile-status-card">
                <ShieldCheck aria-hidden="true" />
                <div><strong>档案已解锁</strong><p>本机保存 {conversations.length} 次会话</p></div>
              </div>
              <button className="button button--secondary" type="button" onClick={lockProfile}>
                <LockKeyhole size={18} aria-hidden="true" />锁定档案
              </button>
              <button className="button profile-delete-button" type="button" onClick={() => setConfirmingDelete(true)}>删除档案</button>
              {confirmingDelete && <div className="profile-delete-confirmation" role="alert">
                <p>档案和其中的会话将永久删除，且无法恢复。</p>
                <div>
                  <button className="button profile-delete-button" type="button" onClick={() => void deleteProfile(activeProfile.id)}>确认永久删除</button>
                  <button className="button button--secondary" type="button" onClick={() => setConfirmingDelete(false)}>取消</button>
                </div>
              </div>}
            </div>
          ) : profiles.length > 0 && !creating ? (
            <form className="profile-form" onSubmit={handleUnlock}>
              <label>选择档案
                <select value={selectedProfileId || profiles[0]?.id} onChange={(event) => setSelectedProfileId(event.target.value)}>
                  {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.nickname}</option>)}
                </select>
              </label>
              <label>输入 PIN
                <input inputMode="numeric" pattern="[0-9]{4,6}" minLength={4} maxLength={6} value={unlockPin} onChange={(event) => setUnlockPin(event.target.value)} required />
              </label>
              <button className="button button--primary" type="submit" disabled={submitting}>{submitting ? '正在验证…' : '解锁'}</button>
              <button className="button button--secondary" type="button" onClick={() => setCreating(true)}>创建新档案</button>
            </form>
          ) : (
            <form className="profile-form" onSubmit={handleCreate}>
              <div className="profile-form__heading">
                <UserRoundPlus aria-hidden="true" />
                <div><h2>创建一个本机档案</h2><p>昵称用于区分档案，PIN 只在这台设备上验证。</p></div>
              </div>
              <label>昵称<input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={24} required /></label>
              <label>设置 PIN<input inputMode="numeric" pattern="[0-9]{4,6}" minLength={4} maxLength={6} value={pin} onChange={(event) => setPin(event.target.value)} required /></label>
              <label>确认 PIN<input inputMode="numeric" pattern="[0-9]{4,6}" minLength={4} maxLength={6} value={confirmPin} onChange={(event) => setConfirmPin(event.target.value)} required /></label>
              <button className="button button--primary" type="submit" disabled={submitting}>{submitting ? '正在创建…' : '创建并进入'}</button>
              {profiles.length > 0 && <button className="button button--secondary" type="button" onClick={() => setCreating(false)}>返回解锁</button>}
            </form>
          )}
        </GlassPanel>
        </div>
        <DecorativeArtwork src="/brand/decorative-cat.svg" className="profile-cat-art" />
      </CanvasPage>
    </PageTransition>
  )
}
