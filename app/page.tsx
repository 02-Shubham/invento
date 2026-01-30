// "use client";

// import { useEffect } from "react";
// import { useRouter } from "next/navigation";
// import { useAuth } from "@/lib/auth-context";
// import { Button } from "@/components/ui/button";
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
// import { Archive, Package, FileText, Users, ShoppingCart } from "lucide-react";
// import Link from "next/link";

// export default function Home() {
//   const { user, loading } = useAuth();
//   const router = useRouter();

//   useEffect(() => {
//     if (!loading && user) {
//       router.push("/dashboard");
//     }
//   }, [user, loading, router]);

//   if (loading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center">
//         <div className="animate-pulse text-center">
//           <Archive className="h-12 w-12 mx-auto text-blue-600 mb-4" />
//           <p className="text-gray-500">Loading...</p>
//         </div>
//       </div>
//     );
//   }

//   if (user) {
//     return null; // Will redirect
//   }

//   return (
//     <div className="min-h-screen bg-linear-to-br from-blue-50 to-gray-50">
//       <div className="container mx-auto px-4 py-16">
//         <div className="text-center mb-16">
//           <div className="flex justify-center mb-6">
//             <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center">
//               <Archive className="w-10 h-10 text-white" />
//             </div>
//           </div>
//           <h1 className="text-5xl font-bold text-gray-900 mb-4">
//             INVO
//           </h1>
//           <p className="text-xl text-gray-600 mb-2">
//             Inventory & Invoice Management
//           </p>
//           <p className="text-gray-500 max-w-2xl mx-auto">
//             Simple, powerful inventory and invoice management for small businesses.
//             Track products, manage customers, create invoices, and handle payments all in one place.
//           </p>
//         </div>

//         <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16 max-w-6xl mx-auto">
//           <Card>
//             <CardHeader>
//               <Package className="h-8 w-8 text-blue-600 mb-2" />
//               <CardTitle>Inventory Management</CardTitle>
//             </CardHeader>
//             <CardContent>
//               <CardDescription>
//                 Track stock levels, manage products, and get low stock alerts.
//               </CardDescription>
//             </CardContent>
//           </Card>

//           <Card>
//             <CardHeader>
//               <FileText className="h-8 w-8 text-green-600 mb-2" />
//               <CardTitle>Invoice Creation</CardTitle>
//             </CardHeader>
//             <CardContent>
//               <CardDescription>
//                 Create professional invoices, track payments, and manage outstanding balances.
//               </CardDescription>
//             </CardContent>
//           </Card>

//           <Card>
//             <CardHeader>
//               <Users className="h-8 w-8 text-purple-600 mb-2" />
//               <CardTitle>Customer Management</CardTitle>
//             </CardHeader>
//             <CardContent>
//               <CardDescription>
//                 Keep track of customers, their purchase history, and payment status.
//               </CardDescription>
//             </CardContent>
//           </Card>

//           <Card>
//             <CardHeader>
//               <ShoppingCart className="h-8 w-8 text-orange-600 mb-2" />
//               <CardTitle>Purchase Orders</CardTitle>
//             </CardHeader>
//             <CardContent>
//               <CardDescription>
//                 Manage vendor orders, track shipments, and update inventory automatically.
//               </CardDescription>
//             </CardContent>
//           </Card>
//         </div>

//         <div className="text-center">
//           <div className="flex gap-4 justify-center">
//             <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
//               <Link href="/signup">Get Started Free</Link>
//             </Button>
//             <Button asChild size="lg" variant="outline">
//               <Link href="/login">Sign In</Link>
//             </Button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

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
