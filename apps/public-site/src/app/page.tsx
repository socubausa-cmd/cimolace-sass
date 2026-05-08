import { Hero } from "@/components/landing/Hero";
import { ProblemSolution } from "@/components/landing/ProblemSolution";
import { Infrastructures } from "@/components/landing/Infrastructures";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { EnginesPreview } from "@/components/landing/EnginesPreview";
import { MedOSFocus } from "@/components/landing/MedOSFocus";
import { Comparison } from "@/components/landing/Comparison";
import { PricingPreview } from "@/components/landing/PricingPreview";
import { FAQ } from "@/components/landing/FAQ";
import { LandingFooter } from "@/components/landing/Footer";

export default function Home() {
  return (
    <>
      <Hero />
      <ProblemSolution />
      <div id="infrastructures"><Infrastructures /></div>
      <HowItWorks />
      <div id="engines"><EnginesPreview /></div>
      <MedOSFocus />
      <Comparison />
      <PricingPreview />
      <FAQ />
      <LandingFooter />
    </>
  );
}
