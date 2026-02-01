"use client";

import { 
  Bot, 
  MessageSquare, 
  Wand2, 
  TrendingUp, 
  Workflow, 
  BrainCircuit
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  AgentsVisual, 
  ChatVisual, 
  MagicVisual, 
  PredictiveVisual, 
  WorkflowVisual, 
  InsightsVisual 
} from "./FeatureVisuals";

const features = [
  {
    icon: Bot,
    title: "AI Agents at Work",
    description: "Delegate tasks to autonomous agents that handle stock reordering, payment reminders, and customer follow-ups completely on autopilot.",
    className: "md:col-span-1 md:row-span-2",
    visual: AgentsVisual,
  },
  {
    icon: MessageSquare,
    title: "Chat with Your Business",
    description: "Need a sales report or customer summary? Just ask technical questions in plain English.",
    className: "md:col-span-2 md:row-span-1",
    visual: ChatVisual,
  },
  {
    icon: Wand2,
    title: "Magical Creation",
    description: "Describe a sale or expense, and watch the system generate records instantly.",
    className: "md:col-span-1 md:row-span-1",
    visual: MagicVisual,
  },
  {
    icon: TrendingUp,
    title: "Predictive Intelligence",
    description: "Forecast demand trends so you're always stocked ahead of the curve.",
    className: "md:col-span-1 md:row-span-1",
    visual: PredictiveVisual,
  },
  {
    icon: Workflow,
    title: "Automated Workflows",
    description: "Set it and forget it. The system handles approval chains and recurring invoices automatically.",
    className: "md:col-span-2 md:row-span-1",
    visual: WorkflowVisual,
  },
  {
    icon: BrainCircuit,
    title: "Proactive Insights",
    description: "Get proactive suggestions on pricing optimization and cost-saving opportunities.",
    className: "md:col-span-1 md:row-span-1",
    visual: InsightsVisual,
  }
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-sm font-semibold text-blue-600 uppercase tracking-wide mb-2">Intelligent Automation</h2>
          <p className="text-3xl font-bold text-gray-900 mb-3">
             Run your business on Autopilot
          </p>
          <p className="text-base text-gray-600">
            Leverage a suite of AI agents and tools designed to automate operations, predict trends, and eliminate manual work.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[minmax(0,1fr)] max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <div 
              key={index} 
              className={cn(
                "group relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300",
                feature.className
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white to-slate-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              <div className="relative h-full flex flex-col">
                {/* Visual Area */}
                <div className="flex-1 p-4 flex items-center justify-center bg-slate-50/50 border-b border-slate-100/50 min-h-[160px]">
                   <div className="scale-90 w-full h-full flex items-center justify-center">
                     <feature.visual />
                   </div>
                </div>
                
                {/* Content Area */}
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform duration-300">
                        <feature.icon className="h-4 w-4" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">{feature.title}</h3>
                  </div>
                  <p className="text-gray-600 leading-relaxed text-xs">
                    {feature.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
