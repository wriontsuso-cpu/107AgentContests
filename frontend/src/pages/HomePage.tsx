import PageTransition from '@/components/PageTransition'
import AssistantInvitation from '@/components/home/AssistantInvitation'
import CategoryAtlas from '@/components/home/CategoryAtlas'
import FeaturedStrip from '@/components/home/FeaturedStrip'
import HeroExplorer from '@/components/home/HeroExplorer'

export default function HomePage() {
  return (
    <PageTransition>
      <HeroExplorer />
      <CategoryAtlas />
      <FeaturedStrip />
      <AssistantInvitation />
    </PageTransition>
  )
}
