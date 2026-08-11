import { useRegisterSW } from 'virtual:pwa-register/react'

function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) {
    return null
  }

  async function handleApplyUpdate() {
    await updateServiceWorker(true)
  }

  function handleDismiss() {
    setNeedRefresh(false)
  }

  return (
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
  )
}

export default UpdatePrompt