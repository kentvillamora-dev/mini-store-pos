import { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

interface UpdatePromptProps {
  appVersion: string
}

function UpdatePrompt({ appVersion }: UpdatePromptProps) {
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null)

  const [updateMessage, setUpdateMessage] = useState('')

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registeredSW) {
      setRegistration(registeredSW ?? null)
    },
  })

  async function handleCheckForUpdate() {
    if (!registration) {
      setUpdateMessage('Update checker is not ready yet.')
      return
    }

    if (!navigator.onLine) {
      setUpdateMessage(
        'Connect to the internet to check for updates.',
      )
      return
    }

    try {
      setUpdateMessage('Checking for update...')

      await registration.update()

      setUpdateMessage(
        'Update check complete. If a new version is available, the update prompt will appear.',
      )
    } catch {
      setUpdateMessage('Unable to check for updates.')
    }
  }

  async function handleApplyUpdate() {
    await updateServiceWorker(true)
  }

  function handleDismiss() {
    setNeedRefresh(false)
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '4px',
          width: '100%',
          padding: '4px 8px 6px',
          background: 'var(--color-background)',
        }}
      >
        {updateMessage && (
          <p
            className="update-status-message"
            style={{
              margin: 0,
              padding: '6px 9px',
              border: '1px solid var(--color-border-light)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-surface)',
              color: 'var(--color-text-muted)',
              boxShadow: 'var(--shadow-sm)',
              fontSize: '0.72rem',
              lineHeight: 1.35,
            }}
          >
            {updateMessage}
          </p>
        )}

        <button
          className="version-button"
          onClick={handleCheckForUpdate}
          title="Check for update"
          aria-label={`App version ${appVersion}. Check for update.`}
        >
          v{appVersion}
        </button>
      </div>

      {needRefresh && (
        <aside
          className="update-prompt"
          role="status"
          style={{
            position: 'fixed',
            left: '50%',
            right: 'auto',
            top: 'auto',
            bottom: '12px',
            zIndex: 300,
            width: 'min(760px, calc(100% - 32px))',
            padding: '14px 16px',
            transform: 'translateX(-50%)',
            border: '1px solid var(--color-border-light)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <p
            style={{
              margin: '0 0 12px',
              color: 'var(--color-text)',
              fontWeight: 650,
            }}
          >
            A new version of Mini-Store POS is available.
            Finish any active transaction before updating.
          </p>

          <div
            className="update-prompt-actions"
            style={{
              justifyContent: 'flex-end',
              gap: '8px',
            }}
          >
            <button
              onClick={handleApplyUpdate}
              style={{
                margin: 0,
                background: 'var(--color-primary)',
                borderColor: 'var(--color-primary)',
                color: '#ffffff',
              }}
            >
              Apply Update
            </button>

            <button
              onClick={handleDismiss}
              style={{
                margin: 0,
              }}
            >
              Later
            </button>
          </div>
        </aside>
      )}
    </>
  )
}

export default UpdatePrompt
