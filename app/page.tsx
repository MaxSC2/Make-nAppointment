import { LandingHeader } from "@/components/landing2/Header";
import { Hero } from "@/components/landing2/Hero";
import { FeaturesSection } from "@/components/landing2/FeaturesSection";
import { EhrSection } from "@/components/landing2/EhrSection";
import { LaboratorySection } from "@/components/landing2/LaboratorySection";
import { LandingFooter } from "@/components/landing2/Footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <LandingHeader />
      <Hero />
      <FeaturesSection />
      <EhrSection />
      <LaboratorySection />
      <LandingFooter />
    </div>
  );
}
