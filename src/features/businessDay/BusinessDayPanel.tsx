import { useEffect, useState } from 'react'
import {
  type BusinessDay,
} from '../../db/database'
import {
  closeBusinessDay,
  getEodWorkflowEnabled,
  getOpenBusinessDay,
  openBusinessDay,
  setEodWorkflowEnabled,
} from '../../services/businessDayService'

interface BusinessDayPanelProps {
  onStateChanged?: (
    eodEnabled: boolean,
    openBusinessDay: BusinessDay | null,
  ) => void
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function BusinessDayPanel({
  onStateChanged,
}: BusinessDayPanelProps) {
  const [eodEnabled, setEodEnabled] = useState(false)
  const [openDay, setOpenDay] =
    useState<BusinessDay | null>(null)

  const [openingCash, setOpeningCash] = useState('')
  const [actualClosingCash, setActualClosingCash] =
    useState('')
  const [closingNote, setClosingNote] = useState('')

  const [showOpeningForm, setShowOpeningForm] =
    useState(false)
  const [showClosingForm, setShowClosingForm] =
    useState(false)

  const [message, setMessage] = useState('')

  async function refreshState() {
    const enabled = await getEodWorkflowEnabled()
    const currentOpenDay = await getOpenBusinessDay()

    setEodEnabled(enabled)
    setOpenDay(currentOpenDay)

    onStateChanged?.(
      enabled,
      currentOpenDay,
    )
  }

  useEffect(() => {
    refreshState()
  }, [])

  async function handleToggleEod(
    enabled: boolean,
  ) {
    try {
      setMessage('')

      await setEodWorkflowEnabled(enabled)

      await refreshState()

      setShowOpeningForm(false)
      setShowClosingForm(false)
      setOpeningCash('')
      setActualClosingCash('')
      setClosingNote('')
    } catch (error) {
      if (error instanceof Error) {
        setMessage(error.message)
        return
      }

      setMessage(
        'Unable to update Daily Opening & Closing.',
      )
    }
  }

  async function handleOpenBusinessDay() {
    const openingCashAmount =
      Number(openingCash)

    if (
      openingCash === '' ||
      !Number.isFinite(openingCashAmount) ||
      openingCashAmount < 0
    ) {
      setMessage(
        'Opening cash must be zero or greater.',
      )
      return
    }

    try {
      setMessage('')

      await openBusinessDay(openingCashAmount)

      setOpeningCash('')
      setShowOpeningForm(false)

      await refreshState()

      setMessage('Business day opened.')
    } catch (error) {
      if (error instanceof Error) {
        setMessage(error.message)
        return
      }

      setMessage(
        'Unable to open business day.',
      )
    }
  }

  async function handleCloseBusinessDay() {
    const actualClosingCashAmount =
      Number(actualClosingCash)

    if (
      actualClosingCash === '' ||
      !Number.isFinite(
        actualClosingCashAmount,
      ) ||
      actualClosingCashAmount < 0
    ) {
      setMessage(
        'Actual closing cash must be zero or greater.',
      )
      return
    }

    try {
      setMessage('')

      const closedDay =
        await closeBusinessDay(
          actualClosingCashAmount,
          closingNote,
        )

      setActualClosingCash('')
      setClosingNote('')
      setShowClosingForm(false)

      await refreshState()

      const variance =
        closedDay.cashVariance ?? 0

      setMessage(
        `Business day closed. Cash variance: ₱${variance.toFixed(
          2,
        )}.`,
      )
    } catch (error) {
      if (error instanceof Error) {
        setMessage(error.message)
        return
      }

      setMessage(
        'Unable to close business day.',
      )
    }
  }

  return (
    <section
      className={
        showOpeningForm || showClosingForm
          ? 'business-day-panel business-day-panel-expanded'
          : 'business-day-panel'
      }
    >
      <div className="business-day-compact-row">
        <div className="business-day-title">
          <h2>Daily Opening & Closing</h2>
        </div>

        <label className="eod-toggle">
          <input
            type="checkbox"
            checked={eodEnabled}
            onChange={(event) =>
              handleToggleEod(
                event.target.checked,
              )
            }
          />

          <span
            className="eod-toggle-track"
            aria-hidden="true"
          >
            <span className="eod-toggle-thumb" />
          </span>

          <span className="eod-toggle-label">
            {eodEnabled ? 'On' : 'Off'}
          </span>
        </label>

        {eodEnabled && !openDay && (
          <>
            <div className="business-day-compact-status business-day-compact-status-warning">
              <strong>No Business Day</strong>
            </div>

            <button
              className="business-day-inline-button"
              onClick={() => {
                setMessage('')
                setShowClosingForm(false)
                setShowOpeningForm(
                  (current) => !current,
                )
              }}
            >
              {showOpeningForm
                ? 'Cancel'
                : 'Open Day'}
            </button>
          </>
        )}

        {eodEnabled && openDay && (
          <>
            <div className="business-day-compact-status business-day-compact-status-open">
              <strong>Open</strong>

              <span>
                ₱{openDay.openingCash.toFixed(2)}
              </span>
            </div>

            <button
              className="business-day-inline-button"
              onClick={() => {
                setMessage('')
                setShowOpeningForm(false)
                setShowClosingForm(
                  (current) => !current,
                )
              }}
            >
              {showClosingForm
                ? 'Cancel'
                : 'Close Day'}
            </button>
          </>
        )}
      </div>

      {eodEnabled &&
        !openDay &&
        showOpeningForm && (
          <div className="business-day-content">
            <div className="business-day-form-row">
              <label className="business-day-field">
                Opening Cash
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={openingCash}
                  onChange={(event) => {
                    setOpeningCash(
                      event.target.value,
                    )
                    setMessage('')
                  }}
                  placeholder="0.00"
                />
              </label>

              <button
                className="business-day-primary-button"
                onClick={handleOpenBusinessDay}
              >
                Open Business Day
              </button>
            </div>
          </div>
        )}

      {eodEnabled &&
        openDay &&
        showClosingForm && (
          <div className="business-day-content">
            <div className="business-day-open-summary">
              <div>
                <strong>Opened</strong>
                <span>
                  {formatDateTime(openDay.openedAt)}
                </span>
              </div>

              <div>
                <strong>Opening Cash</strong>
                <span>
                  ₱{openDay.openingCash.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="business-day-close-form">
              <h3>End-of-Day Cash</h3>

              <p>
                Enter the physical cash currently in
                the drawer. Any variance will be
                recorded automatically.
              </p>

              <label className="business-day-field">
                Actual Closing Cash
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={actualClosingCash}
                  onChange={(event) => {
                    setActualClosingCash(
                      event.target.value,
                    )
                    setMessage('')
                  }}
                  placeholder="0.00"
                />
              </label>

              <label className="business-day-field">
                Closing Note
                <textarea
                  rows={3}
                  value={closingNote}
                  onChange={(event) =>
                    setClosingNote(
                      event.target.value,
                    )
                  }
                  placeholder="Optional"
                />
              </label>

              <div className="business-day-actions">
                <button
                  onClick={() => {
                    setShowClosingForm(false)
                    setActualClosingCash('')
                    setClosingNote('')
                    setMessage('')
                  }}
                >
                  Cancel
                </button>

                <button
                  className="business-day-primary-button"
                  onClick={
                    handleCloseBusinessDay
                  }
                >
                  Confirm Closing
                </button>
              </div>
            </div>
          </div>
        )}

      {message && (
        <p className="business-day-message">
          {message}
        </p>
      )}
    </section>
  )
}

export default BusinessDayPanel