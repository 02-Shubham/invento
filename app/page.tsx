import { MarketingNavbar } from "@/components/marketing/MarketingNavbar";
import { HeroSection } from "@/components/marketing/HeroSection";
import { FeaturesSection } from "@/components/marketing/FeaturesSection";
import { Footer } from "@/components/marketing/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNavbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        {/* We can add Pricing, CTA, Testimonials here later */}
      </main>
      <Footer />
    </div>
  );
}
