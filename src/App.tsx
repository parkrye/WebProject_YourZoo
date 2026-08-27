import { useEffect, useState } from 'react'
import { loadAssets } from '@/assets/AssetStore'
import { BootScreen } from '@/app/BootScreen'
import { GameRoot } from '@/app/GameRoot'
import { startAutosave } from '@/store/gameStore'
import { useGameAudio } from '@/audio/useGameAudio'
import { AssetInspector } from '@/dev/AssetInspector'

export function App() {
  const [progress, setProgress] = useState(0)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    let cancelled = false
    loadAssets((loaded, total) => {
      if (!cancelled) setProgress(loaded / total)
    })
      .then(() => {
        if (!cancelled) setReady(true)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [])

  useGameAudio()

  useEffect(() => {
    if (!ready) return
    return startAutosave()
  }, [ready])

  if (!ready) return <BootScreen progress={progress} {...(error !== undefined && { error })} />
  if (new URLSearchParams(location.search).get('dev') === 'assets') return <AssetInspector />
  return <GameRoot />
}
