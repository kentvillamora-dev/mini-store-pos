import { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

function UpdatePrompt() {
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
      setUpdateMessage('Connect to the internet to check for updates.')
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
      <button
        className="update-check-button"
        onClick={handleCheckForUpdate}>
        Check for Update
      </button>

      {updateMessage && <p>{updateMessage}</p>}

      {needRefresh && (
        <aside className="update-prompt" role="status">
          <p>
            A new version of Mini-Store POS is available.
            Finish any active transaction before updating.
          </p>

          <div className="update-prompt-actions">
            <button onClick={handleApplyUpdate}>
              Apply Update
            </button>

            <button onClick={handleDismiss}>
              Later
            </button>
          </div>
        </aside>
      )}
    </>
  )
}

export default UpdatePrompt