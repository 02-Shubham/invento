import { 
  BarChart3, 
  Package, 
  ShoppingCart, 
  FileText, 
  Zap,
  ShieldCheck
} from "lucide-react";

const features = [
  {
    icon: Package,
    title: "Real-time Tracking",
    description: "Monitor stock levels across multiple locations instantly. Never run out of best-sellers again."
  },
  {
    icon: ShoppingCart,
    title: "Smart Purchasing",
    description: "Automate purchase orders based on reorder points. Manage vendor relationships seamlessly."
  },
  {
    icon: FileText,
    title: "Instant Invoicing",
    description: "Create professional invoices in seconds. Convert quotes to sales with a single click."
  },
  {
    icon: BarChart3,
    title: "Insightful Reports",
    description: "Visualize sales trends, profit margins, and inventory value with powerful analytics."
  },
  {
    icon: Zap,
    title: "AI Forecasting",
    description: "Predict future demand using our advanced AI engine to optimize your inventory investment."
  },
  {
    icon: ShieldCheck,
    title: "Secure & Scalable",
    description: "Enterprise-grade security keeps your data safe while our platform scales with your growth."
  }
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-base font-semibold text-blue-600 uppercase tracking-wide mb-2">Features</h2>
          <p className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
             Everything you need to run your business
          </p>
          <p className="text-lg text-gray-600">
            Powerful tools designed to help you save time, reduce errors, and increase profitability.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="p-8 rounded-2xl border border-gray-100 bg-white hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-6 text-blue-600">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
