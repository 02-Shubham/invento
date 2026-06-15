"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(false);

  const plans = [
    {
      name: "Starter",
      description: "Ideal for individuals getting started.",
      priceMonthly: 19,
      priceAnnual: 15,
      features: [
        "1 User Account",
        "5GB Storage",
        "Basic Support",
        "Standard Analytics",
      ],
      buttonText: "Get Started",
      buttonHref: "/signup",
      highlighted: false,
    },
    {
      name: "Professional",
      description: "Perfect for growing teams and businesses.",
      priceMonthly: 49,
      priceAnnual: 39,
      features: [
        "Up to 10 Users",
        "50GB Storage",
        "Priority Support",
        "Advanced Analytics",
        "Custom Integrations",
      ],
      buttonText: "Start Free Trial",
      buttonHref: "/signup",
      highlighted: true,
      badgeText: "Most Popular",
    },
    {
      name: "Enterprise",
      description: "For large scale operations and advanced needs.",
      priceMonthly: 99,
      priceAnnual: 79,
      features: [
        "Unlimited Users",
        "500GB Storage",
        "24/7 Dedicated Support",
        "Custom Reporting",
        "SLA Guarantee",
      ],
      buttonText: "Contact Sales",
      buttonHref: "/signup", // Or contact form
      highlighted: false,
    },
  ];

  return (
    <section id="pricing" className="py-20 bg-slate-50/50 border-t border-slate-100">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 mb-4">
            Flexible Plans for Every Team
          </h2>
          <p className="text-lg text-gray-650 max-w-xl mx-auto">
            Choose the right plan to accelerate your growth. All plans come with a 14-day free trial.
          </p>

          {/* Toggle */}
          <div className="flex items-center justify-center gap-3 mt-10">
            <span className={`text-sm font-medium ${!isAnnual ? "text-gray-950" : "text-gray-500"}`}>
              Monthly Billing
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
              aria-label="Toggle billing cycle"
            >
              <span
                className={`${
                  isAnnual ? "translate-x-6 bg-blue-650" : "translate-x-1 bg-white"
                } inline-block h-4 w-4 transform rounded-full bg-blue-600 transition-transform duration-200`}
              />
            </button>
            <span className={`text-sm font-medium ${isAnnual ? "text-gray-950" : "text-gray-500"} flex items-center gap-1.5`}>
              Annual Billing
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                Save ~20%
              </span>
            </span>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
          {plans.map((plan, index) => {
            const price = isAnnual ? plan.priceAnnual : plan.priceMonthly;
            return (
              <div
                key={index}
                className={`flex flex-col rounded-3xl transition-all duration-350 relative overflow-hidden ${
                  plan.highlighted
                    ? "bg-white border-2 border-blue-600 shadow-xl md:-translate-y-4 z-10"
                    : "bg-white border border-slate-200 shadow-sm hover:shadow-md"
                }`}
              >
                {/* Header background for highlighted plan */}
                {plan.highlighted && (
                  <div className="bg-gradient-to-r from-blue-650 to-indigo-650 bg-blue-600 text-white px-6 py-4 flex items-center justify-between">
                    <span className="text-sm font-bold tracking-wide uppercase">
                      {plan.name}
                    </span>
                    {plan.badgeText && (
                      <span className="bg-white/20 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-semibold">
                        {plan.badgeText}
                      </span>
                    )}
                  </div>
                )}

                <div className="p-8 flex-1 flex flex-col rounded-lg">
                  {/* Non-highlighted Header */}
                  {!plan.highlighted && (
                    <div className="mb-6">
                      <h3 className="text-2xl font-bold text-gray-900 mb-1">{plan.name}</h3>
                      <p className="text-sm text-gray-550 min-h-[40px] leading-relaxed">
                        {plan.description}
                      </p>
                    </div>
                  )}

                  {plan.highlighted && (
                    <div className="mt-2 mb-6">
                      <p className="text-sm text-gray-550 min-h-[40px] leading-relaxed">
                        {plan.description}
                      </p>
                    </div>
                  )}

                  {/* Price */}
                  <div className="flex items-baseline mb-8">
                    <span className="text-5xl font-extrabold text-gray-900 tracking-tight">
                      ${price}
                    </span>
                    <span className="ml-2 text-gray-500 font-medium">/ month</span>
                  </div>

                  {/* Features List */}
                  <ul className="space-y-4 mb-8 flex-1">
                    {plan.features.map((feature, fIdx) => (
                      <li key={fIdx} className="flex items-start gap-3 text-gray-700">
                        <div className={`mt-0.5 rounded-full p-0.5 flex items-center justify-center ${
                          plan.highlighted 
                            ? "bg-blue-100 text-blue-600" 
                            : "bg-slate-100 text-slate-650"
                        }`}>
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                        </div>
                        <span className="text-sm font-medium">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Button */}
                  <Link href={plan.buttonHref} className="w-full mt-auto block">
                    <Button
                      className={`w-full h-12 rounded-2xl font-semibold transition-all ${
                        plan.highlighted
                          ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 hover:scale-[1.02]"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-800"
                      }`}
                    >
                      {plan.buttonText}
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
