import { Stage } from './Stage'
import { TitleScreen } from '@/ui/screens/TitleScreen'
import { ZooScreen } from '@/ui/screens/ZooScreen'
import { OptionsModal } from '@/ui/modals/OptionsModal'
import { StatusModal } from '@/ui/modals/StatusModal'
import { RequestModal } from '@/ui/modals/RequestModal'
import { ReportModal } from '@/ui/modals/ReportModal'
import { useGameStore } from '@/store/gameStore'

export function GameRoot() {
  const screen = useGameStore((s) => s.screen)
  const modal = useGameStore((s) => s.modal)

  return (
    <Stage>
      {screen === 'TITLE' && <TitleScreen />}
      {/*
        두 화면을 각각 다른 JSX 자리에 두면 상세보기를 오갈 때 React 가 ZooScreen 을
        언마운트했다 다시 마운트한다. 그러면 useMemo 로 들고 있던 EnclosureSim 3개가
        새로 만들어져 동물과 손님 위치가 전부 초기화된다. 반드시 같은 자리에서 prop 만 바꾼다.
      */}
      {screen !== 'TITLE' && <ZooScreen detail={screen === 'ZOO_DETAIL'} />}

      {modal === 'OPTIONS' && <OptionsModal />}
      {modal === 'STATUS' && <StatusModal />}
      {modal === 'REQUEST' && <RequestModal />}
      {modal === 'REPORT' && <ReportModal />}
    </Stage>
  )
}
