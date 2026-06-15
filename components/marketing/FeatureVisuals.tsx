"use client";

import { 
  Bot, 
  MessageSquare, 
  Send,
  Sparkles,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Bell,
  FileText
} from "lucide-react";

export const AgentsVisual = () => (
    <div className="relative w-full h-full min-h-[200px] bg-slate-50 rounded-lg p-4 overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]" />
      <div className="space-y-3">
        {[1, 2, 3,4,5].map((i) => (
          <div key={i} className={`flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-700`} style={{ animationDelay: `${i * 500}ms` }}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${i === 1 ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
              <Bot className="w-4 h-4" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="h-2 bg-slate-200 rounded w-24"></div>
              <div className="h-1.5 bg-slate-100 rounded w-16"></div>
            </div>
            <div className="text-green-500">
               <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
        ))}
      </div>
    </div>
);

export const ChatVisual = () => (
    <div className="relative w-full h-full min-h-[160px] bg-slate-50 rounded-lg p-4 flex flex-col justify-end">
        <div className="space-y-3 w-full">
            <div className="flex justify-end">
                <div className="bg-blue-600 text-white text-xs py-2 px-3 rounded-2xl rounded-tr-sm max-w-[80%]">
                    Show me this week's revenue
                </div>
            </div>
            <div className="flex justify-start">
                 <div className="bg-white border border-slate-200 text-slate-600 text-xs py-2 px-3 rounded-2xl rounded-tl-sm max-w-[90%] shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-3 h-3 text-green-500" />
                        <span className="font-semibold text-slate-800">$12,450.00</span>
                    </div>
                    Revenue is up 12% vs last week.
                 </div>
            </div>
             <div className="relative">
                <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10" />
                <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-full">
                    <div className="w-4 h-4 bg-slate-200 rounded-full" />
                    <div className="h-1.5 bg-slate-100 rounded w-32" />
                </div>
             </div>
        </div>
    </div>
);

export const MagicVisual = () => (
    <div className="relative w-full h-full min-h-[160px] flex flex-col items-center justify-center bg-slate-50 rounded-lg p-4 group">
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-50/50 to-purple-50/50" />
        <div className="relative z-10 flex flex-col items-center">
            <div className="w-12 h-12 bg-white rounded-xl shadow-md border border-slate-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <Sparkles className="w-6 h-6 text-purple-500" />
            </div>
            <div className="bg-white/80 backdrop-blur-sm px-4 py-2 rounded-lg border border-slate-200 text-xs text-slate-500 shadow-sm animate-pulse">
                "Create invoice for John..."
            </div>
        </div>
    </div>
);

export const PredictiveVisual = () => (
    <div className="relative w-full h-full min-h-[160px] bg-slate-50 rounded-lg p-4 flex items-end">
        <div className="w-full h-24 flex items-end justify-between gap-1">
            {[40, 65, 50, 80, 55, 90, 100].map((h, i) => (
                <div key={i} className="w-full bg-blue-100 rounded-t-sm relative group overflow-hidden" style={{ height: `${h}%` }}>
                    <div className="absolute bottom-0 left-0 w-full bg-blue-500 transition-all duration-1000 ease-out" style={{ 
                        height: '0%', 
                        animation: `fillBar 1s ease-out ${i * 0.1}s forwards` 
                    }}>
                        <style jsx>{`
                            @keyframes fillBar {
                                to { height: 100%; }
                            }
                        `}</style>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

export const WorkflowVisual = () => (
    <div className="relative w-full h-full min-h-[160px] bg-slate-50 rounded-lg p-6 flex items-center justify-between">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -translate-y-1/2" />
        
        {['Order', 'Approval', 'Invoice', 'Payment'].map((step, i) => (
            <div key={i} className="relative z-10 flex flex-col items-center gap-2">
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center bg-white transition-colors duration-500 ${i < 3 ? 'border-blue-500 text-blue-500' : 'border-slate-300 text-slate-300'}`}>
                    {i === 0 && <FileText className="w-3 h-3" />}
                    {i === 1 && <CheckCircle2 className="w-3 h-3" />}
                    {i === 2 && <Send className="w-3 h-3" />}
                    {i === 3 && <Bell className="w-3 h-3" />}
                </div>
                <div className="text-[10px] font-medium text-slate-500">{step}</div>
            </div>
        ))}
        
        <div className="absolute top-1/2 left-0 w-2 h-2 bg-blue-600 rounded-full -translate-y-1/2 animate-[moveRight_3s_infinite_linear]">
            <style jsx>{`
                @keyframes moveRight {
                    0% { left: 10%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { left: 90%; opacity: 0; }
                }
            `}</style>
        </div>
    </div>
);

export const InsightsVisual = () => (
    <div className="relative w-full h-full min-h-[160px] bg-slate-50 rounded-lg p-4 flex items-center justify-center">
        <div className="w-full max-w-[200px] bg-white rounded-lg shadow-sm border border-slate-200 p-3 transform transition-all duration-300 hover:scale-105 cursor-default">
            <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                    <Bell className="w-4 h-4 text-amber-600" />
                </div>
                <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-800">Low Stock Alert</p>
                    <p className="text-[10px] text-slate-500 leading-tight">
                        "MacBook Pro" is below reorder point (5).
                    </p>
                    <div className="pt-2">
                         <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded font-medium">Reorder</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
);
