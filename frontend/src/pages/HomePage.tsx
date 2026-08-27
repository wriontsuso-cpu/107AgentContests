import PageTransition from '@/components/PageTransition'
import HeroExplorer from '@/components/home/HeroExplorer'
import HomeStory from '@/components/home/HomeStory'
import CanvasPage from '@/components/visual/CanvasPage'
import { pageVisuals } from '@/data/pagePhotography'

export default function HomePage() {
  return (
    <PageTransition>
      <CanvasPage
        className="home-snow-canvas"
        src={pageVisuals.home.src}
        alt={pageVisuals.home.alt}
        focalPoint={pageVisuals.home.focalPoint}
      >
        <HeroExplorer />
        <HomeStory />
      </CanvasPage>
    </PageTransition>
  )
}
