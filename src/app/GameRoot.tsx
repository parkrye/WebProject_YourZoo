import { DayFade } from './DayFade'
import { Stage } from './Stage'
import { NamingScreen } from '@/ui/screens/NamingScreen'
import { TitleScreen } from '@/ui/screens/TitleScreen'
import { ZooScreen } from '@/ui/screens/ZooScreen'
import { OptionsModal } from '@/ui/modals/OptionsModal'
import { StatusModal } from '@/ui/modals/StatusModal'
import { RequestModal } from '@/ui/modals/RequestModal'
import { ReportModal } from '@/ui/modals/ReportModal'
import { ShopModal } from '@/ui/modals/ShopModal'
import { VisitModal } from '@/ui/modals/VisitModal'
import { PropModal } from '@/ui/modals/PropModal'
import { useGameStore } from '@/store/gameStore'

export function GameRoot() {
  const screen = useGameStore((s) => s.screen)
  const modal = useGameStore((s) => s.modal)

  return (
    <Stage>
      {screen === 'TITLE' && <TitleScreen />}
      {screen === 'NAMING' && <NamingScreen />}
      {/*
        두 화면을 각각 다른 JSX 자리에 두면 상세보기를 오갈 때 React 가 ZooScreen 을
        언마운트했다 다시 마운트한다. 그러면 useMemo 로 들고 있던 EnclosureSim 3개가
        새로 만들어져 동물과 손님 위치가 전부 초기화된다. 반드시 같은 자리에서 prop 만 바꾼다.
      */}
      {(screen === 'ZOO' || screen === 'ZOO_DETAIL') && <ZooScreen detail={screen === 'ZOO_DETAIL'} />}

      {/* 암전은 화면과 HUD 위, 팝업 아래에 깔린다. 리포트는 검은 화면 위에서 읽는다. */}
      <DayFade />

      {modal === 'OPTIONS' && <OptionsModal />}
      {modal === 'STATUS' && <StatusModal />}
      {modal === 'REQUEST' && <RequestModal />}
      {modal === 'REPORT' && <ReportModal />}
      {modal === 'SHOP' && <ShopModal />}
      {modal === 'VISIT' && <VisitModal />}
      {modal === 'PROP' && <PropModal />}
    </Stage>
  )
}
