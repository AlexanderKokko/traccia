import { useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import GreetingCard from '@/components/diary/GreetingCard'
import ConditionSelector from '@/components/diary/ConditionSelector'
import DiaryForm from '@/components/diary/DiaryForm'
import OnboardingTour from '@/components/diary/OnboardingTour'

export default function Home() {
  const { profile, isLoading, refreshProfile } = useAuth()
  const [activeModule, setActiveModule] = useState(null)
  const [tourDone, setTourDone] = useState(false)
  const [tourName, setTourName] = useState(null)

  if (isLoading || !profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="spinner" />
      </div>
    )
  }

  // The tour covers conditions and theme. It is keyed on its own marker rather
  // than on the display name, which now arrives with the account at sign-up, and
  // the marker lives on the profile so the tour does not reappear on a second
  // device.
  const needsTour = !tourDone && !profile.onboarded_at

  const handleTourDone = (chosenName) => {
    setTourName(chosenName)
    setTourDone(true)
    refreshProfile()
  }

  // The profile is the source of truth; the tour's answer only fills the gap
  // until the refreshed profile arrives.
  const name = profile.display_name || tourName

  return (
    <div>
      {needsTour && (
        <OnboardingTour onDone={handleTourDone} knownName={profile.display_name || null} />
      )}

      <GreetingCard userName={name} />

      <div className="card-float p-5 sm:p-6 mb-5">
        <ConditionSelector activeModule={activeModule} onSelect={setActiveModule} />
      </div>

      <DiaryForm activeModule={activeModule} />
    </div>
  )
}
