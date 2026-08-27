import { Stage } from './Stage'
import { TitleScreen } from '@/ui/screens/TitleScreen'
import { ZooScreen } from '@/ui/screens/ZooScreen'
import { OptionsModal } from '@/ui/modals/OptionsModal'
import { StatusModal } from '@/ui/modals/StatusModal'
import { RequestModal } from '@/ui/modals/RequestModal'
import { useGameStore } from '@/store/gameStore'

export function GameRoot() {
  const screen = useGameStore((s) => s.screen)
  const modal = useGameStore((s) => s.modal)

  return (
    <Stage>
      {screen === 'TITLE' && <TitleScreen />}
      {screen === 'ZOO' && <ZooScreen detail={false} />}
      {screen === 'ZOO_DETAIL' && <ZooScreen detail />}

      {modal === 'OPTIONS' && <OptionsModal />}
      {modal === 'STATUS' && <StatusModal />}
      {modal === 'REQUEST' && <RequestModal />}
    </Stage>
  )
}
