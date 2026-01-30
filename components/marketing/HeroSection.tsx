import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2 } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-gradient-to-b from-blue-50/50 to-white">
      <div className="container mx-auto px-4 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100/50 text-blue-700 text-sm font-medium mb-8 border border-blue-100">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            New: AI-Powered Inventory Intelligence
        </div>
        
        <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-gray-900 mb-6 max-w-4xl mx-auto leading-[1.1]">
          Master Your Inventory. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
            Grow Your Business.
          </span>
        </h1>
        
        <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
          The all-in-one platform for modern businesses to manage stock, 
          automate purchase orders, and track sales without the headache.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <Link href="/signup">
            <Button size="lg" className="h-12 px-8 text-base bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-600/20 rounded-full transition-all hover:scale-105">
              Start Free Trial
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="#demo">
            <Button size="lg" variant="outline" className="h-12 px-8 text-base rounded-full border-gray-200 hover:bg-gray-50 hover:text-gray-900">
              View Demo
            </Button>
          </Link>
        </div>

        <div className="flex items-center justify-center gap-8 text-sm text-gray-500 mb-20">
            <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>14-day free trial</span>
            </div>
        </div>

        {/* Dashboard Mockup Placeholder */}
        <div className="relative mx-auto max-w-5xl rounded-2xl border border-gray-200 shadow-2xl bg-white p-2 sm:p-4">
           <div className="aspect-[16/9] rounded-xl bg-gray-50 overflow-hidden relative group">
              <Image 
                src="/demo.png" 
                alt="Invo Dashboard Preview" 
                fill 
                className="object-cover object-top"
                priority
              />
           </div>
           <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 opacity-10 blur-2xl -z-10"></div>
        </div>
      </div>
    </section>
  );
}
