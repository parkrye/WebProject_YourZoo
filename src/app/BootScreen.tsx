interface BootScreenProps {
  progress: number
  error?: string
}

export function BootScreen({ progress, error }: BootScreenProps) {
  return (
    <div className="boot">
      {error ? (
        <p className="boot-error">{error}</p>
      ) : (
        <>
          <p className="boot-label">LOADING</p>
          <div className="boot-bar">
            <div className="boot-bar-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </>
      )}
    </div>
  )
}
