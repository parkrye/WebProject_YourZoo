import { DayFade } from './DayFade'
import { TravelFade } from './TravelFade'
import { useState } from 'react'
import { Stage } from './Stage'
import { NamingScreen } from '@/ui/screens/NamingScreen'
import { TitleScreen, type TitleStep } from '@/ui/screens/TitleScreen'
import { AuthScreen } from '@/ui/screens/AuthScreen'
import { ZooScreen } from '@/ui/screens/ZooScreen'
import { OptionsModal } from '@/ui/modals/OptionsModal'
import { EnclosureModal } from '@/ui/modals/EnclosureModal'
import { StatusModal } from '@/ui/modals/StatusModal'
import { RequestModal } from '@/ui/modals/RequestModal'
import { ReportModal } from '@/ui/modals/ReportModal'
import { ShopModal } from '@/ui/modals/ShopModal'
import { ArrivalModal } from '@/ui/modals/ArrivalModal'
import { VisitModal } from '@/ui/modals/VisitModal'
import { useGameStore } from '@/store/gameStore'

export function GameRoot() {
  const screen = useGameStore((s) => s.screen)
  const modal = useGameStore((s) => s.modal)
  const setScreen = useGameStore((s) => s.setScreen)
  /*
    타이틀 단계와 인트로 재생 여부는 여기서 들고 있는다.
    TitleScreen 안에 두면 로그인 화면에 갔다 오는 사이 언마운트되어,
    돌아왔을 때 첫 화면으로 튕기고 제목이 처음부터 다시 떨어진다.
  */
  const [titleStep, setTitleStep] = useState<TitleStep>('ROOT')
  const [introShown, setIntroShown] = useState(false)

  return (
    <Stage>
      {screen === 'TITLE' && (
        <TitleScreen
          step={titleStep}
          intro={!introShown}
          onStep={(next) => {
            setIntroShown(true)
            setTitleStep(next)
          }}
          onLogin={() => {
            setIntroShown(true)
            setScreen('AUTH')
          }}
        />
      )}
      {/* 뒤로 가면 로그인을 고른 자리(PLAY 단계)로 돌아온다. 첫 화면까지 밀려나지 않는다. */}
      {screen === 'AUTH' && <AuthScreen onBack={() => setScreen('TITLE')} />}
      {screen === 'NAMING' && <NamingScreen />}
      {/*
        두 화면을 각각 다른 JSX 자리에 두면 상세보기를 오갈 때 React 가 ZooScreen 을
        언마운트했다 다시 마운트한다. 그러면 useMemo 로 들고 있던 EnclosureSim 3개가
        새로 만들어져 동물과 손님 위치가 전부 초기화된다. 반드시 같은 자리에서 prop 만 바꾼다.
      */}
      {(screen === 'ZOO' || screen === 'ZOO_DETAIL') && <ZooScreen detail={screen === 'ZOO_DETAIL'} />}

      {/* 암전은 화면과 HUD 위, 팝업 아래에 깔린다. 리포트는 검은 화면 위에서 읽는다. */}
      <DayFade />
      {/* 동물원을 오갈 때의 암전. 하루 넘김과 겹치지 않는다 — 오가는 동안 시계는 멈춘다. */}
      <TravelFade />

      {modal === 'OPTIONS' && <OptionsModal />}
      {modal === 'STATUS' && <StatusModal />}
      {modal === 'ENCLOSURE' && <EnclosureModal />}
      {modal === 'REQUEST' && <RequestModal />}
      {modal === 'REPORT' && <ReportModal />}
      {modal === 'SHOP' && <ShopModal />}
      {/* 정산 다음에 뜬다. 이게 닫혀야 화면이 다시 밝아진다. */}
      {modal === 'ARRIVAL' && <ArrivalModal />}
      {modal === 'VISIT' && <VisitModal />}
    </Stage>
  )
}
